// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Tooltip } from "@mui/material";
import { useEffect, useRef, useState } from "react";

import type { SceneManager } from "gzweb";

// Raw time format from gzweb stats message
type GzTimeData = {
  sec: number;
  nsec: number;
};

// Stats received via the /world/*/stats gz-transport topic
type GzWorldStats = {
  simTime: GzTimeData | null;
  realTime: GzTimeData | null;
  realtimeFactor: number;
  iterations: number;
};

// Rotate vector v by the conjugate (= inverse) of unit quaternion q.
// Used to project world-space axes into camera view space.
function applyQConjToVec(
  q: { x: number; y: number; z: number; w: number },
  v: [number, number, number]
): [number, number, number] {
  const { x: qx, y: qy, z: qz, w: qw } = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

function formatGzTime(time: GzTimeData | null): string {
  if (!time) {
    return "--:--:--.---";
  }
  const total = time.sec + time.nsec / 1e9;
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  const ms = Math.floor((time.nsec % 1e9) / 1e6);
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// Shared HUD box style — translucent dark card with backdrop blur
const hudSx = {
  position: "absolute" as const,
  padding: "8px 11px",
  background: "var(--color-bg-overlay)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "5px",
  fontSize: 9,
  backdropFilter: "blur(4px)",
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-primary)",
  lineHeight: 1.6,
};

// Compress icon — shown on the FAB to signal "exit focus mode"
function IconCompress(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polyline points="4,1 1,1 1,4" />
      <polyline points="10,1 13,1 13,4" />
      <polyline points="13,10 13,13 10,13" />
      <polyline points="1,10 1,13 4,13" />
      <line x1="5" y1="5" x2="9" y2="9" />
      <line x1="9" y1="5" x2="5" y2="9" />
    </svg>
  );
}

type Props = {
  websocketUrl: string;
  // Focus mode props — used to show/hide the exit FAB and the entry glow
  focusMode: boolean;
  onExitFocus: () => void;
};

export function CenterViewport({ websocketUrl, focusMode, onExitFocus }: Props): JSX.Element {
  const sceneElementRef = useRef<HTMLDivElement | null>(null);
  const sceneMgrRef = useRef<SceneManager | null>(null);
  const statsTopicNameRef = useRef<string | null>(null);
  const axesRef = useRef<SVGSVGElement | null>(null);

  const [simRunning, setSimRunning] = useState(false);
  const [isOrtho, setIsOrtho] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    name: string; linkCount: number;
  } | null>(null);

  const [worldStats, setWorldStats] = useState<GzWorldStats>({
    simTime: null,
    realTime: null,
    realtimeFactor: 0,
    iterations: 0,
  });

  // Connect / reconnect SceneManager whenever the WebSocket URL changes
  useEffect(() => {
    if (!sceneElementRef.current) {
      return;
    }

    const elementId = "gz-scene-panel";
    sceneElementRef.current.id = elementId;

    let sceneMgr: SceneManager;

    void import("gzweb").then((gzweb) => {
      if (!sceneElementRef.current) {
        return;
      }
      const { SceneManager, Topic } = gzweb as any;
      sceneMgr = new SceneManager({ elementId, websocketUrl }) as SceneManager;
      sceneMgrRef.current = sceneMgr;

      sceneMgr.onModelSelect = (name: string | null) => {
        if (!name) { setSelectedEntity(null); return; }
        const scene = (sceneMgrRef.current as any)?.scene;
        const obj = scene?.getByName(name);
        const protoModels: any[] = sceneMgrRef.current?.getModels() ?? [];
        const protoModel = protoModels.find(
          (m: any) => m.gz3dName === name || m.name === name
        );
        const linkCount = (protoModel?.link ?? obj?.children ?? []).length;
        setSelectedEntity({ name, linkCount });
      };

      const readySub = (sceneMgr as any)
        .getConnectionStatusAsObservable()
        .subscribe((ready: boolean) => {
          if (ready && sceneMgr) {
            const transport = (sceneMgr as any).transport;
            if (transport) {
              const worldName: string | undefined = transport.getWorld();
              if (worldName) {
                const statsTopicName = `/world/${worldName}/stats`;
                const statsTopic = new Topic(statsTopicName, (msg: any) => {
                  if (msg.paused !== undefined) {
                    setSimRunning(!msg.paused);
                  }
                  setWorldStats((prev) => ({
                    ...prev,
                    simTime: msg.sim_time ?? null,
                    realTime: msg.real_time ?? null,
                    realtimeFactor: msg.real_time_factor ?? 0,
                    iterations: msg.iterations ?? 0,
                  }));
                });
                (sceneMgr as any).subscribeToTopic(statsTopic);
                statsTopicNameRef.current = statsTopicName;
              }
            }
          }
        });

      return () => {
        readySub.unsubscribe();
      };
    });

    return () => {
      if (statsTopicNameRef.current && sceneMgr) {
        (sceneMgr as any).unsubscribeFromTopic(statsTopicNameRef.current);
        statsTopicNameRef.current = null;
      }
      if (sceneMgr) {
        sceneMgr.disconnect();
      }
      sceneMgrRef.current = null;
    };
  }, [websocketUrl]);

  // Live axes orientation gizmo — reads camera quaternion per frame, updates SVG via DOM refs
  useEffect(() => {
    const CX = 28, CY = 52, SCALE = 28, LABEL_GAP = 9;
    const AXIS_DEFS: { id: string; vec: [number, number, number] }[] = [
      { id: 'x', vec: [1, 0, 0] },
      { id: 'y', vec: [0, 1, 0] },
      { id: 'z', vec: [0, 0, 1] },
    ];

    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const svg = axesRef.current;
      if (!svg) { return; }
      const q = (sceneMgrRef.current as any)?.scene?.camera?.quaternion;
      if (!q) { return; }

      const projected = AXIS_DEFS.map(({ id, vec }) => {
        const [rx, ry, rz] = applyQConjToVec(q, vec);
        return { id, tx: CX + rx * SCALE, ty: CY - ry * SCALE, z: rz };
      });

      projected.sort((a, b) => a.z - b.z); // back-to-front

      projected.forEach(({ id, tx, ty, z }) => {
        const opacity = z > 0 ? 1.0 : 0.3; // +z = toward viewer = bright, -z = away = dim
        const dx = tx - CX, dy = ty - CY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        const g = svg.querySelector(`[data-axis="${id}"]`) as SVGGElement | null;
        if (!g) { return; }

        const line = g.querySelector('line') as SVGLineElement | null;
        if (line) {
          line.setAttribute('x2', tx.toFixed(1));
          line.setAttribute('y2', ty.toFixed(1));
          line.style.opacity = String(opacity);
        }

        const text = g.querySelector('text') as SVGTextElement | null;
        if (text) {
          text.setAttribute('x', (tx + (dx / len) * LABEL_GAP).toFixed(1));
          text.setAttribute('y', (ty + (dy / len) * LABEL_GAP + 2.5).toFixed(1));
          text.style.opacity = String(opacity);
        }

        svg.appendChild(g); // reorder for depth sort
      });
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Resize the gzweb scene whenever the container element dimensions change
  useEffect(() => {
    const el = sceneElementRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const mgr = sceneMgrRef.current;
      if (mgr && (mgr as any).scene) {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          (mgr as any).scene.setSize(width, height);
        }
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        bgcolor: "var(--color-bg-page)",
        minHeight: 0,
      }}
    >
      {/* gzweb render target — SceneManager attaches its canvas here */}
      <div
        ref={sceneElementRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />

      {/*
       * Focus-mode entry glow — an inset box-shadow pulse that fires once
       * whenever focus mode activates. Rendered conditionally so the animation
       * re-triggers from scratch every time the user enters focus mode.
       */}
      {focusMode && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            "@keyframes focusRing": {
              "0%":   { boxShadow: "inset 0 0 0 2px rgba(77,141,245,0)" },
              "35%":  { boxShadow: "inset 0 0 0 2px rgba(77,141,245,.65)" },
              "100%": { boxShadow: "inset 0 0 0 2px rgba(77,141,245,0)" },
            },
            animation: "focusRing .9s ease-out forwards",
          }}
        />
      )}

      {/*
       * Focus-mode exit FAB — fixed at top-right, always in the DOM.
       * Spring-bounce entry: cubic-bezier(.34,1.56,.64,1) overshoots slightly.
       * Delayed 0.15s so it appears after the grid animation has started.
       */}
      <Box
        component="button"
        onClick={onExitFocus}
        title="Exit Focus Mode (F or Esc)"
        sx={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 500,
          width: 34,
          height: 34,
          borderRadius: "8px",
          border: "1px solid var(--color-border-default)",
          bgcolor: "var(--color-bg-overlay)",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,.6)",
          opacity: focusMode ? 1 : 0,
          pointerEvents: focusMode ? "auto" : "none",
          transform: focusMode ? "scale(1) rotate(0deg)" : "scale(.5) rotate(90deg)",
          transition:
            "opacity .28s ease .15s, transform .28s cubic-bezier(.34,1.56,.64,1) .15s, color .15s ease, border-color .15s ease",
          "&:hover": {
            color: "var(--color-accent)",
            borderColor: "var(--color-accent)",
            bgcolor: "var(--color-accent-muted)",
          },
        }}
      >
        <IconCompress />
      </Box>

      {/* ── HUD: selected entity (top-left) ── */}
      <Box sx={{ ...hudSx, top: 12, left: 12, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: selectedEntity ? "var(--color-accent)" : "var(--color-border-default)",
            flexShrink: 0,
          }}
        />
        <Box>
          <Box sx={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 10 }}>
            {selectedEntity?.name ?? "—"}
          </Box>
          <Box sx={{ color: "var(--color-text-tertiary)", fontSize: 8 }}>
            {selectedEntity
              ? `model · ${selectedEntity.linkCount} links`
              : "click model to select"}
          </Box>
        </Box>
      </Box>

      {/* ── HUD: view cube + view controls (top-right) ── */}
      <Box sx={{ ...hudSx, top: 12, right: 12, p: "8px 10px", minWidth: 110 }}>
        {/* View cube */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: "6px" }}>
          <svg width="60" height="60" viewBox="0 0 56 56" fill="none">
            <polygon
              points="28,4 52,18 52,38 28,52 4,38 4,18"
              fill="var(--color-bg-elevated)"
              stroke="var(--color-border-default)"
              strokeWidth="1.2"
            />
            <line x1="28" y1="4" x2="28" y2="52" stroke="var(--color-border-default)" strokeWidth=".8" />
            <line x1="4" y1="18" x2="52" y2="38" stroke="var(--color-border-default)" strokeWidth=".8" />
            <line x1="4" y1="38" x2="52" y2="18" stroke="var(--color-border-default)" strokeWidth=".8" />
            <text x="28" y="14" textAnchor="middle" fontSize="7" fill="var(--color-text-tertiary)" fontFamily="var(--font-mono)">TOP</text>
            <text x="44" y="34" textAnchor="middle" fontSize="7" fill="var(--color-text-tertiary)" fontFamily="var(--font-mono)">R</text>
            <text x="12" y="34" textAnchor="middle" fontSize="7" fill="var(--color-text-tertiary)" fontFamily="var(--font-mono)">L</text>
          </svg>
        </Box>
        {/* View preset buttons — row 1 */}
        <Box sx={{ display: "flex", gap: "3px", mb: "3px" }}>
          {([ { label: "TOP", dir: "top" as const, title: "Top View" },
               { label: "FNT", dir: "front" as const, title: "Front View" },
               { label: "SID", dir: "side" as const, title: "Side View" },
          ]).map(({ label, dir, title }) => (
            <Tooltip key={label} title={title} placement="bottom" arrow>
              <Box
                component="button"
                onClick={() => { sceneMgrRef.current?.setCameraView(dir); }}
                sx={{
                  flex: 1, height: 24, border: "none", borderRadius: "3px",
                  background: "transparent", color: "var(--color-text-secondary)",
                  fontSize: 7, cursor: "pointer", fontFamily: "var(--font-mono)",
                  "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
                }}
              >
                {label}
              </Box>
            </Tooltip>
          ))}
          <Tooltip title="Home / Reset Camera" placement="bottom" arrow>
            <Box
              component="button"
              onClick={() => { sceneMgrRef.current?.resetView(); }}
              sx={{
                width: 24, height: 24, border: "none", borderRadius: "3px",
                background: "transparent", color: "var(--color-text-secondary)",
                fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
              }}
            >
              ⌂
            </Box>
          </Tooltip>
        </Box>
        {/* View preset buttons — row 2 */}
        <Box sx={{ display: "flex", gap: "3px", alignItems: "center" }}>
          <Tooltip title="Perspective / Orthographic" placement="bottom" arrow>
            <Box
              component="button"
              onClick={() => { const next = sceneMgrRef.current?.toggleOrtho() ?? false; setIsOrtho(next); }}
              sx={{
                flex: 1, height: 24, border: "none", borderRadius: "3px",
                background: isOrtho ? "var(--color-accent-muted)" : "transparent",
                color: isOrtho ? "var(--color-accent)" : "var(--color-text-secondary)",
                fontSize: 7, cursor: "pointer", fontFamily: "var(--font-mono)",
                "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
              }}
            >
              P/O
            </Box>
          </Tooltip>
          <Tooltip title="Toggle Grid" placement="bottom" arrow>
            <Box
              component="button"
              onClick={() => { const next = sceneMgrRef.current?.toggleGrid() ?? false; setGridVisible(next); }}
              sx={{
                flex: 1, height: 24, border: "none", borderRadius: "3px",
                background: gridVisible ? "var(--color-accent-muted)" : "transparent",
                color: gridVisible ? "var(--color-accent)" : "var(--color-text-secondary)",
                fontSize: 9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
              }}
            >
              ⊞
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* ── HUD: coordinate axes widget (bottom-left) — updated per frame via axesRef RAF ── */}
      <Box sx={{ ...hudSx, bottom: 12, left: 12, p: 0, border: "none", background: "transparent", backdropFilter: "none" }}>
        <svg ref={axesRef} width="100" height="72" viewBox="0 0 100 72" fill="none">
          <g data-axis="x">
            <line x1="28" y1="52" x2="56" y2="52" stroke="#ef4444" strokeWidth="1.8" />
            <text x="59" y="55" fontSize="9" fill="#ef4444" fontFamily="JetBrains Mono,monospace">X</text>
          </g>
          <g data-axis="y">
            <line x1="28" y1="52" x2="28" y2="24" stroke="#22c55e" strokeWidth="1.8" />
            <text x="20" y="20" fontSize="9" fill="#22c55e" fontFamily="JetBrains Mono,monospace">Y</text>
          </g>
          <g data-axis="z">
            <line x1="28" y1="52" x2="10" y2="64" stroke="#3b82f6" strokeWidth="1.8" />
            <text x="2" y="68" fontSize="9" fill="#3b82f6" fontFamily="JetBrains Mono,monospace">Z</text>
          </g>
        </svg>
      </Box>

      {/* ── HUD: SIM controls (bottom-center) ── */}
      <Box
        sx={{
          ...hudSx,
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          p: "5px 8px",
          whiteSpace: "nowrap",
        }}
      >
        {/* PLAY / PAUSE toggle */}
        <Tooltip title={simRunning ? "Pause (Space)" : "Play (Space)"} placement="top" arrow>
          <Box
            component="button"
            onClick={() => {
              const mgr = sceneMgrRef.current;
              if (!mgr) { return; }
              if (simRunning) { mgr.pause(); } else { mgr.play(); }
            }}
            sx={{
              width: 36, height: 28, border: "none", borderRadius: "4px",
              background: simRunning
                ? "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))"
                : "var(--color-bg-elevated)",
              color: simRunning ? "var(--color-bg-page)" : "var(--color-text-primary)",
              fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)",
              transition: "background .15s, color .15s",
              "&:hover": { filter: "brightness(1.12)" },
            }}
          >
            {simRunning ? "❚❚" : "▶"}
          </Box>
        </Tooltip>
        <Tooltip title="Step Forward" placement="top" arrow>
          <Box
            component="button"
            onClick={() => { sceneMgrRef.current?.step(1); }}
            sx={{
              width: 32, height: 28, border: "none", borderRadius: "4px",
              background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)",
              fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)",
              "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
            }}
          >
            ▶|
          </Box>
        </Tooltip>
        <Tooltip title="Reset World" placement="top" arrow>
          <Box
            component="button"
            onClick={() => { sceneMgrRef.current?.reset(); }}
            sx={{
              width: 32, height: 28, border: "none", borderRadius: "4px",
              background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              "&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
            }}
          >
            ↺
          </Box>
        </Tooltip>
      </Box>

      {/* ── HUD: sim stats (bottom-right) ── */}
      <Box sx={{ ...hudSx, bottom: 12, right: 12, minWidth: 168 }}>
        {/* Status */}
        <Box sx={{ color: "var(--color-info)", mb: "5px", textAlign: "center" }}>
          ▶ {worldStats.simTime ? "SIM RUNNING" : "CONNECTING…"}
        </Box>
        {/* ITER */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "2px" }}>
          <Box component="span" sx={{ fontSize: 7, color: "var(--color-text-tertiary)", mr: "4px" }}>ITER</Box>
          <Box component="span" sx={{ color: "var(--color-accent)", fontWeight: 700 }}>
            {worldStats.iterations > 0 ? worldStats.iterations.toLocaleString() : "--"}
          </Box>
        </Box>
        {/* SIM TIME */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "2px" }}>
          <Box component="span" sx={{ fontSize: 7, color: "var(--color-text-tertiary)", mr: "4px" }}>SIM</Box>
          <Box component="span" sx={{ color: "var(--color-info)" }}>{formatGzTime(worldStats.simTime)}</Box>
        </Box>
        {/* REAL TIME */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "2px" }}>
          <Box component="span" sx={{ fontSize: 7, color: "var(--color-text-tertiary)", mr: "4px" }}>REAL</Box>
          <Box component="span" sx={{ color: "var(--color-text-primary)" }}>{formatGzTime(worldStats.realTime)}</Box>
        </Box>
        {/* RTF */}
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box component="span" sx={{ fontSize: 7, color: "var(--color-text-tertiary)", mr: "4px" }}>RTF</Box>
          <Box component="span" sx={{ color: worldStats.realtimeFactor > 0 ? "var(--color-success)" : "var(--color-text-tertiary)", fontWeight: 700 }}>
            {worldStats.realtimeFactor > 0 ? worldStats.realtimeFactor.toFixed(3) : "--"}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

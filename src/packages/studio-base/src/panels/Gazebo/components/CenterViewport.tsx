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
  fps: number;      // not in world stats topic; 0 until a render-loop hook is added
  contacts: number; // needs a separate physics topic; 0 for now
};

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
  background: "rgba(10,15,25,.88)",
  border: "1px solid #30363d",
  borderRadius: "5px",
  fontSize: 9,
  backdropFilter: "blur(4px)",
  fontFamily: "'JetBrains Mono', monospace",
  color: "#c9d1d9",
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
    fps: 0,
    contacts: 0,
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
                    contacts: 0,
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

  // FPS counter — counts RAF frames, updates display once per second
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const tick = () => {
      frameCount++;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const interval = setInterval(() => {
      const now = performance.now();
      const fps = (frameCount / (now - lastTime)) * 1000;
      setWorldStats((s) => ({ ...s, fps }));
      frameCount = 0;
      lastTime = now;
    }, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(interval);
    };
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
        bgcolor: "#030712",
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
              "0%": { boxShadow: "inset 0 0 0 2px rgba(249,115,22,0)" },
              "35%": { boxShadow: "inset 0 0 0 2px rgba(249,115,22,.65)" },
              "100%": { boxShadow: "inset 0 0 0 2px rgba(249,115,22,0)" },
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
          border: "1px solid #30363d",
          bgcolor: "rgba(13,17,23,.92)",
          color: "#8b949e",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,.6)",
          // Animated in when focusMode = true, out when false
          opacity: focusMode ? 1 : 0,
          pointerEvents: focusMode ? "auto" : "none",
          transform: focusMode ? "scale(1) rotate(0deg)" : "scale(.5) rotate(90deg)",
          transition:
            "opacity .28s ease .15s, transform .28s cubic-bezier(.34,1.56,.64,1) .15s, color .15s ease, border-color .15s ease",
          "&:hover": {
            color: "#f97316",
            borderColor: "#f97316",
            bgcolor: "rgba(249,115,22,.12)",
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
            bgcolor: selectedEntity ? "#f97316" : "#30363d",
            flexShrink: 0,
          }}
        />
        <Box>
          <Box sx={{ color: "#fb923c", fontWeight: 700, fontSize: 10 }}>
            {selectedEntity?.name ?? "—"}
          </Box>
          <Box sx={{ color: "#6e7681", fontSize: 8 }}>
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
              fill="rgba(22,27,34,.9)"
              stroke="#30363d"
              strokeWidth="1.2"
            />
            <line x1="28" y1="4" x2="28" y2="52" stroke="#30363d" strokeWidth=".8" />
            <line x1="4" y1="18" x2="52" y2="38" stroke="#30363d" strokeWidth=".8" />
            <line x1="4" y1="38" x2="52" y2="18" stroke="#30363d" strokeWidth=".8" />
            <text x="28" y="14" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">TOP</text>
            <text x="44" y="34" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">R</text>
            <text x="12" y="34" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">L</text>
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
                  background: "transparent", color: "#8b949e",
                  fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                  "&:hover": { background: "rgba(255,255,255,.07)", color: "#c9d1d9" },
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
                background: "transparent", color: "#8b949e",
                fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { background: "rgba(255,255,255,.07)", color: "#c9d1d9" },
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
                background: isOrtho ? "rgba(249,115,22,.20)" : "transparent",
                color: isOrtho ? "#f97316" : "#8b949e",
                fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                "&:hover": { background: "rgba(255,255,255,.07)", color: "#c9d1d9" },
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
                background: gridVisible ? "rgba(249,115,22,.20)" : "transparent",
                color: gridVisible ? "#f97316" : "#8b949e",
                fontSize: 9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { background: "rgba(255,255,255,.07)", color: "#c9d1d9" },
              }}
            >
              ⊞
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* ── HUD: coordinate axes widget (bottom-left) ── */}
      <Box sx={{ ...hudSx, bottom: 12, left: 12, p: 0, border: "none", background: "transparent", backdropFilter: "none" }}>
        <svg width="80" height="56" viewBox="0 0 80 56" fill="none">
          {/* X axis — red */}
          <line x1="20" y1="40" x2="70" y2="40" stroke="#ef4444" strokeWidth="1.5" />
          <polygon points="70,40 64,37 64,43" fill="#ef4444" />
          <text x="73" y="43" fontSize="7" fill="#ef4444" fontFamily="JetBrains Mono,monospace">X</text>
          {/* Y axis — green */}
          <line x1="20" y1="40" x2="20" y2="8" stroke="#22c55e" strokeWidth="1.5" />
          <polygon points="20,8 17,14 23,14" fill="#22c55e" />
          <text x="13" y="7" fontSize="7" fill="#22c55e" fontFamily="JetBrains Mono,monospace">Y</text>
          {/* Z axis — blue (depth, diagonal) */}
          <line x1="20" y1="40" x2="5" y2="52" stroke="#3b82f6" strokeWidth="1.5" />
          <polygon points="5,52 10,47 14,52" fill="#3b82f6" />
          <text x="0" y="56" fontSize="7" fill="#3b82f6" fontFamily="JetBrains Mono,monospace">Z</text>
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
                ? "linear-gradient(135deg,#f97316,#fb923c)"
                : "rgba(255,255,255,.06)",
              color: simRunning ? "#0d1117" : "#c9d1d9",
              fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
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
              background: "rgba(255,255,255,.06)", color: "#8b949e",
              fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
              "&:hover": { background: "rgba(255,255,255,.10)", color: "#c9d1d9" },
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
              background: "rgba(255,255,255,.06)", color: "#8b949e",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              "&:hover": { background: "rgba(255,255,255,.10)", color: "#c9d1d9" },
            }}
          >
            ↺
          </Box>
        </Tooltip>
      </Box>

      {/* ── HUD: world control / sim stats (bottom-right) ── */}
      <Box sx={{ ...hudSx, bottom: 12, right: 12, minWidth: 168 }}>
        <Box sx={{ fontSize: 7, color: "#6e7681", letterSpacing: ".8px", mb: "5px" }}>
          WORLD CONTROL
        </Box>
        {/* Status row */}
        <Box sx={{ color: "#22d3ee", mb: "4px" }}>
          ▶ {worldStats.simTime ? "SIM RUNNING" : "CONNECTING…"}
        </Box>
        {/* ITER + FPS */}
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: "2px" }}>
          <Box>
            <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>ITER</Box>
            <Box component="span" sx={{ color: "#fb923c", fontWeight: 700 }}>
              {worldStats.iterations > 0 ? worldStats.iterations.toLocaleString() : "--"}
            </Box>
          </Box>
          <Box>
            <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>FPS</Box>
            <Box component="span" sx={{ color: "#a78bfa", fontWeight: 700 }}>
              {worldStats.fps > 0 ? worldStats.fps.toFixed(1) : "--"}
            </Box>
          </Box>
        </Box>
        {/* SIM TIME */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "2px" }}>
          <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>SIM</Box>
          <Box component="span" sx={{ color: "#22d3ee" }}>{formatGzTime(worldStats.simTime)}</Box>
        </Box>
        {/* REAL TIME */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "2px" }}>
          <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>REAL</Box>
          <Box component="span" sx={{ color: "#c9d1d9" }}>{formatGzTime(worldStats.realTime)}</Box>
        </Box>
        {/* RTF + CONTACTS */}
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>RTF</Box>
            <Box component="span" sx={{ color: worldStats.realtimeFactor > 0 ? "#22c55e" : "#6e7681", fontWeight: 700 }}>
              {worldStats.realtimeFactor > 0 ? worldStats.realtimeFactor.toFixed(3) : "--"}
            </Box>
          </Box>
          <Box>
            <Box component="span" sx={{ fontSize: 7, color: "#6e7681", mr: "4px" }}>CONTACTS</Box>
            <Box component="span" sx={{ color: "#fb923c", fontWeight: 700 }}>
              {worldStats.contacts}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

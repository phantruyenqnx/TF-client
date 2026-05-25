// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
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

type Props = {
  websocketUrl: string;
};

export function CenterViewport({ websocketUrl }: Props): JSX.Element {
  const sceneElementRef = useRef<HTMLDivElement | null>(null);
  const sceneMgrRef = useRef<SceneManager | null>(null);
  const statsTopicNameRef = useRef<string | null>(null);

  const [worldStats, setWorldStats] = useState<GzWorldStats>({
    simTime: null,
    realTime: null,
    realtimeFactor: 0,
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
                  setWorldStats({
                    simTime: msg.sim_time ?? null,
                    realTime: msg.real_time ?? null,
                    realtimeFactor: msg.real_time_factor ?? 0,
                  });
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

      {/* ── HUD: selected entity (top-left) ── */}
      <Box sx={{ ...hudSx, top: 12, left: 12, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "#f97316",
            flexShrink: 0,
          }}
        />
        <Box>
          <Box sx={{ color: "#fb923c", fontWeight: 700, fontSize: 10 }}>x500</Box>
          <Box sx={{ color: "#6e7681", fontSize: 8 }}>model · 9 links · 4 joints</Box>
        </Box>
      </Box>

      {/* ── HUD: view cube (top-right) ── */}
      <Box sx={{ ...hudSx, top: 12, right: 12, p: 0, border: "none", background: "transparent", backdropFilter: "none" }}>
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
          <text x="28" y="14" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">
            TOP
          </text>
          <text x="44" y="34" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">
            R
          </text>
          <text x="12" y="34" textAnchor="middle" fontSize="7" fill="#6e7681" fontFamily="JetBrains Mono,monospace">
            L
          </text>
        </svg>
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

      {/* ── HUD: world control / sim stats (bottom-right) ── */}
      <Box sx={{ ...hudSx, bottom: 12, right: 12 }}>
        <Box sx={{ fontSize: 7, color: "#6e7681", letterSpacing: ".8px", mb: "4px" }}>
          WORLD CONTROL
        </Box>
        <Box sx={{ color: "#22d3ee" }}>
          ▶ {worldStats.simTime ? "SIM RUNNING" : "CONNECTING…"}
        </Box>
        <Box sx={{ color: "#22d3ee" }}>
          SIM &nbsp;{formatGzTime(worldStats.simTime)}
        </Box>
        <Box sx={{ color: "#22d3ee" }}>
          REAL {formatGzTime(worldStats.realTime)}
        </Box>
        <Box sx={{ color: worldStats.realtimeFactor > 0 ? "#22c55e" : "#6e7681" }}>
          RTF &nbsp;{worldStats.realtimeFactor > 0 ? worldStats.realtimeFactor.toFixed(3) : "--"}
        </Box>
      </Box>
    </Box>
  );
}

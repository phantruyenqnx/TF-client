// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { SettingsTreeAction, SettingsTreeNodes } from "@tf/studio";
import type { PanelExtensionContext } from "@tf/studio";
import ThemeProvider from "@tf/studio-base/theme/ThemeProvider";

import { CenterViewport } from "./components/CenterViewport";
import { GazeboToolbar } from "./components/GazeboToolbar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { STUB_STATS } from "./placeholder";
import type { GazeboConfig } from "./types";

const DEFAULT_CONFIG: GazeboConfig = {
  websocketUrl: "ws://localhost:9002",
};

function buildSettingsTree(config: GazeboConfig): SettingsTreeNodes {
  return {
    general: {
      label: "General",
      fields: {
        websocketUrl: {
          label: "WebSocket URL",
          input: "string",
          value: config.websocketUrl,
          placeholder: "ws://localhost:9002",
        },
      },
    },
  };
}

type Props = {
  context: PanelExtensionContext;
};

// Easing curve used for all focus-mode grid transitions
const GRID_EASING = "cubic-bezier(.4,0,.2,1)";
const GRID_DURATION = "0.42s";
const FADE_TRANSITION = "opacity 0.22s ease";

export function GazeboPanel({ context }: Props): JSX.Element {
  const { saveState } = context;

  const [config, setConfig] = useState<GazeboConfig>(() => {
    const partial = context.initialState as DeepPartial<GazeboConfig>;
    return {
      websocketUrl: partial.websocketUrl ?? DEFAULT_CONFIG.websocketUrl,
    };
  });

  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  // Focus mode: collapses all panels leaving only the 3D viewport
  const [focusMode, setFocusMode] = useState(false);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }
      const { path, value } = action.payload;
      if (path[1] === "websocketUrl" && typeof value === "string") {
        setConfig((prev) => ({ ...prev, websocketUrl: value }));
      }
    },
    [],
  );

  useLayoutEffect(() => {
    context.watch("colorScheme");
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: buildSettingsTree(config),
    });
    saveState(config);
  }, [config, context, saveState, settingsActionHandler]);

  // F key toggles focus mode; Escape always exits it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFocusMode((v) => !v);
      }
      if (e.key === "Escape") {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  // Shared sx helpers for panels that collapse in focus mode
  const collapsibleSx = {
    opacity: focusMode ? 0 : 1,
    transition: FADE_TRANSITION,
    pointerEvents: focusMode ? ("none" as const) : ("auto" as const),
    overflow: "hidden" as const,
  };

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      {/*
       * Root: 3-row grid
       *   row 0 — toolbar   (56px, collapses to 0px in focus mode)
       *   row 1 — main area (1fr, always visible)
       *   row 2 — status bar (28px, collapses to 0px in focus mode)
       */}
      <Box
        sx={{
          display: "grid",
          gridTemplateRows: focusMode ? "0px 1fr 0px" : "56px 1fr 28px",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          transition: `grid-template-rows ${GRID_DURATION} ${GRID_EASING}`,
          bgcolor: "#010409",
          color: "#c9d1d9",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        }}
      >
        {/* ── TOOLBAR ── */}
        <Box sx={{ ...collapsibleSx, flexShrink: 0 }}>
          <GazeboToolbar
            stats={STUB_STATS}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
          />
        </Box>

        {/*
         * Main area: 3-column grid
         *   col 0 — left panel  (260px, collapses in focus mode)
         *   col 1 — center+bottom (1fr)
         *   col 2 — right panel (268px, collapses in focus mode)
         */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: focusMode ? "0px 1fr 0px" : "260px 1fr 268px",
            minHeight: 0,
            overflow: "hidden",
            transition: `grid-template-columns ${GRID_DURATION} ${GRID_EASING}`,
          }}
        >
          {/* ── LEFT PANEL ── */}
          <Box
            sx={{
              borderRight: "1px solid #21262d",
              ...collapsibleSx,
            }}
          >
            <LeftPanel />
          </Box>

          {/*
           * Center column: 2-row grid
           *   row 0 — 3D viewport (1fr)
           *   row 1 — bottom panel (230px, collapses in focus mode)
           */}
          <Box
            sx={{
              display: "grid",
              gridTemplateRows: focusMode ? "1fr 0px" : "1fr 230px",
              minHeight: 0,
              overflow: "hidden",
              transition: `grid-template-rows ${GRID_DURATION} ${GRID_EASING}`,
            }}
          >
            {/* ── CENTER VIEWPORT ── */}
            <CenterViewport
              websocketUrl={config.websocketUrl}
              focusMode={focusMode}
              onExitFocus={() => setFocusMode(false)}
            />

            {/* ── BOTTOM PANEL (placeholder — replaced in Commit 7) ── */}
            <Box
              sx={{
                bgcolor: "#0d1117",
                borderTop: "1px solid #21262d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...collapsibleSx,
              }}
            >
              <Box sx={{ color: "#6e7681", fontSize: 10, letterSpacing: 1 }}>BOTTOM PANEL</Box>
            </Box>
          </Box>

          {/* ── RIGHT PANEL ── */}
          <Box
            sx={{
              borderLeft: "1px solid #21262d",
              ...collapsibleSx,
            }}
          >
            <RightPanel />
          </Box>
        </Box>

        {/* ── STATUS BAR (placeholder — replaced in Commit 7) ── */}
        <Box
          sx={{
            bgcolor: "#161b22",
            borderTop: "1px solid #21262d",
            display: "flex",
            alignItems: "center",
            px: 1.5,
            flexShrink: 0,
            ...collapsibleSx,
          }}
        >
          <Box sx={{ color: "#6e7681", fontSize: 10, letterSpacing: 1 }}>
            STATUS BAR — placeholder
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

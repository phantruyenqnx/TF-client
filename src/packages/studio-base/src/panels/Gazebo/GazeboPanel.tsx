// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { DeepPartial } from "ts-essentials";

import { SettingsTreeAction, SettingsTreeNodes } from "@tf/studio";
import Stack from "@tf/studio-base/components/Stack";
import ThemeProvider from "@tf/studio-base/theme/ThemeProvider";

import type { PanelExtensionContext } from "@tf/studio";
import type { SceneManager } from "gzweb";

type SceneManagerInstance = SceneManager;

type Config = {
  websocketUrl: string;
};

const DEFAULT_CONFIG: Config = {
  websocketUrl: "ws://localhost:9002",
};

const useStyles = makeStyles()((theme) => {
  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "#1c1e2a" : "#ffffff";
  const textPrimary = isDark ? "#e8eaf6" : "#1a1a2e";
  const textMuted = isDark ? "#607d8b" : "#9e9e9e";
  const divider = isDark ? "#2a2d3e" : "#e0e0e0";

  return {
    statsBar: {
      backgroundColor: cardBg,
      borderTop: `1px solid ${divider}`,
      padding: theme.spacing(0.5, 1),
      minHeight: "40px",
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(2),
      flexShrink: 0,
    },
    statsCell: {
      flex: "1 1 120px",
      padding: theme.spacing(0.5, 0.75),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      borderRight: `1px solid rgba(128,128,128,0.15)`,
      minWidth: 0,
      "&:last-child": {
        borderRight: "none",
      },
    },
    statsLabel: {
      fontSize: "9px",
      color: textMuted,
      letterSpacing: "0.5px",
      whiteSpace: "nowrap",
      textTransform: "uppercase",
    },
    statsValue: {
      fontSize: "13px",
      fontWeight: 600,
      color: textPrimary,
      fontFamily: theme.typography.fontMonospace,
      whiteSpace: "nowrap",
    },
  };
});

function buildSettingsTree(config: Config): SettingsTreeNodes {
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

type TimeData = {
  sec: number;
  nsec: number;
};

type WorldStats = {
  simTime: TimeData | null;
  realTime: TimeData | null;
  realtimeFactor: number;
};

function formatTime(time: TimeData | null): string {
  if (!time) {
    return "--:--:--.---";
  }

  const totalSeconds = time.sec + time.nsec / 1e9;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((time.nsec % 1e9) / 1e6);

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

type Props = {
  context: PanelExtensionContext;
};

export function GazeboPanel({ context }: Props): JSX.Element {
  const { saveState } = context;
  const { classes } = useStyles();

  const [config, setConfig] = useState<Config>(() => {
    const partial = context.initialState as DeepPartial<Config>;
    return {
      websocketUrl: partial.websocketUrl ?? DEFAULT_CONFIG.websocketUrl,
    };
  });

  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [worldStats, setWorldStats] = useState<WorldStats>({
    simTime: null,
    realTime: null,
    realtimeFactor: 0,
  });

  const sceneElementRef = useRef<HTMLDivElement | null>(null);
  const sceneMgrRef = useRef<SceneManagerInstance | null>(null);
  const statsTopicNameRef = useRef<string | null>(null);

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action !== "update") {
      return;
    }
    const { path, value } = action.payload;
    if (path[1] === "websocketUrl" && typeof value === "string") {
      setConfig((prev) => ({ ...prev, websocketUrl: value }));
    }
  }, []);

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

  // Connect / reconnect when the URL or the container element changes
  useEffect(() => {
    if (!sceneElementRef.current) {
      return;
    }

    // Give the container element a stable id for SceneManager to attach to
    const elementId = "gz-scene-panel";
    sceneElementRef.current.id = elementId;

    let sceneMgr: SceneManagerInstance;

    // Dynamic import to avoid bundling the heavy lib at top level
    void import("gzweb").then((gzweb) => {
      if (!sceneElementRef.current) {
        return;
      }
      const { SceneManager, Topic } = gzweb as any;
      sceneMgr = new SceneManager({
        elementId,
        websocketUrl: config.websocketUrl,
      });
      sceneMgrRef.current = sceneMgr;

      // Subscribe to world stats when the connection is ready
      const readySub = (sceneMgr as any).getConnectionStatusAsObservable().subscribe((ready: boolean) => {
        if (ready && sceneMgr) {
          // Access the transport to get the world name
          const transport = (sceneMgr as any).transport;
          if (transport) {
            const worldName = transport.getWorld();
            if (worldName) {
              const statsTopicName = `/world/${worldName}/stats`;
              const statsTopic = new Topic(
                statsTopicName,
                (msg: any) => {
                  setWorldStats({
                    simTime: msg.sim_time ?? null,
                    realTime: msg.real_time ?? null,
                    realtimeFactor: msg.real_time_factor ?? 0,
                  });
                }
              );
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
  }, [config.websocketUrl]);

  // Handle panel resize
  useEffect(() => {
    const sceneElement = sceneElementRef.current;
    if (!sceneElement) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const sceneMgr = sceneMgrRef.current;
      if (sceneMgr && (sceneMgr as any).scene) {
        // Get the new dimensions from the container
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          // Update the scene size
          (sceneMgr as any).scene.setSize(width, height);
        }
      }
    });

    resizeObserver.observe(sceneElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack fullHeight>
        <div
          ref={sceneElementRef}
          style={{ width: "100%", flex: 1, overflow: "hidden", background: "#000" }}
        />
        <div className={classes.statsBar}>
          <div className={classes.statsCell}>
            <span className={classes.statsLabel}>SIM TIME</span>
            <span className={classes.statsValue}>{formatTime(worldStats.simTime)}</span>
          </div>
          <div className={classes.statsCell}>
            <span className={classes.statsLabel}>REAL TIME</span>
            <span className={classes.statsValue}>{formatTime(worldStats.realTime)}</span>
          </div>
          <div className={classes.statsCell}>
            <span className={classes.statsLabel}>RTF</span>
            <span className={classes.statsValue}>
              {worldStats.realtimeFactor > 0 ? worldStats.realtimeFactor.toFixed(2) : "--"}x
            </span>
          </div>
        </div>
      </Stack>
    </ThemeProvider>
  );
}

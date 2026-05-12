// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Tooltip,
} from "@mui/material";
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
    toolbar: {
      backgroundColor: cardBg,
      borderBottom: `1px solid ${divider}`,
      padding: theme.spacing(0.5, 1),
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      flexWrap: "wrap",
      flexShrink: 0,
      minHeight: 44,
    },
    toolbarSection: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.5),
    },
    toolbarSpacer: {
      flex: "1 1 auto",
    },
    toolbarPlaceholder: {
      color: textMuted,
      fontSize: "12px",
      fontStyle: "italic",
    },
    cameraSelect: {
      minWidth: 140,
    },
    entitySelect: {
      minWidth: 160,
    },
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
    rtfLow: {
      color: theme.palette.error.main,
    },
    rtfHigh: {
      color: theme.palette.success.main,
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
  paused: boolean;
};

type CameraMode = "orbit" | "follow" | "thirdPerson";

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
    paused: false,
  });
  // Connection readiness drives the toolbar: until the SceneManager
  // has handshaken with gz-bridge we cannot call any control RPCs.
  const [connected, setConnected] = useState(false);
  // Model names populated from sceneMgr.getModels() on every
  // connection-status emission. The entity picker reads this list.
  const [models, setModels] = useState<string[]>([]);
  const [cameraMode, setCameraMode] = useState<CameraMode>("orbit");
  const [selectedEntity, setSelectedEntity] = useState<string>("");

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
                    paused: msg.paused ?? false,
                  });
                }
              );
              (sceneMgr as any).subscribeToTopic(statsTopic);
              statsTopicNameRef.current = statsTopicName;
            }
          }
        }
        setConnected(ready);
        if (ready && sceneMgr) {
          // Pull the (possibly still-empty) model list and surface
          // names to the entity picker. The list grows as scene/info
          // populates the SceneManager; per the task brief we only
          // refresh on connection-status emissions.
          const list = (sceneMgr as any).getModels?.() ?? [];
          const names: string[] = list
            .map((m: any) => (typeof m === "string" ? m : (m?.name ?? "")))
            .filter((n: string) => n !== "");
          setModels(names);
        } else {
          setModels([]);
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

  // --- Control-bar action handlers --------------------------------
  // worldName is read fresh inside each handler because the active
  // world can change on reconnect; caching it in state would risk
  // dispatching control RPCs against a stale world string.
  const handlePlay = useCallback(() => {
    const sceneMgr = sceneMgrRef.current as any;
    const transport = sceneMgr?.transport;
    const worldName = transport?.getWorld?.();
    if (transport == undefined || worldName == undefined || worldName === "") {
      return;
    }
    transport.requestService(
      `/world/${worldName}/control`,
      "gz.msgs.WorldControl",
      { pause: false },
    );
  }, []);

  const handlePause = useCallback(() => {
    const sceneMgr = sceneMgrRef.current as any;
    const transport = sceneMgr?.transport;
    const worldName = transport?.getWorld?.();
    if (transport == undefined || worldName == undefined || worldName === "") {
      return;
    }
    transport.requestService(
      `/world/${worldName}/control`,
      "gz.msgs.WorldControl",
      { pause: true },
    );
  }, []);

  const handleReset = useCallback(() => {
    const sceneMgr = sceneMgrRef.current as any;
    const transport = sceneMgr?.transport;
    const worldName = transport?.getWorld?.();
    if (transport == undefined || worldName == undefined || worldName === "") {
      return;
    }
    transport.requestService(
      `/world/${worldName}/control`,
      "gz.msgs.WorldControl",
      { reset: { all: true } },
    );
  }, []);

  const handleStep = useCallback(() => {
    const sceneMgr = sceneMgrRef.current as any;
    const transport = sceneMgr?.transport;
    const worldName = transport?.getWorld?.();
    if (transport == undefined || worldName == undefined || worldName === "") {
      return;
    }
    transport.requestService(
      `/world/${worldName}/control`,
      "gz.msgs.WorldControl",
      { multi_step: 1 },
    );
  }, []);

  // Apply a (mode, entity) pair to the scene. Centralised so both
  // the mode dropdown and the entity dropdown share the same
  // dispatch path.
  const applyCameraSelection = useCallback((mode: CameraMode, entity: string) => {
    const sceneMgr = sceneMgrRef.current as any;
    if (sceneMgr == undefined) {
      return;
    }
    if (mode === "orbit") {
      sceneMgr.resetView?.();
      return;
    }
    if (entity === "") {
      // No-op until the user picks an entity; the dropdown will
      // still reflect the mode so the picker stays visible.
      return;
    }
    if (mode === "follow") {
      sceneMgr.follow?.(entity);
    } else {
      sceneMgr.thirdPersonFollow?.(entity);
    }
  }, []);

  const handleCameraModeChange = useCallback(
    (e: SelectChangeEvent<CameraMode>) => {
      const mode = e.target.value as CameraMode;
      setCameraMode(mode);
      applyCameraSelection(mode, selectedEntity);
    },
    [applyCameraSelection, selectedEntity],
  );

  const handleEntityChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      const entity = e.target.value;
      setSelectedEntity(entity);
      applyCameraSelection(cameraMode, entity);
    },
    [applyCameraSelection, cameraMode],
  );

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  const rtf = worldStats.realtimeFactor;
  // Per phase1 §11.1.a: red when sim is dragging, green when nearly
  // real-time, otherwise the default monospace stat colour. RTF=0
  // means we have no measurement yet — leave it neutral.
  let rtfClass = classes.statsValue;
  if (rtf > 0 && rtf < 0.5) {
    rtfClass = `${classes.statsValue} ${classes.rtfLow}`;
  } else if (rtf >= 0.9) {
    rtfClass = `${classes.statsValue} ${classes.rtfHigh}`;
  }

  const showEntityPicker = cameraMode !== "orbit";

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack fullHeight>
        <div className={classes.toolbar}>
          {!connected ? (
            <span className={classes.toolbarPlaceholder}>Connecting…</span>
          ) : (
            <>
              <div className={classes.toolbarSection}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handlePlay}
                  disabled={!worldStats.paused}
                >
                  ▶ Play
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handlePause}
                  disabled={worldStats.paused}
                >
                  ⏸ Pause
                </Button>
                <Tooltip title="Resets sim clock and model poses. Spawned model starting positions may not fully reset depending on Gazebo version.">
                  <span>
                    <Button size="small" variant="outlined" onClick={handleReset}>
                      ↺ Reset
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleStep}
                  disabled={!worldStats.paused}
                >
                  ⏭ Step
                </Button>
              </div>
              <span className={classes.toolbarSpacer} />
              <div className={classes.toolbarSection}>
                <FormControl size="small" className={classes.cameraSelect}>
                  <InputLabel id="gz-camera-mode-label">Camera</InputLabel>
                  <Select
                    labelId="gz-camera-mode-label"
                    label="Camera"
                    value={cameraMode}
                    onChange={handleCameraModeChange}
                  >
                    <MenuItem value="orbit">Orbit</MenuItem>
                    <MenuItem value="follow">Follow</MenuItem>
                    <MenuItem value="thirdPerson">Third-person</MenuItem>
                  </Select>
                </FormControl>
                {showEntityPicker && (
                  <FormControl size="small" className={classes.entitySelect}>
                    <InputLabel id="gz-entity-label">Entity</InputLabel>
                    <Select
                      labelId="gz-entity-label"
                      label="Entity"
                      value={selectedEntity}
                      onChange={handleEntityChange}
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        Select entity…
                      </MenuItem>
                      {models.map((name) => (
                        <MenuItem key={name} value={name}>
                          {name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </div>
            </>
          )}
        </div>
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
            <span className={rtfClass}>
              {rtf > 0 ? rtf.toFixed(2) : "--"}x
            </span>
          </div>
        </div>
      </Stack>
    </ThemeProvider>
  );
}

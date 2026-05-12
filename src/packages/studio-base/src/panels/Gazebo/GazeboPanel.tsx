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
import * as THREE from "three";
import { makeStyles } from "tss-react/mui";
import { DeepPartial } from "ts-essentials";

import { SettingsTreeAction, SettingsTreeNodes } from "@tf/studio";
import Stack from "@tf/studio-base/components/Stack";
import ThemeProvider from "@tf/studio-base/theme/ThemeProvider";

import type { PanelExtensionContext } from "@tf/studio";
import type { SceneManager } from "gzweb";

import { GazeboModelTree, ModelInfo } from "./GazeboModelTree";

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
    sceneRow: {
      flex: 1,
      display: "flex",
      flexDirection: "row",
      overflow: "hidden",
      minHeight: 0,
    },
    sceneContainer: {
      flex: 1,
      overflow: "hidden",
      background: "#000",
      minWidth: 0,
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

  // --- Model-tree sidebar state (M3-FE-7) ---------------------------
  // Tree is rebuilt from transport.sceneInfo$ on every scene
  // re-broadcast (one shot per connect, plus add/remove if the
  // bridge re-emits). Joint angles stream in via the world-level
  // joint_state topic and are keyed `${modelName}/${jointName}` so
  // they survive multi-vehicle scenes (phase1 §11.1.d).
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [tree, setTree] = useState<ModelInfo[]>([]);
  const [worldName, setWorldName] = useState<string>("");
  const [expandedModels, setExpandedModels] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [axesEnabled, setAxesEnabled] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [jointAngles, setJointAngles] = useState<Map<string, number>>(
    () => new Map<string, number>(),
  );

  const sceneElementRef = useRef<HTMLDivElement | null>(null);
  const sceneMgrRef = useRef<SceneManagerInstance | null>(null);
  const statsTopicNameRef = useRef<string | null>(null);
  const jointStateTopicNameRef = useRef<string | null>(null);
  // Live coordinate-frame helpers parented to the link Object3D in
  // the gz3d scene. We deliberately do NOT subscribe to
  // /world/<w>/dynamic_pose/info ourselves: SceneManager already
  // subscribes to that topic and calls scene.setPose() on every
  // named entity each sim tick, so an AxesHelper added as a child
  // of the link inherits the pose for free. One source of truth,
  // zero duplicate traffic.
  const axesHelpersRef = useRef<Map<string, THREE.AxesHelper>>(new Map());

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
    let sceneInfoSub: { unsubscribe: () => void } | undefined;
    let readySub: { unsubscribe: () => void } | undefined;

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

      // Subscribe to sceneInfo$ to build the model-tree sidebar.
      // sceneInfo$ emits the full gz.msgs.Scene on connect and
      // again whenever the bridge re-broadcasts. We rebuild the
      // shallow tree state from scratch on each emission — the
      // payload is small (a few dozen models max in Phase 1) and
      // this keeps the reducer trivial.
      sceneInfoSub = (sceneMgr as any).transport?.sceneInfo$?.subscribe?.(
        (info: any) => {
          if (info == undefined) {
            setTree([]);
            return;
          }
          const next: ModelInfo[] = ((info.model as any[]) ?? []).map(
            (m: any) => ({
              name: String(m?.name ?? ""),
              links: ((m?.link as any[]) ?? []).map((l: any) => ({
                name: String(l?.name ?? ""),
              })),
              joints: ((m?.joint as any[]) ?? []).map((j: any) => ({
                name: String(j?.name ?? ""),
                parent: j?.parent != undefined ? String(j.parent) : undefined,
                child: j?.child != undefined ? String(j.child) : undefined,
              })),
            }),
          );
          setTree(next);
          // Auto-expand the first model so the tree is useful on
          // the first connect without the user having to click.
          if (next.length > 0) {
            const firstName = next[0]!.name;
            setExpandedModels((prev) => {
              if (prev.has(firstName)) {
                return prev;
              }
              const copy = new Set(prev);
              copy.add(firstName);
              return copy;
            });
          }
        },
      );

      // Subscribe to world stats when the connection is ready
      readySub = (sceneMgr as any).getConnectionStatusAsObservable().subscribe((ready: boolean) => {
        if (ready && sceneMgr) {
          // Access the transport to get the world name
          const transport = (sceneMgr as any).transport;
          if (transport) {
            const currentWorld = transport.getWorld();
            if (currentWorld) {
              setWorldName(currentWorld);
              const statsTopicName = `/world/${currentWorld}/stats`;
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

              // World-level joint_state from JointStatePublisher
              // (M3-BE-2). One subscription covers every model in
              // the world — the bridge emits one gz.msgs.Model
              // message per model per cycle, each containing all
              // of that model's joints. We accept multiple shapes
              // because the gz-msgs JSON encoding for Joint angles
              // has shifted between gz-sim releases.
              const jointTopicName = `/world/${currentWorld}/joint_state`;
              const jointTopic = new Topic(jointTopicName, (msg: any) => {
                const modelName: string =
                  typeof msg?.name === "string" ? msg.name : "";
                if (modelName === "") {
                  return;
                }
                const joints: any[] = Array.isArray(msg?.joint)
                  ? msg.joint
                  : [];
                if (joints.length === 0) {
                  return;
                }
                setJointAngles((prev) => {
                  const next = new Map(prev);
                  for (const j of joints) {
                    const jointName: string =
                      typeof j?.name === "string" ? j.name : "";
                    if (jointName === "") {
                      continue;
                    }
                    // Preferred shape (gz-sim 8 + gz-msgs 10):
                    //   joint.axis1.position : double (radians)
                    // Legacy shape that the M3-FE-7 brief documents:
                    //   joint.angle[0].radian : double
                    let angle: number | undefined;
                    if (typeof j?.axis1?.position === "number") {
                      angle = j.axis1.position;
                    } else if (typeof j?.axis_1?.position === "number") {
                      angle = j.axis_1.position;
                    } else if (
                      Array.isArray(j?.angle) &&
                      typeof j.angle[0]?.radian === "number"
                    ) {
                      angle = j.angle[0].radian;
                    } else if (typeof j?.angle === "number") {
                      angle = j.angle;
                    }
                    if (angle != undefined) {
                      next.set(`${modelName}/${jointName}`, angle);
                    }
                  }
                  return next;
                });
              });
              // Transport.subscribe crashes when the topic isn't in
              // availableTopics yet (reads publisher['msg_type'] on undefined).
              // joint_state is advertised after scene/info, so bypass the
              // availableTopics lookup and send the 'sub' frame directly.
              const transport = (sceneMgr as any).transport;
              if (
                transport?.topicMap != undefined &&
                typeof transport.sendMessage === "function"
              ) {
                transport.topicMap.set(jointTopicName, jointTopic);
                transport.sendMessage(["sub", jointTopicName, "", ""]);
              } else {
                (sceneMgr as any).subscribeToTopic(jointTopic);
              }
              jointStateTopicNameRef.current = jointTopicName;
            }
          }
        }
        setConnected(ready);
        if (!ready) {
          setWorldName("");
          setJointAngles(new Map());
        }
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

    });

    return () => {
      if (statsTopicNameRef.current && sceneMgr) {
        (sceneMgr as any).unsubscribeFromTopic(statsTopicNameRef.current);
        statsTopicNameRef.current = null;
      }
      if (jointStateTopicNameRef.current && sceneMgr) {
        (sceneMgr as any).unsubscribeFromTopic(jointStateTopicNameRef.current);
        jointStateTopicNameRef.current = null;
      }
      sceneInfoSub?.unsubscribe();
      readySub?.unsubscribe();
      // Detach and dispose every coordinate-frame helper still
      // parented to the soon-to-be-torn-down scene. THREE leaks
      // GPU memory if AxesHelper.geometry / .material are not
      // disposed on unmount.
      for (const helper of axesHelpersRef.current.values()) {
        helper.parent?.remove(helper);
        helper.geometry.dispose();
        const mat = helper.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(mat)) {
          for (const m of mat) {
            m.dispose();
          }
        } else if (mat) {
          mat.dispose();
        }
      }
      axesHelpersRef.current.clear();
      setAxesEnabled(new Set());
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

  // --- Sidebar / tree handlers (M3-FE-7) --------------------------
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleToggleModel = useCallback((modelName: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelName)) {
        next.delete(modelName);
      } else {
        next.add(modelName);
      }
      return next;
    });
  }, []);

  const handleToggleLink = useCallback(
    (modelName: string, linkName: string) => {
      const key = `${modelName}/${linkName}`;
      setExpandedLinks((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  // Add or remove a coordinate-frame helper for a single link.
  //
  // We parent the AxesHelper directly to the link's THREE.Object3D
  // inside the gz3d scene. SceneManager already subscribes to
  // /world/<w>/dynamic_pose/info and calls scene.setPose() on every
  // named entity each sim tick, so any child Object3D inherits the
  // updated pose automatically. This avoids duplicating that
  // subscription in the panel.
  //
  // gz3d's naming convention is not perfectly stable across gz-sim
  // releases — the SDF parser has used `link`, `model/link` and
  // `model::link` at different points. We try all three before
  // giving up, so the overlay works regardless of how SceneManager
  // happens to label the Object3D in the current world.
  const handleToggleAxes = useCallback(
    (modelName: string, linkName: string, on: boolean) => {
      const key = `${modelName}/${linkName}`;
      const sceneMgr = sceneMgrRef.current as any;
      const scene = sceneMgr?.scene;
      if (scene == undefined) {
        return;
      }

      if (on) {
        if (axesHelpersRef.current.has(key)) {
          return;
        }
        const candidates = [
          `${modelName}/${linkName}`,
          `${modelName}::${linkName}`,
          linkName,
        ];
        let parent: THREE.Object3D | undefined;
        for (const candidate of candidates) {
          const obj = scene.getByName?.(candidate) as
            | THREE.Object3D
            | undefined;
          if (obj != undefined) {
            parent = obj;
            break;
          }
        }
        if (parent == undefined) {
          // eslint-disable-next-line no-console
          console.warn(
            `[GazeboPanel] No scene object found for link ${key}; ` +
              `tried ${candidates.join(", ")}`,
          );
          return;
        }
        const helper = new THREE.AxesHelper(0.25);
        helper.name = `_tfAxes_${key}`;
        parent.add(helper);
        axesHelpersRef.current.set(key, helper);
        setAxesEnabled((prev) => {
          const nextSet = new Set(prev);
          nextSet.add(key);
          return nextSet;
        });
      } else {
        const helper = axesHelpersRef.current.get(key);
        if (helper != undefined) {
          helper.parent?.remove(helper);
          helper.geometry.dispose();
          const mat = helper.material as
            | THREE.Material
            | THREE.Material[]
            | undefined;
          if (Array.isArray(mat)) {
            for (const m of mat) {
              m.dispose();
            }
          } else if (mat) {
            mat.dispose();
          }
        }
        axesHelpersRef.current.delete(key);
        setAxesEnabled((prev) => {
          if (!prev.has(key)) {
            return prev;
          }
          const nextSet = new Set(prev);
          nextSet.delete(key);
          return nextSet;
        });
      }
    },
    [],
  );

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
        <div className={classes.sceneRow}>
          <GazeboModelTree
            open={sidebarOpen}
            worldName={worldName}
            tree={tree}
            expandedModels={expandedModels}
            expandedLinks={expandedLinks}
            axesEnabled={axesEnabled}
            jointAngles={jointAngles}
            onToggleSidebar={handleToggleSidebar}
            onToggleModel={handleToggleModel}
            onToggleLink={handleToggleLink}
            onToggleAxes={handleToggleAxes}
          />
          <div ref={sceneElementRef} className={classes.sceneContainer} />
        </div>
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

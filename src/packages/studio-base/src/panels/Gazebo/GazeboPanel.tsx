// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type Props = {
  context: PanelExtensionContext;
};

export function GazeboPanel({ context }: Props): JSX.Element {
  const { saveState } = context;

  const [config, setConfig] = useState<Config>(() => {
    const partial = context.initialState as DeepPartial<Config>;
    return {
      websocketUrl: partial.websocketUrl ?? DEFAULT_CONFIG.websocketUrl,
    };
  });

  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const sceneElementRef = useRef<HTMLDivElement | null>(null);
  const sceneMgrRef = useRef<SceneManagerInstance | null>(null);

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
    void import("gzweb").then(({ SceneManager }) => {
      if (!sceneElementRef.current) {
        return;
      }
      sceneMgr = new SceneManager({
        elementId,
        websocketUrl: config.websocketUrl,
      });
      sceneMgrRef.current = sceneMgr;
    });

    return () => {
      if (sceneMgr) {
        sceneMgr.disconnect();
      }
      sceneMgrRef.current = null;
    };
  }, [config.websocketUrl]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack fullHeight>
        <div
          ref={sceneElementRef}
          style={{ width: "100%", height: "100%", overflow: "hidden", background: "#000" }}
        />
      </Stack>
    </ThemeProvider>
  );
}

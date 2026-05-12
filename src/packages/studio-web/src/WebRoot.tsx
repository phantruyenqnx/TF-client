// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo, useState } from "react";

import {
  AppBarProps,
  AppSetting,
  IDataSourceFactory,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  RemoteDataSourceFactory,
  TFWebSocketDataSourceFactory,
  UlogLocalDataSourceFactory,
  McapLocalDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  SharedRoot,
} from "@tf/studio-base";
import CssBaseline from "@tf/studio-base/components/CssBaseline";
import ThemeProvider from "@tf/studio-base/theme/ThemeProvider";

import { Welcome } from "./screens/Welcome/Welcome";
import LocalStorageAppConfiguration from "./services/LocalStorageAppConfiguration";

const isDevelopment = process.env.NODE_ENV === "development";

// Phase 1 routing is a plain state machine, not React Router — see
// phase1.md §11.6 and the M3-FE-1 task brief. The Welcome screen runs
// before SharedRoot is mounted (SharedRoot is part of the cockpit
// shell), so Welcome needs its own ThemeProvider + CssBaseline wrap.
type View = "welcome" | "cockpit";

export function WebRoot(props: {
  extraProviders: JSX.Element[] | undefined;
  dataSources: IDataSourceFactory[] | undefined;
  AppBarComponent?: (props: AppBarProps) => JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  const appConfiguration = useMemo(
    () =>
      new LocalStorageAppConfiguration({
        defaults: {
          [AppSetting.SHOW_DEBUG_PANELS]: isDevelopment,
        },
      }),
    [],
  );

  const dataSources = useMemo(() => {
    const sources = [
      new Ros1LocalBagDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new TFWebSocketDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new SampleNuscenesDataSourceFactory(),
      new McapLocalDataSourceFactory(),
      new RemoteDataSourceFactory(),
    ];

    return props.dataSources ?? sources;
  }, [props.dataSources]);

  const [view, setView] = useState<View>("welcome");
  // The selected project_id is stashed here so M3-FE-3 (Session Config)
  // can lift it out of state when it lands. The cockpit itself does
  // not consume it yet.
  const [, setActiveProjectId] = useState<string | undefined>(undefined);

  const handleOpenProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setView("cockpit");
  }, []);

  if (view === "welcome") {
    return (
      <ThemeProvider isDark>
        <CssBaseline>
          <Welcome onOpenProject={handleOpenProject} />
        </CssBaseline>
      </ThemeProvider>
    );
  }

  return (
    <SharedRoot
      enableLaunchPreferenceScreen
      deepLinks={[window.location.href]}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      enableGlobalCss
      extraProviders={props.extraProviders}
      AppBarComponent={props.AppBarComponent}
    >
      {props.children}
    </SharedRoot>
  );
}

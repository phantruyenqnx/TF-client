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

import { CreateProject } from "./screens/CreateProject";
import { SessionConfig } from "./screens/SessionConfig";
import { Welcome } from "./screens/Welcome/Welcome";
import LocalStorageAppConfiguration from "./services/LocalStorageAppConfiguration";

const isDevelopment = process.env.NODE_ENV === "development";

// Phase 1 routing is a plain state machine, not React Router — see
// phase1.md §11.6 and the M3-FE-1 task brief. The Welcome screen and
// CreateProject screen run before SharedRoot is mounted (SharedRoot is
// part of the cockpit shell), so the pre-cockpit screens share a
// single ThemeProvider + CssBaseline wrap mounted here.
type View = "welcome" | "create-project" | "session-config" | "cockpit";

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
  // Project the user picked in Welcome. Consumed by SessionConfig to
  // load /api/v1/projects/{id}/config and POST a new session.
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);
  // session_id from the most recent successful POST /sessions, stored
  // for M3-FE-4 (Starting Services) to consume. The cockpit itself
  // does not read it yet.
  const [, setActiveSessionId] = useState<string | undefined>(undefined);

  // Open on a Welcome row no longer jumps straight to the cockpit —
  // it routes through SessionConfig so the user can review services
  // and start the SIL explicitly (phase1.md §11.6, Screen 3).
  const handleOpenProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setView("session-config");
  }, []);

  const handleGoToCreate = useCallback(() => {
    setView("create-project");
  }, []);

  const handleBackToWelcome = useCallback(() => {
    setView("welcome");
  }, []);

  const handleSessionStarted = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("cockpit");
  }, []);

  if (view === "welcome") {
    return (
      <ThemeProvider isDark>
        <CssBaseline>
          <Welcome onOpenProject={handleOpenProject} onCreateProject={handleGoToCreate} />
        </CssBaseline>
      </ThemeProvider>
    );
  }

  if (view === "create-project") {
    return (
      <ThemeProvider isDark>
        <CssBaseline>
          <CreateProject onBack={handleBackToWelcome} />
        </CssBaseline>
      </ThemeProvider>
    );
  }

  if (view === "session-config") {
    // activeProjectId is guaranteed to be set here because the only
    // path to this view is handleOpenProject, which sets it first.
    // The fallback keeps TypeScript happy and degrades safely if a
    // future change breaks that invariant.
    if (activeProjectId == undefined) {
      return (
        <ThemeProvider isDark>
          <CssBaseline>
            <Welcome onOpenProject={handleOpenProject} onCreateProject={handleGoToCreate} />
          </CssBaseline>
        </ThemeProvider>
      );
    }
    return (
      <ThemeProvider isDark>
        <CssBaseline>
          <SessionConfig
            projectId={activeProjectId}
            onBack={handleBackToWelcome}
            onSessionStarted={handleSessionStarted}
          />
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

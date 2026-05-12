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

import { TFShell } from "./components/TFShell";
import CockpitContext from "./context/CockpitContext";
import { CreateProject } from "./screens/CreateProject";
import { SessionConfig } from "./screens/SessionConfig";
import { StartingServices } from "./screens/StartingServices";
import { Welcome } from "./screens/Welcome/Welcome";
import LocalStorageAppConfiguration from "./services/LocalStorageAppConfiguration";

const isDevelopment = process.env.NODE_ENV === "development";

// Phase 1 routing is a plain state machine, not React Router — see
// phase1.md §11.6 and the M3-FE-1 task brief. The Welcome screen and
// CreateProject screen run before SharedRoot is mounted (SharedRoot is
// part of the cockpit shell), so the pre-cockpit screens share a
// single ThemeProvider + CssBaseline wrap mounted here.
type View = "welcome" | "create-project" | "session-config" | "starting-services" | "cockpit";

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
  // session_id from the most recent successful POST /sessions. Used
  // by StartingServices to open the status WebSocket.
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

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

  // Session has been created (POST /sessions returned 201) but its
  // services have not all reached "running" yet. Route to the
  // Starting Services screen which subscribes to the status WS.
  const handleSessionStarted = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("starting-services");
  }, []);

  // Every reported service is running — the StartingServices screen
  // hands control to the cockpit.
  const handleServicesReady = useCallback(() => {
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

  if (view === "starting-services") {
    // activeSessionId is set by handleSessionStarted before this view
    // is entered. Same defensive fallback as session-config.
    if (activeSessionId == undefined) {
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
          <StartingServices
            sessionId={activeSessionId}
            onServicesReady={handleServicesReady}
            onBack={handleBackToWelcome}
          />
        </CssBaseline>
      </ThemeProvider>
    );
  }

  // Cockpit branch: wrap SharedRoot in CockpitContext so the
  // TF-specific top bar (rendered via AppBarComponent) can read the
  // active project/session and trigger Stop/Restart navigations.
  // Falls back to the data-source picker when no session has been
  // started yet (defensive — the only path into this branch sets
  // both ids first).
  const cockpitValue =
    activeProjectId != undefined && activeSessionId != undefined
      ? {
          projectId: activeProjectId,
          sessionId: activeSessionId,
          onStop: handleBackToWelcome,
          onRestart: handleSessionStarted,
        }
      : undefined;
  // Honour an externally provided AppBarComponent if WebRoot's caller
  // passed one (e.g. desktop builds with custom window controls);
  // otherwise inject TFShell so the cockpit gets the TF top bar.
  const AppBarComponent = props.AppBarComponent ?? TFShell;

  return (
    <CockpitContext.Provider value={cockpitValue}>
      <SharedRoot
        enableLaunchPreferenceScreen
        deepLinks={[window.location.href]}
        dataSources={dataSources}
        appConfiguration={appConfiguration}
        enableGlobalCss
        extraProviders={props.extraProviders}
        AppBarComponent={AppBarComponent}
      >
        {props.children}
      </SharedRoot>
    </CockpitContext.Provider>
  );
}

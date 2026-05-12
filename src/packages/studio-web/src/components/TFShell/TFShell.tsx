// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// TFShell is the AppBarComponent injected into Foxglove's Workspace
// for the cockpit view. It renders the TF-specific top bar (project
// name, session state dot, Stop, Restart) ABOVE the original Foxglove
// app bar so the panel picker and sidebar toggles keep working —
// see phase1.md §11.6 (Screen 5) and §11.7.
//
// On first open for a given session, TFShell also installs the
// template's default layout (Phase 1 ships exactly one template:
// single_x500_offboard). Subsequent opens of the same session leave
// the user's edits in place. Detection is via a localStorage flag
// keyed on session id; Foxglove restores from its own keys on top
// of that.

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { AppBar, AppBarProps } from "@tf/studio-base/components/AppBar";
import CurrentLayoutContext, {
  LayoutData,
} from "@tf/studio-base/context/CurrentLayoutContext";

import { useCockpit } from "../../context/CockpitContext";
import singleX500OffboardLayout from "../../layouts/single_x500_offboard.json";

const API_BASE = "http://localhost:3000";
const SESSION_POLL_INTERVAL_MS = 5000;

// localStorage prefix used to detect first-open per session. The
// value stored is "1"; presence is what we check.
const FIRST_OPEN_KEY_PREFIX = "tf:default-layout-loaded:";

// Map template_id → built-in layout. Phase 1 only ships one template,
// so unknown ids fall back to the same layout per the task brief.
const LAYOUT_BY_TEMPLATE: Readonly<Record<string, LayoutData>> = {
  single_x500_offboard: singleX500OffboardLayout as LayoutData,
};
const FALLBACK_LAYOUT: LayoutData = singleX500OffboardLayout as LayoutData;

type ProjectInfo = {
  id: string;
  name: string;
  path: string;
  status: string;
};

type SessionInfo = {
  session_id: string;
  project_id: string;
  state: string;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  tfBar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    minHeight: 40,
    flexWrap: "wrap",
  },
  projectName: {
    fontWeight: 600,
  },
  spacer: {
    flex: "1 1 auto",
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.25, 1),
    borderRadius: 999,
    backgroundColor: theme.palette.action.hover,
    fontSize: theme.typography.caption.fontSize,
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
  },
  stateDotRunning: {
    backgroundColor: theme.palette.success.main,
  },
  stateDotStarting: {
    backgroundColor: theme.palette.warning.main,
  },
  stateDotFailed: {
    backgroundColor: theme.palette.error.main,
  },
  stateDotMuted: {
    backgroundColor: theme.palette.text.disabled,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
}));

export function TFShell(props: AppBarProps): JSX.Element {
  const { classes, cx } = useStyles();
  const cockpit = useCockpit();
  // Layout context is provided by Workspace in production. In tests
  // that mount AppBarComponent in isolation it may be undefined; we
  // tolerate that by skipping the default-layout install.
  const layoutCtx = useContext(CurrentLayoutContext);

  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [sessionState, setSessionState] = useState<string | undefined>(undefined);

  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"stop" | "restart" | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  // Fetch the project record once per project id.
  useEffect(() => {
    if (cockpit == undefined) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/projects/${encodeURIComponent(cockpit.projectId)}`,
        );
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as ProjectInfo;
        if (!cancelled) {
          setProjectName(body.name);
        }
      } catch {
        // Non-fatal: the top bar simply shows the project id as
        // fallback. Logging here would spam the console on repeated
        // network failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cockpit]);

  // Fetch the platform.yaml config once per project so we can pick
  // the right default layout. Phase 1 only ships one template, so a
  // failure here is non-fatal.
  useEffect(() => {
    if (cockpit == undefined) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/projects/${encodeURIComponent(cockpit.projectId)}/config`,
        );
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as { template_id?: string };
        if (!cancelled && typeof body.template_id === "string") {
          setTemplateId(body.template_id);
        }
      } catch {
        // ignore — see note above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cockpit]);

  // Poll session state every 5 s so the status dot stays current.
  useEffect(() => {
    if (cockpit == undefined) {
      return;
    }
    let cancelled = false;
    const fetchState = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/sessions/${encodeURIComponent(cockpit.sessionId)}`,
        );
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as SessionInfo;
        if (!cancelled) {
          setSessionState(body.state);
        }
      } catch {
        // ignore — keep last known state on transient failures.
      }
    };
    void fetchState();
    const handle = window.setInterval(() => {
      void fetchState();
    }, SESSION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [cockpit]);

  // First-open default layout install. Runs once per (session_id)
  // per browser thanks to the localStorage flag.
  const layoutInstalledRef = useRef(false);
  useEffect(() => {
    if (cockpit == undefined || layoutCtx == undefined) {
      return;
    }
    if (layoutInstalledRef.current) {
      return;
    }
    const key = `${FIRST_OPEN_KEY_PREFIX}${cockpit.sessionId}`;
    try {
      if (window.localStorage.getItem(key) === "1") {
        layoutInstalledRef.current = true;
        return;
      }
    } catch {
      // localStorage may be unavailable in private mode; fall through
      // and apply the layout anyway. Worse case: it gets re-applied
      // on the next mount.
    }
    const data = (templateId != undefined && LAYOUT_BY_TEMPLATE[templateId]) || FALLBACK_LAYOUT;
    layoutCtx.actions.setCurrentLayout({ data, name: templateId ?? "single_x500_offboard" });
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // see above
    }
    layoutInstalledRef.current = true;
  }, [cockpit, layoutCtx, templateId]);

  const handleStopRequested = useCallback(() => {
    setActionError(undefined);
    setStopConfirmOpen(true);
  }, []);

  const handleStopConfirm = useCallback(async () => {
    if (cockpit == undefined) {
      return;
    }
    setBusy("stop");
    setActionError(undefined);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/sessions/${encodeURIComponent(cockpit.sessionId)}/stop`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `POST stop failed: ${res.status}`);
      }
      setStopConfirmOpen(false);
      cockpit.onStop();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  }, [cockpit]);

  const handleRestart = useCallback(async () => {
    if (cockpit == undefined) {
      return;
    }
    setBusy("restart");
    setActionError(undefined);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/sessions/${encodeURIComponent(cockpit.sessionId)}/restart`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `POST restart failed: ${res.status}`);
      }
      const body = (await res.json()) as SessionInfo;
      // Wipe the first-open flag for the OLD session so a future
      // reopen with the same id (unlikely but cheap) re-installs the
      // template default. The NEW session id naturally has no flag
      // yet, so the StartingServices→cockpit path will install the
      // default layout when we land back in the cockpit.
      try {
        window.localStorage.removeItem(`${FIRST_OPEN_KEY_PREFIX}${cockpit.sessionId}`);
      } catch {
        // ignore
      }
      cockpit.onRestart(body.session_id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  }, [cockpit]);

  const stateLabel = sessionStateLabel(sessionState);
  const stateDotClass = sessionStateDotClass(sessionState, classes);

  return (
    <div className={classes.root}>
      {cockpit != undefined && (
        <div className={classes.tfBar}>
          <Typography variant="body2" className={classes.projectName}>
            {projectName ?? cockpit.projectId}
          </Typography>
          <Tooltip title={sessionState ?? "unknown"} placement="bottom-start">
            <span className={classes.statePill}>
              <span className={cx(classes.stateDot, stateDotClass)} aria-hidden />
              {stateLabel}
            </span>
          </Tooltip>
          {actionError != undefined && (
            <Typography variant="caption" color="error">
              {actionError}
            </Typography>
          )}
          <span className={classes.spacer} />
          <div className={classes.actions}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void handleRestart()}
              disabled={busy != undefined}
            >
              {busy === "restart" ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                "Restart"
              )}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={handleStopRequested}
              disabled={busy != undefined}
            >
              Stop
            </Button>
          </div>
        </div>
      )}

      <AppBar {...props} />

      <Dialog
        open={stopConfirmOpen}
        onClose={() => {
          if (busy !== "stop") {
            setStopConfirmOpen(false);
          }
        }}
      >
        <DialogTitle>Stop session?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will stop every running service for the current session and return you to the
            project picker. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setStopConfirmOpen(false);
            }}
            disabled={busy === "stop"}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleStopConfirm()}
            disabled={busy === "stop"}
          >
            {busy === "stop" ? <CircularProgress size={16} color="inherit" /> : "Stop session"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function sessionStateLabel(state: string | undefined): string {
  switch (state) {
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
    case undefined:
      return "…";
    default:
      return state;
  }
}

function sessionStateDotClass(
  state: string | undefined,
  classes: {
    stateDotRunning: string;
    stateDotStarting: string;
    stateDotFailed: string;
    stateDotMuted: string;
  },
): string {
  switch (state) {
    case "running":
      return classes.stateDotRunning;
    case "starting":
      return classes.stateDotStarting;
    case "failed":
      return classes.stateDotFailed;
    default:
      return classes.stateDotMuted;
  }
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Starting Services screen — phase1.md §9 (session states) + §11.6
// (Screen 4).
//
// Subscribes to the server's session status WebSocket
// (ws://.../ws/v1/sessions/{sessionId}/status), renders one row per
// enabled service with a live status icon + text, and auto-navigates
// the parent (WebRoot) to the cockpit once every reported service has
// reached "running". On failure the user stays on this screen so they
// can read the error and open the per-service details dialog.
//
// The list of services and which states they pass through is driven
// entirely by the WS stream — the snapshot the server emits on
// connect tells us exactly which services are enabled for this
// session, so we deliberately do not pre-seed the row list from the
// SessionConfig toggles.

import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

const API_BASE = "http://localhost:3000";
const WS_BASE = "ws://localhost:3000";

// Friendly service labels (mirrors SessionConfig). Kept in this file
// rather than imported because the two screens are otherwise
// independent; duplicating eight strings is cheaper than a shared
// constants module for now.
const SERVICE_LABELS: Readonly<Record<string, string>> = {
  px4_sitl: "PX4 SITL",
  gazebo: "Gazebo",
  gazebo_websocket: "Gazebo WebSocket",
  xrce_dds: "DDS Agent",
  ros2_workspace: "ROS2 Workspace",
  foxglove_bridge: "Foxglove Bridge",
  ros_gz_bridge: "ROS/Gazebo Bridge",
  mavlink_service: "MAVLink Service",
};

// Status string → display props. Unknown strings fall through to a
// neutral grey row with the raw value rendered verbatim (server can
// add new states without crashing the UI).
type StatusKind = "pending" | "starting" | "running" | "failed" | "stopped" | "skipped";

type StatusEvent = {
  session_id?: string;
  service: string;
  status: string;
  error?: string;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    paddingBlock: theme.spacing(6),
  },
  header: {
    marginBottom: theme.spacing(3),
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    flexWrap: "wrap",
  },
  rowMain: {
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  rowName: {
    fontWeight: 600,
  },
  rowError: {
    color: theme.palette.error.main,
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.5),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusCell: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 140,
  },
  iconPending: {
    color: theme.palette.text.disabled,
    fontSize: 18,
    lineHeight: 1,
  },
  iconStopped: {
    color: theme.palette.text.disabled,
    fontSize: 18,
    lineHeight: 1,
  },
  iconRunning: {
    color: theme.palette.success.main,
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 700,
  },
  iconFailed: {
    color: theme.palette.error.main,
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 700,
  },
  iconStarting: {
    color: theme.palette.warning.main,
  },
  textRunning: {
    color: theme.palette.success.main,
    fontWeight: 600,
  },
  textFailed: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  textStarting: {
    color: theme.palette.warning.main,
  },
  textMuted: {
    color: theme.palette.text.secondary,
  },
  emptyMessage: {
    color: theme.palette.text.secondary,
    paddingBlock: theme.spacing(4),
    textAlign: "center",
  },
  footer: {
    marginTop: theme.spacing(3),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  dialogError: {
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.body2.fontSize,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  alertSpaced: {
    marginTop: theme.spacing(2),
  },
}));

export type StartingServicesProps = {
  /** Session created by the SessionConfig POST. Drives the WS URL. */
  sessionId: string;
  /** Called once every reported service reaches "running". WebRoot
   * advances to the cockpit. */
  onServicesReady: () => void;
  /** Used by the "Stop session" link after a successful POST stop. */
  onBack: () => void;
};

export function StartingServices({
  sessionId,
  onServicesReady,
  onBack,
}: StartingServicesProps): JSX.Element {
  const { classes } = useStyles();

  // Live status map. Keyed by service name. Empty on mount; first
  // entries arrive as the server-side snapshot on connect.
  const [services, setServices] = useState<Record<string, StatusEvent>>({});
  // True after the WS has closed without us having auto-navigated.
  const [connectionLost, setConnectionLost] = useState(false);
  // Dialog: shows the error text for one failed service. undefined =
  // dialog hidden.
  const [logsForService, setLogsForService] = useState<string | undefined>(undefined);
  // Stop-session request status.
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | undefined>(undefined);

  // We use refs to avoid stale-closure issues inside the WebSocket
  // callbacks (which are bound once at mount). The "ready fired" flag
  // guards against onServicesReady being called multiple times if more
  // events arrive in the same tick that flipped the last service to
  // running.
  const readyFiredRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const onServicesReadyRef = useRef(onServicesReady);
  useEffect(() => {
    onServicesReadyRef.current = onServicesReady;
  }, [onServicesReady]);

  useEffect(() => {
    const url = `${WS_BASE}/ws/v1/sessions/${encodeURIComponent(sessionId)}/status`;
    const ws = new WebSocket(url);

    ws.onmessage = (msg: MessageEvent<string>) => {
      let event: StatusEvent;
      try {
        event = JSON.parse(msg.data) as StatusEvent;
      } catch {
        // Malformed frame — server contract violation. Skip the event
        // rather than crash; the WS will get cleaned up by the close
        // path if the stream is truly broken.
        return;
      }
      if (typeof event.service !== "string" || event.service === "") {
        return;
      }
      setServices((prev) => {
        const next = { ...prev, [event.service]: event };
        // Auto-advance: every key present AND every key === "running".
        // Empty map (no snapshot yet) must not trigger navigation.
        if (!readyFiredRef.current) {
          const keys = Object.keys(next);
          if (keys.length > 0 && keys.every((k) => next[k]?.status === "running")) {
            readyFiredRef.current = true;
            // Defer the parent transition out of the setState callback
            // so React's commit phase completes first.
            queueMicrotask(() => {
              onServicesReadyRef.current();
            });
          }
        }
        return next;
      });
    };

    ws.onclose = () => {
      if (intentionalCloseRef.current || readyFiredRef.current) {
        return;
      }
      setConnectionLost(true);
    };

    ws.onerror = () => {
      // onclose runs next; reuse its handling. Logged here only for
      // devtools breadcrumbs.
      console.warn("status WS error");
    };

    return () => {
      intentionalCloseRef.current = true;
      ws.close();
    };
  }, [sessionId]);

  const handleStop = useCallback(async () => {
    setStopError(undefined);
    setStopping(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/stop`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `POST stop failed: ${res.status}`);
      }
      onBack();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    } finally {
      setStopping(false);
    }
  }, [sessionId, onBack]);

  // Ordered list of rows for stable rendering: services arrive in
  // map-iteration order from the server snapshot, which is not stable,
  // so we sort by the known display order with unknown keys appended.
  const orderedServices = useMemo(() => {
    const known = [
      "px4_sitl",
      "gazebo",
      "gazebo_websocket",
      "xrce_dds",
      "ros2_workspace",
      "foxglove_bridge",
      "ros_gz_bridge",
      "mavlink_service",
    ];
    const present = new Set(Object.keys(services));
    const ordered: StatusEvent[] = [];
    for (const k of known) {
      const ev = services[k];
      if (ev != undefined) {
        ordered.push(ev);
        present.delete(k);
      }
    }
    // Append any unknown service keys the server might add later.
    for (const k of [...present].sort()) {
      const ev = services[k];
      if (ev != undefined) {
        ordered.push(ev);
      }
    }
    return ordered;
  }, [services]);

  const allRunning =
    orderedServices.length > 0 && orderedServices.every((e) => e.status === "running");
  const anyFailed = orderedServices.some((e) => e.status === "failed");

  return (
    <Container maxWidth="md" className={classes.root} data-testid="tf-starting-services">
      <Stack className={classes.header} spacing={1}>
        <Typography variant="h4" component="h1">
          Starting session
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Watching service status from the TF Server. The cockpit opens automatically once every
          service is running.
        </Typography>
      </Stack>

      {orderedServices.length === 0 && !connectionLost && (
        <div className={classes.emptyMessage}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Waiting for service status…
          </Typography>
        </div>
      )}

      {orderedServices.length > 0 && (
        <div className={classes.list}>
          {orderedServices.map((ev) => (
            <ServiceRow
              key={ev.service}
              event={ev}
              onViewLogs={() => {
                setLogsForService(ev.service);
              }}
            />
          ))}
        </div>
      )}

      {connectionLost && !allRunning && (
        <Alert severity="warning" className={classes.alertSpaced}>
          Connection lost — service status may be stale.
        </Alert>
      )}

      {stopError != undefined && (
        <Alert severity="error" className={classes.alertSpaced}>
          {stopError}
        </Alert>
      )}

      <div className={classes.footer}>
        <Link
          component="button"
          type="button"
          underline="always"
          onClick={() => void handleStop()}
          disabled={stopping}
        >
          {stopping ? "Stopping…" : "Stop session"}
        </Link>
        {anyFailed && (
          <Typography variant="body2" className={classes.textMuted}>
            One or more services failed. Click View logs for details.
          </Typography>
        )}
      </div>

      <Dialog
        open={logsForService != undefined}
        onClose={() => {
          setLogsForService(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {logsForService != undefined
            ? (SERVICE_LABELS[logsForService] ?? logsForService)
            : ""}
        </DialogTitle>
        <DialogContent>
          <div className={classes.dialogError}>
            {logsForService != undefined
              ? (services[logsForService]?.error ?? "").trim() !== ""
                ? services[logsForService]?.error
                : "No details available."
              : ""}
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setLogsForService(undefined);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

type ServiceRowProps = {
  event: StatusEvent;
  onViewLogs: () => void;
};

function ServiceRow({ event, onViewLogs }: ServiceRowProps): JSX.Element {
  const { classes } = useStyles();
  const label = SERVICE_LABELS[event.service] ?? event.service;
  const kind = normalizeStatus(event.status);
  const errorText = (event.error ?? "").trim();

  return (
    <div className={classes.row}>
      <div className={classes.rowMain}>
        <Typography variant="body1" className={classes.rowName}>
          {label}
        </Typography>
        {kind === "failed" && errorText !== "" && (
          <Typography variant="caption" className={classes.rowError} title={errorText}>
            {errorText}
          </Typography>
        )}
      </div>
      <div className={classes.statusCell}>
        <StatusIcon kind={kind} />
        <StatusText kind={kind} rawStatus={event.status} />
      </div>
      {kind === "failed" && (
        <Button size="small" variant="outlined" onClick={onViewLogs}>
          View logs
        </Button>
      )}
    </div>
  );
}

function normalizeStatus(s: string): StatusKind | "unknown" {
  switch (s) {
    case "pending":
    case "starting":
    case "running":
    case "failed":
    case "stopped":
    case "skipped":
      return s;
    default:
      return "unknown";
  }
}

function StatusIcon({ kind }: { kind: StatusKind | "unknown" }): JSX.Element {
  const { classes } = useStyles();
  switch (kind) {
    case "pending":
      return (
        <span className={classes.iconPending} aria-hidden>
          ⏸
        </span>
      );
    case "starting":
      return <CircularProgress size={16} className={classes.iconStarting} />;
    case "running":
      return (
        <span className={classes.iconRunning} aria-hidden>
          ✓
        </span>
      );
    case "failed":
      return (
        <span className={classes.iconFailed} aria-hidden>
          ✗
        </span>
      );
    case "stopped":
    case "skipped":
    case "unknown":
    default:
      return (
        <span className={classes.iconStopped} aria-hidden>
          •
        </span>
      );
  }
}

function StatusText({
  kind,
  rawStatus,
}: {
  kind: StatusKind | "unknown";
  rawStatus: string;
}): JSX.Element {
  const { classes } = useStyles();
  switch (kind) {
    case "pending":
      return (
        <Typography variant="body2" className={classes.textMuted}>
          Pending
        </Typography>
      );
    case "starting":
      return (
        <Typography variant="body2" className={classes.textStarting}>
          Starting…
        </Typography>
      );
    case "running":
      return (
        <Typography variant="body2" className={classes.textRunning}>
          Running
        </Typography>
      );
    case "failed":
      return (
        <Typography variant="body2" className={classes.textFailed}>
          Failed
        </Typography>
      );
    case "stopped":
      return (
        <Typography variant="body2" className={classes.textMuted}>
          Stopped
        </Typography>
      );
    case "skipped":
      return (
        <Typography variant="body2" className={classes.textMuted}>
          Skipped
        </Typography>
      );
    case "unknown":
    default:
      return (
        <Typography variant="body2" className={classes.textMuted}>
          {rawStatus}
        </Typography>
      );
  }
}

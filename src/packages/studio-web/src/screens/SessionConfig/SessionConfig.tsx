// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Session Config screen — phase1.md §9, §11.6 (Screen 3).
//
// Loads GET /api/v1/projects/{id}/config (the parsed platform.yaml),
// renders the project name, a read-only vehicles table, and a service
// toggle list, then POSTs /api/v1/projects/{id}/sessions to start a
// single Session.
//
// Phase 1 server behaviour to keep in mind:
//   - POST /projects/{id}/sessions has NO request body. The server
//     reads service toggles directly from platform.yaml. The toggles
//     in this UI are therefore informational only.
//   - Only one active session at a time. A second POST returns 409
//     with the active session id embedded in the error string. We
//     extract it (with a regex first, GET /sessions as a fallback)
//     so the user can Stop it before retrying.

import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

const API_BASE = "http://localhost:3000";

// Disabled-by-build services. Per phase1.md §3.3 and the task brief,
// the ros_gz_bridge and mavlink_service flags are not wired in Phase 1
// — the user is told to enable bridge nodes inside their own
// ros2.default_launch instead.
const DISABLED_BY_BUILD: ReadonlySet<string> = new Set(["ros_gz_bridge", "mavlink_service"]);
const DISABLED_BY_BUILD_TOOLTIP =
  "Not available in this build — enable in your ros2.default_launch instead.";

// Display order + friendly labels for the eight known service keys.
// Order matches the task brief, which groups the build-disabled
// services last so they read as "extras" rather than primary toggles.
const SERVICE_DISPLAY: ReadonlyArray<{ key: string; label: string }> = [
  { key: "px4_sitl", label: "PX4 SITL" },
  { key: "gazebo", label: "Gazebo" },
  { key: "gazebo_websocket", label: "Gazebo WebSocket" },
  { key: "xrce_dds", label: "DDS Agent" },
  { key: "ros2_workspace", label: "ROS2 Workspace" },
  { key: "foxglove_bridge", label: "Foxglove Bridge" },
  { key: "ros_gz_bridge", label: "ROS/Gazebo Bridge" },
  { key: "mavlink_service", label: "MAVLink Service" },
];

// Loose JSON shapes — the /config endpoint hands back the parsed
// platform.yaml as a free-form map (see server's
// makeGetProjectConfigHandler). We narrow only the fields we actually
// render; unknown extra keys are ignored.
type ConfigVehicle = {
  id?: string;
  model?: string;
  mav_sys_id?: number;
};

type ConfigShape = {
  name?: string;
  vehicles?: ConfigVehicle[];
  services?: Record<string, boolean>;
};

type SessionListEntry = {
  session_id: string;
  state: string;
};

type SessionListResponse = {
  sessions: SessionListEntry[];
};

type SessionCreatedResponse = {
  session_id: string;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    paddingBlock: theme.spacing(6),
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing(2),
  },
  header: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  emptyVehicles: {
    color: theme.palette.text.secondary,
    paddingBlock: theme.spacing(2),
  },
  servicesList: {
    display: "flex",
    flexDirection: "column",
  },
  serviceRow: {
    paddingBlock: theme.spacing(0.5),
  },
  loadingWrap: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: theme.spacing(8),
  },
  formActions: {
    marginTop: theme.spacing(3),
  },
  submitSpinner: {
    color: "inherit",
  },
}));

export type SessionConfigProps = {
  /** Project to start a session for. Set by WebRoot when the user
   * clicks Open on a Welcome row. */
  projectId: string;
  /** Called for the Back button and for the "already running →
   * stop, then go back" flow if the user prefers to abandon. */
  onBack: () => void;
  /** Called once a POST /sessions returns 201. Transitions the parent
   * to the cockpit view and stores the session_id for M3-FE-4. */
  onSessionStarted: (sessionId: string) => void;
};

export function SessionConfig({
  projectId,
  onBack,
  onSessionStarted,
}: SessionConfigProps): JSX.Element {
  const { classes } = useStyles();

  const [config, setConfig] = useState<ConfigShape | undefined>(undefined);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | undefined>(undefined);
  const [configErrorStatus, setConfigErrorStatus] = useState<number | undefined>(undefined);

  // Local toggle state, seeded from config.services on first load.
  // Phase 1 server does not consume these — they are visual only.
  const [serviceToggles, setServiceToggles] = useState<Record<string, boolean>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(undefined);
    setConfigErrorStatus(undefined);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}/config`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setConfigErrorStatus(res.status);
        throw new Error(body.error ?? `GET /config failed: ${res.status}`);
      }
      const body = (await res.json()) as ConfigShape;
      setConfig(body);

      const next: Record<string, boolean> = {};
      for (const { key } of SERVICE_DISPLAY) {
        if (DISABLED_BY_BUILD.has(key)) {
          // Forced off regardless of platform.yaml.
          next[key] = false;
        } else {
          next[key] = Boolean(body.services?.[key]);
        }
      }
      setServiceToggles(next);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : String(err));
      setConfig(undefined);
    } finally {
      setConfigLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const toggleService = useCallback((key: string, checked: boolean) => {
    setServiceToggles((prev) => ({ ...prev, [key]: checked }));
  }, []);

  const handleStop = useCallback(async () => {
    if (activeSessionId == undefined) {
      return;
    }
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/sessions/${encodeURIComponent(activeSessionId)}/stop`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `POST stop failed: ${res.status}`);
      }
      // Clear the conflict marker so the user can retry Start SIL.
      setActiveSessionId(undefined);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [activeSessionId]);

  const handleStart = useCallback(async () => {
    setSubmitError(undefined);
    setActiveSessionId(undefined);
    setSubmitting(true);
    try {
      // Phase 1 server ignores the request body for POST /sessions —
      // it derives services from platform.yaml. Sending an empty JSON
      // object satisfies any strict middleware while preserving the
      // documented "no body" semantics.
      const res = await fetch(
        `${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (res.status === 201) {
        const body = (await res.json()) as SessionCreatedResponse;
        // M3-FE-4 lands the Starting Services screen here. For now we
        // log a breadcrumb and hand off to the cockpit so the user can
        // see the existing Foxglove panels load.
        console.warn("M3-FE-4 not yet implemented");
        onSessionStarted(body.session_id);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const raw = body.error ?? `POST /sessions failed: ${res.status}`;
      if (res.status === 409) {
        const conflictId = await resolveActiveSessionId(raw);
        if (conflictId != undefined) {
          setActiveSessionId(conflictId);
        }
        setSubmitError("A session is already running.");
        return;
      }
      setSubmitError(raw);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [projectId, onSessionStarted]);

  const canStart =
    !configLoading && !submitting && configError == undefined && activeSessionId == undefined;

  // Memoise the vehicle list so the Table body does not re-render on
  // every toggle flip.
  const vehicles = useMemo(() => config?.vehicles ?? [], [config]);

  return (
    <Container maxWidth="md" className={classes.root} data-testid="tf-session-config">
      <Button
        className={classes.backButton}
        onClick={onBack}
        size="small"
        disabled={submitting}
      >
        ← Back
      </Button>

      {configLoading && (
        <div className={classes.loadingWrap}>
          <CircularProgress />
        </div>
      )}

      {!configLoading && configError != undefined && (
        <Stack spacing={2}>
          <Alert severity="error">
            {configErrorStatus === 404
              ? "Project configuration not found. The project may be missing on disk."
              : `Could not load project config: ${configError}`}
          </Alert>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={onBack}>
              Back to Welcome
            </Button>
            <Button variant="text" onClick={() => void fetchConfig()}>
              Retry
            </Button>
          </Stack>
        </Stack>
      )}

      {!configLoading && configError == undefined && config != undefined && (
        <>
          <Stack className={classes.header} spacing={1}>
            <Typography variant="h4" component="h1">
              {config.name ?? projectId}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review the session configuration, then start the SIL services.
            </Typography>
          </Stack>

          <Typography variant="h6" className={classes.sectionTitle}>
            Vehicles
          </Typography>
          {vehicles.length === 0 ? (
            <Typography className={classes.emptyVehicles}>No vehicles configured.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">MAV SYS ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vehicles.map((v, idx) => (
                    <TableRow key={v.id ?? idx}>
                      <TableCell>{v.id ?? "—"}</TableCell>
                      <TableCell>{v.model ?? "—"}</TableCell>
                      <TableCell align="right">{v.mav_sys_id ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="h6" className={classes.sectionTitle}>
            Services
          </Typography>
          <div className={classes.servicesList}>
            {SERVICE_DISPLAY.map(({ key, label }) => {
              const buildDisabled = DISABLED_BY_BUILD.has(key);
              const checked = serviceToggles[key] ?? false;
              const control = (
                <FormControlLabel
                  className={classes.serviceRow}
                  control={
                    <Checkbox
                      checked={buildDisabled ? false : checked}
                      disabled={buildDisabled || submitting}
                      onChange={(e) => {
                        toggleService(key, e.target.checked);
                      }}
                    />
                  }
                  label={label}
                />
              );
              return buildDisabled ? (
                <Tooltip key={key} title={DISABLED_BY_BUILD_TOOLTIP} placement="right">
                  <span>{control}</span>
                </Tooltip>
              ) : (
                <span key={key}>{control}</span>
              );
            })}
          </div>

          {submitError != undefined && (
            <Alert
              severity={activeSessionId != undefined ? "warning" : "error"}
              action={
                activeSessionId != undefined ? (
                  <Link
                    component="button"
                    type="button"
                    underline="always"
                    onClick={() => void handleStop()}
                    disabled={submitting}
                  >
                    Stop it
                  </Link>
                ) : undefined
              }
            >
              {submitError}
            </Alert>
          )}

          <Stack direction="row" spacing={2} className={classes.formActions}>
            <Button
              variant="contained"
              onClick={() => void handleStart()}
              disabled={!canStart}
            >
              {submitting && activeSessionId == undefined ? (
                <CircularProgress size={20} className={classes.submitSpinner} />
              ) : (
                "Start SIL"
              )}
            </Button>
          </Stack>
        </>
      )}
    </Container>
  );
}

/**
 * Best-effort extraction of the active session_id when POST /sessions
 * returns 409. The server's error string follows the pattern:
 *
 *   session already active: session "<id>" is active
 *
 * If the regex misses (string format drift, etc.) we fall back to
 * GET /api/v1/sessions and pick the first entry in starting/running
 * state. Returning undefined leaves the UI without a Stop link, but
 * the warning alert is still informative.
 */
async function resolveActiveSessionId(errorMessage: string): Promise<string | undefined> {
  const match = /session\s+"([^"]+)"\s+is\s+active/.exec(errorMessage);
  if (match?.[1] != undefined && match[1] !== "") {
    return match[1];
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/sessions`);
    if (!res.ok) {
      return undefined;
    }
    const body = (await res.json()) as SessionListResponse;
    const active = body.sessions.find(
      (s) => s.state === "starting" || s.state === "running",
    );
    return active?.session_id;
  } catch {
    return undefined;
  }
}

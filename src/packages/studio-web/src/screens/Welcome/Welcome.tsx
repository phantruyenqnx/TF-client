// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Welcome / Project Picker — phase1.md §11.6.
//
// Lists registered projects from the TF Server registry with a status
// badge (green dot for `ok`, yellow warning for `path_missing`).
// Primary actions:
//   - Open: hand the cockpit a project_id (M3-FE-3 will consume it).
//   - Create New Project: placeholder (M3-FE-2).
//   - Import Existing Folder: placeholder (M3-FE-1b).
// For `path_missing` rows, inline Re-point and Remove actions hit
// PATCH /api/v1/projects/{id} and DELETE /api/v1/projects/{id}
// respectively, then re-fetch the list.
//
// The API base is hardcoded to http://localhost:3000 for Phase 1 (no
// env var yet, per locked decision #1: local-first native runtime).

import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

// Phase 1: TF Server always listens on localhost:3000 (phase1.md §3.7,
// §9). No env var indirection until Phase 2.
const API_BASE = "http://localhost:3000";

type ProjectStatus = "ok" | "path_missing";

type ProjectListEntry = {
  id: string;
  name: string;
  path: string;
  created_at: string;
  status: ProjectStatus;
};

type ProjectListResponse = {
  projects: ProjectListEntry[];
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
    marginBottom: theme.spacing(4),
  },
  actionsBar: {
    marginBottom: theme.spacing(3),
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
  },
  rowMain: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  rowName: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  rowPath: {
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    direction: "rtl", // truncate from the left so the basename stays visible
    textAlign: "left",
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.body2.fontSize,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: 999,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
  },
  badgeOk: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  badgePathMissing: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  rowError: {
    flexBasis: "100%",
    marginTop: theme.spacing(1),
  },
  hiddenInput: {
    display: "none",
  },
  empty: {
    color: theme.palette.text.secondary,
    paddingBlock: theme.spacing(8),
    textAlign: "center",
  },
  loadingWrap: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: theme.spacing(8),
  },
  loadErrorAlert: {
    marginBottom: theme.spacing(2),
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "currentColor",
    opacity: 0.85,
    display: "inline-block",
  },
}));

type FileWithPath = File & { readonly path?: string };

/**
 * Best-effort extraction of an absolute directory path from a
 * <input type="file" webkitdirectory> selection.
 *
 * In Electron-style hosts each File carries an absolute `.path`. Pure
 * browsers don't, so all we have is the relative folder name. The
 * server validates absolute-ness and returns 400 if it's not — that
 * error is surfaced inline next to the row, so the failure mode is
 * "user sees a clear error", not a silent miswrite.
 */
function deriveSelectedDirPath(fileList: FileList): string | undefined {
  const first = fileList.item(0) as FileWithPath | null;
  if (!first) {
    return undefined;
  }
  if (typeof first.path === "string" && first.path.length > 0) {
    // Electron: file.path is the absolute file path. Strip the
    // trailing relative-to-selected portion to recover the picked dir.
    const rel = first.webkitRelativePath;
    if (rel && first.path.endsWith(rel)) {
      const trimmed = first.path.slice(0, first.path.length - rel.length);
      // strip trailing separator
      return trimmed.replace(/[\\/]+$/, "");
    }
    return first.path;
  }
  // Browser fallback: only the picked folder's basename is available.
  const rel = first.webkitRelativePath;
  if (rel) {
    const firstSegment = rel.split("/")[0];
    if (firstSegment) {
      return firstSegment;
    }
  }
  return undefined;
}

export type WelcomeProps = {
  /**
   * Called when the user clicks "Open" on a project. The cockpit is
   * mounted by the parent (WebRoot) once a project is selected; the
   * project_id is currently held in WebRoot state for future tasks
   * (M3-FE-3 Session Config) to consume.
   */
  onOpenProject: (projectId: string) => void;
};

export function Welcome({ onOpenProject }: WelcomeProps): JSX.Element {
  const { classes, cx } = useStyles();
  const [projects, setProjects] = useState<ProjectListEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  // Per-row inline error (Re-point / Remove failures) keyed by project id.
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({});
  // Re-point uses a single hidden file input; track which project_id
  // the next selection should target.
  const repointTargetIdRef = useRef<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(ReactNull);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `GET /projects failed: ${res.status}`);
      }
      const body = (await res.json()) as ProjectListResponse;
      setProjects(body.projects);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setProjects(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const setRowError = useCallback((id: string, message: string | undefined) => {
    setRowErrors((prev) => ({ ...prev, [id]: message }));
  }, []);

  const handleRepointClick = useCallback((id: string) => {
    repointTargetIdRef.current = id;
    fileInputRef.current?.click();
  }, []);

  const handleRepointFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const id = repointTargetIdRef.current;
      repointTargetIdRef.current = undefined;
      const fileList = event.target.files;
      // Reset the input so picking the same folder twice in a row
      // re-fires the change event.
      event.target.value = "";
      if (!id || !fileList || fileList.length === 0) {
        return;
      }
      const path = deriveSelectedDirPath(fileList);
      if (path == undefined) {
        setRowError(id, "could not read selected directory");
        return;
      }
      setRowError(id, undefined);
      try {
        const res = await fetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `PATCH failed: ${res.status}`);
        }
        await fetchProjects();
      } catch (err) {
        setRowError(id, err instanceof Error ? err.message : String(err));
      }
    },
    [fetchProjects, setRowError],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      setRowError(id, undefined);
      try {
        const res = await fetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delete_files: false }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `DELETE failed: ${res.status}`);
        }
        await fetchProjects();
      } catch (err) {
        setRowError(id, err instanceof Error ? err.message : String(err));
      }
    },
    [fetchProjects, setRowError],
  );

  const handleCreateClick = useCallback(() => {
    // M3-FE-2 wires this to the Create Project screen.
    console.warn("M3-FE-2 not yet implemented");
  }, []);

  const handleImportClick = useCallback(() => {
    // M3-FE-1b wires this to the Import Project dialog.
    console.warn("M3-FE-1b not yet implemented");
  }, []);

  return (
    <Container maxWidth="md" className={classes.root} data-testid="tf-welcome">
      <Stack className={classes.header} spacing={1}>
        <Typography variant="h3" component="h1">
          TF Studio
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a project to open, or create / import one.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} className={classes.actionsBar}>
        <Button variant="contained" onClick={handleCreateClick}>
          + Create New Project
        </Button>
        <Button variant="outlined" onClick={handleImportClick}>
          Import Existing Folder
        </Button>
      </Stack>

      {loading && (
        <div className={classes.loadingWrap}>
          <CircularProgress />
        </div>
      )}

      {!loading && loadError != undefined && (
        <Alert severity="error" className={classes.loadErrorAlert}>
          Could not load projects: {loadError}
        </Alert>
      )}

      {!loading && loadError == undefined && projects != undefined && projects.length === 0 && (
        <Typography className={classes.empty}>
          No projects registered yet. Create a new project or import an existing folder to get
          started.
        </Typography>
      )}

      {!loading && projects != undefined && projects.length > 0 && (
        <div className={classes.list}>
          {projects.map((p) => {
            const isOk = p.status === "ok";
            const rowError = rowErrors[p.id];
            return (
              <Stack
                key={p.id}
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                className={classes.row}
              >
                <div className={classes.rowMain}>
                  <Typography className={classes.rowName} variant="subtitle1">
                    {p.name || p.id}
                  </Typography>
                  <Tooltip title={p.path} placement="bottom-start">
                    <div className={classes.rowPath}>
                      {p.path}
                    </div>
                  </Tooltip>
                </div>
                <span
                  className={cx(classes.badge, isOk ? classes.badgeOk : classes.badgePathMissing)}
                  aria-label={`status ${p.status}`}
                >
                  {isOk ? (
                    <span className={classes.badgeDot} />
                  ) : (
                    <WarningRoundedIcon fontSize="inherit" />
                  )}
                  {p.status}
                </span>
                <div className={classes.rowActions}>
                  {isOk ? (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        onOpenProject(p.id);
                      }}
                    >
                      Open
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          handleRepointClick(p.id);
                        }}
                      >
                        Re-point
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => {
                          void handleRemove(p.id);
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
                {rowError != undefined && (
                  <Alert severity="error" className={classes.rowError}>
                    {rowError}
                  </Alert>
                )}
              </Stack>
            );
          })}
        </div>
      )}

      {/*
        Single hidden directory picker shared by every Re-point button.
        webkitdirectory is non-standard but widely supported in
        Chromium-based browsers, which is the Phase 1 target
        (see CompatibilityBanner).
      */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard but supported by Chromium
        webkitdirectory=""
        directory=""
        multiple
        className={classes.hiddenInput}
        onChange={(e) => {
          void handleRepointFileChange(e);
        }}
      />
    </Container>
  );
}


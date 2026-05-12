// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Import Project dialog — phase1.md §11.6 (Screen 2b), M3-FE-1b.
//
// The user types an absolute path into a text field, clicks Import,
// and the app calls POST /api/v1/projects/import {path}.
//   201 → preview card (name, vehicles, world) + "Open Project" CTA.
//   4xx/5xx → server's error string inline, field stays editable.
//
// A folder picker (webkitdirectory) was considered but rejected: in a
// web context File.path is unavailable, so the browser can only provide
// the folder's basename — not an absolute path. A plain text field gives
// the user full control and matches how the server expects the path.

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";

const API_BASE = "http://localhost:3000";

type ImportedProject = {
  id: string;
  name?: string;
  path?: string;
};

type ProjectConfig = {
  name?: string;
  vehicles?: unknown[];
  world?: string | { name?: string; file?: string };
};

type Phase = "idle" | "loading" | "ready" | "error";

const useStyles = makeStyles()((theme) => ({
  previewBlock: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  previewRow: {
    display: "flex",
    gap: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize,
  },
  previewLabel: {
    color: theme.palette.text.secondary,
    minWidth: 80,
    flexShrink: 0,
  },
  previewValue: {
    fontFamily: theme.typography.fontMonospace,
    wordBreak: "break-all",
  },
  previewCheck: {
    color: theme.palette.success.main,
    fontSize: "1.2rem",
    lineHeight: 1,
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
}));

// Convert a Windows absolute path to its WSL /mnt/<drive>/... equivalent.
// Handles both backslash and forward-slash separators (e.g. D:\foo or D:/foo).
// Non-Windows paths are returned unchanged.
function toWslPath(p: string): string {
  const match = /^([A-Za-z]):[/\\](.*)$/.exec(p);
  if (!match) {
    return p;
  }
  const drive = match[1]!.toLowerCase();
  const rest = match[2]!.replace(/\\/g, "/");
  return rest === "" ? `/mnt/${drive}` : `/mnt/${drive}/${rest}`;
}

function worldLabel(world: ProjectConfig["world"]): string | undefined {
  if (world == undefined) {
    return undefined;
  }
  if (typeof world === "string") {
    return world;
  }
  return world.name ?? world.file;
}

export type ImportProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onImported: (projectId: string) => void;
  onListShouldRefresh: () => void;
};

export function ImportProjectDialog({
  open,
  onClose,
  onImported,
  onListShouldRefresh,
}: ImportProjectDialogProps): JSX.Element {
  const { classes } = useStyles();

  const [pathInput, setPathInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [imported, setImported] = useState<ImportedProject | undefined>(undefined);
  const [config, setConfig] = useState<ProjectConfig | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Reset every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPathInput("");
      setPhase("idle");
      setImported(undefined);
      setConfig(undefined);
      setErrorMessage(undefined);
    }
  }, [open]);

  const handleImport = useCallback(async () => {
    const path = toWslPath(pathInput.trim());
    if (path === "") {
      return;
    }
    setPhase("loading");
    setErrorMessage(undefined);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.status !== 201) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `POST /projects/import failed: ${res.status}`);
      }
      const body = (await res.json()) as ImportedProject;
      setImported(body);

      // Best-effort config fetch for the preview block.
      try {
        const cfgRes = await fetch(
          `${API_BASE}/api/v1/projects/${encodeURIComponent(body.id)}/config`,
        );
        if (cfgRes.ok) {
          setConfig((await cfgRes.json()) as ProjectConfig);
        }
      } catch {
        // Non-fatal — preview falls back to the import response.
      }

      setPhase("ready");
      onListShouldRefresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }, [pathInput, onListShouldRefresh]);

  const handleOpenProject = useCallback(() => {
    if (imported == undefined) {
      return;
    }
    onImported(imported.id);
    onClose();
  }, [imported, onClose, onImported]);

  const handleClose = useCallback(() => {
    if (phase === "loading") {
      return;
    }
    onClose();
  }, [onClose, phase]);

  const canImport = pathInput.trim() !== "" && phase !== "loading" && phase !== "ready";

  const previewName = config?.name ?? imported?.name ?? imported?.id ?? "";
  const previewVehicles = Array.isArray(config?.vehicles) ? config.vehicles.length : undefined;
  const previewWorld = worldLabel(config?.world);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Import existing project</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Enter the absolute path to a folder that contains a{" "}
            <code>platform.yaml</code> at its root. The folder stays in place —
            TF Studio only records its path.
          </Typography>

          <TextField
            label="Project folder path"
            placeholder="/home/user/projects/my_project"
            value={pathInput}
            onChange={(e) => {
              setPathInput(e.target.value);
              // Clear error when the user starts editing.
              if (errorMessage != undefined) {
                setErrorMessage(undefined);
                setPhase("idle");
              }
            }}
            disabled={phase === "loading" || phase === "ready"}
            fullWidth
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canImport) {
                void handleImport();
              }
            }}
          />

          {phase === "loading" && (
            <div className={classes.loadingRow}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Importing…
              </Typography>
            </div>
          )}

          {errorMessage != undefined && (
            <Alert severity="error">{errorMessage}</Alert>
          )}

          {phase === "ready" && imported != undefined && (
            <div className={classes.previewBlock}>
              <Stack spacing={0.75}>
                <div className={classes.previewRow}>
                  <span className={classes.previewCheck} aria-hidden>
                    ✓
                  </span>
                  <Typography variant="subtitle2">Project registered</Typography>
                </div>
                <div className={classes.previewRow}>
                  <span className={classes.previewLabel}>Name</span>
                  <span className={classes.previewValue}>{previewName}</span>
                </div>
                {previewVehicles != undefined && (
                  <div className={classes.previewRow}>
                    <span className={classes.previewLabel}>Vehicles</span>
                    <span className={classes.previewValue}>{previewVehicles}</span>
                  </div>
                )}
                {previewWorld != undefined && previewWorld !== "" && (
                  <div className={classes.previewRow}>
                    <span className={classes.previewLabel}>World</span>
                    <span className={classes.previewValue}>{previewWorld}</span>
                  </div>
                )}
                {(imported.path ?? pathInput.trim()) !== "" && (
                  <div className={classes.previewRow}>
                    <span className={classes.previewLabel}>Path</span>
                    <span className={classes.previewValue}>
                      {imported.path ?? pathInput.trim()}
                    </span>
                  </div>
                )}
              </Stack>
            </div>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={phase === "loading"}>
          {phase === "ready" ? "Close" : "Cancel"}
        </Button>
        {phase !== "ready" && (
          <Button
            variant="contained"
            onClick={() => void handleImport()}
            disabled={!canImport}
          >
            {phase === "loading" ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Import"
            )}
          </Button>
        )}
        {phase === "ready" && imported != undefined && (
          <Button variant="contained" onClick={handleOpenProject}>
            Open Project
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

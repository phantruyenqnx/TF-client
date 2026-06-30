// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Create Project screen — phase1.md §11.6 (Screen 2) + §12.
//
// Flow:
//   1. On mount, fetch the built-in template catalog via
//      GET /api/v1/templates.
//   2. User picks a template, types a project name (sanitized preview
//      shown live), optionally types an absolute target path, toggles
//      "init_git" (default on), and clicks Create.
//   3. POST /api/v1/projects → 201 hands control back to Welcome so
//      the new project appears in the list. 4xx surfaces the server's
//      error string inline (a few well-known sentinels get a friendly
//      rewrite).
//
// Sanitization mirrors internal/template/create.go sanitizeName: any
// rune outside [A-Za-z0-9_-] becomes "_". The frontend never resolves
// "~" or relative paths — that is the server's job (§12 step 2).

import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

const API_BASE = "http://localhost:3000";

const DEFAULT_TEMPLATE_ID = "single_x500_offboard";

// Mirrors TF-server sanitizeName (internal/template/create.go): any
// character outside [A-Za-z0-9_-] is replaced with "_". Pure function,
// stable across calls — same contract as the server.
function sanitizeName(s: string): string {
  let out = "";
  for (const ch of s) {
    if (/^[A-Za-z0-9_-]$/.test(ch)) {
      out += ch;
    } else {
      out += "_";
    }
  }
  return out;
}

type TemplateVehicle = {
  id?: string;
  model?: string;
};

type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  vehicles: TemplateVehicle[];
};

type TemplateListResponse = {
  templates: TemplateSummary[];
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
  backButton: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing(2),
  },
  templateOption: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    paddingBlock: theme.spacing(1),
    whiteSpace: "normal",
  },
  templateName: {
    fontWeight: 600,
  },
  templateMeta: {
    color: theme.palette.text.secondary,
  },
  sanitizedHint: {
    color: theme.palette.text.secondary,
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.5),
  },
  pathWarning: {
    color: theme.palette.warning.main,
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.5),
  },
  loadingWrap: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: theme.spacing(8),
  },
  formActions: {
    marginTop: theme.spacing(2),
  },
  submitSpinner: {
    color: "inherit",
  },
}));

export type CreateProjectProps = {
  /**
   * Called when the user finishes the screen — either by clicking
   * Back, or after a successful create (server returned 201). The
   * parent (WebRoot) routes back to Welcome in both cases so the new
   * project appears in the picker. Per the task brief, M3-FE-3 will
   * later replace the success path with a direct jump to Session
   * Config; for now we just `console.warn` and bounce to Welcome.
   */
  onBack: () => void;
};

export function CreateProject({ onBack }: CreateProjectProps): JSX.Element {
  const { classes } = useStyles();

  const [templates, setTemplates] = useState<TemplateSummary[] | undefined>(undefined);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | undefined>(undefined);

  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [path, setPath] = useState<string>("");
  const [initGit, setInitGit] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(undefined);
    try {
      const res = await fetch(`${API_BASE}/api/v1/templates`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `GET /templates failed: ${res.status}`);
      }
      const body = (await res.json()) as TemplateListResponse;
      setTemplates(body.templates);
      // Default selection: single_x500_offboard if present, else the
      // first template returned by the server.
      const preferred = body.templates.find((t) => t.id === DEFAULT_TEMPLATE_ID);
      const fallback = body.templates[0];
      setTemplateId(preferred?.id ?? fallback?.id ?? "");
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : String(err));
      setTemplates(undefined);
      setTemplateId("");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const sanitized = useMemo(() => sanitizeName(name), [name]);
  const trimmedPath = path.trim();
  const pathIsAbsolute = trimmedPath === "" || trimmedPath.startsWith("/");

  const handleSubmit = useCallback(async () => {
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          name,
          // Empty string tells the server to use its default
          // ~/.tf/projects/<sanitized_name>. The frontend does not
          // resolve "~" — that is the server's job per §12.
          path: trimmedPath,
          init_git: initGit,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const raw = body.error ?? `POST /projects failed: ${res.status}`;
        throw new Error(raw);
      }
      onBack();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setSubmitError(friendlyCreateError(raw));
    } finally {
      setSubmitting(false);
    }
  }, [templateId, name, trimmedPath, initGit, onBack]);

  // Submit is enabled even when the path looks relative — the server
  // is the source of truth on path validity. We only block while the
  // catalog is still loading or while a previous submit is in flight.
  const canSubmit = !templatesLoading && !submitting && templateId !== "" && name.trim() !== "";

  return (
    <Container maxWidth="sm" className={classes.root} data-testid="tf-create-project">
      <Button
        className={classes.backButton}
        onClick={onBack}
        size="small"
        disabled={submitting}
      >
        ← Back
      </Button>

      <Stack className={classes.header} spacing={1}>
        <Typography variant="h4" component="h1">
          Create Project
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Start from a built-in template. The server will copy files into the chosen folder.
        </Typography>
      </Stack>

      {templatesLoading && (
        <div className={classes.loadingWrap}>
          <CircularProgress />
        </div>
      )}

      {!templatesLoading && templatesError != undefined && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void fetchTemplates()}>
              Retry
            </Button>
          }
        >
          Could not load templates: {templatesError}
        </Alert>
      )}

      {!templatesLoading && templatesError == undefined && templates != undefined && (
        <Stack spacing={3}>
          <TextField
            select
            label="Template"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
            }}
            disabled={submitting}
            fullWidth
          >
            {templates.map((t) => {
              const count = t.vehicles.length;
              const countLabel = `${count} vehicle${count === 1 ? "" : "s"}`;
              return (
                <MenuItem key={t.id} value={t.id} className={classes.templateOption}>
                  <Typography className={classes.templateName} variant="body1">
                    {t.name || t.id}
                  </Typography>
                  {t.description !== "" && (
                    <Typography className={classes.templateMeta} variant="body2">
                      {t.description}
                    </Typography>
                  )}
                  <Typography className={classes.templateMeta} variant="caption">
                    {countLabel}
                  </Typography>
                </MenuItem>
              );
            })}
          </TextField>

          <div>
            <TextField
              label="Project Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              disabled={submitting}
              fullWidth
              autoFocus
            />
            {name.trim() !== "" && (
              <div className={classes.sanitizedHint}>Saved as: {sanitized}</div>
            )}
          </div>

          <div>
            <TextField
              label="Location (optional)"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
              }}
              placeholder={`~/.tf/projects/${sanitized || "<sanitized_name>"}`}
              disabled={submitting}
              fullWidth
              helperText="Leave blank to use the default ~/.tf/projects/<name> location."
            />
            {!pathIsAbsolute && (
              <div className={classes.pathWarning}>
                Path must be an absolute path (start with &quot;/&quot;).
              </div>
            )}
          </div>

          <FormControlLabel
            control={
              <Checkbox
                checked={initGit}
                onChange={(e) => {
                  setInitGit(e.target.checked);
                }}
                disabled={submitting}
              />
            }
            label="Initialize git repository"
          />

          {submitError != undefined && <Alert severity="error">{submitError}</Alert>}

          <Stack direction="row" spacing={2} className={classes.formActions}>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {submitting ? (
                <CircularProgress size={20} className={classes.submitSpinner} />
              ) : (
                "Create Project"
              )}
            </Button>
            <Button variant="text" onClick={onBack} disabled={submitting}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      )}
    </Container>
  );
}

/**
 * Map known server error sentinels to friendlier UI copy. Unknown
 * strings pass through verbatim — the server is the source of truth.
 *
 * Substring matching is deliberate: the server's mapCreateError sends
 * the underlying error.Error() text (e.g.
 * "target path exists and is not empty: /tmp/foo"), so a startsWith /
 * exact match would miss the wrapped variants.
 */
function friendlyCreateError(raw: string): string {
  if (raw.includes("target path exists and is not empty")) {
    return "Folder already exists and is not empty.";
  }
  if (raw.includes("path already registered")) {
    return "This path is already imported as another project.";
  }
  if (raw.includes("parent directory does not exist")) {
    return "Parent directory does not exist.";
  }
  return raw;
}

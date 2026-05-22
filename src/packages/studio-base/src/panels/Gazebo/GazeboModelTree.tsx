// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useCallback, useState } from "react";
import { makeStyles } from "tss-react/mui";

export type LinkInfo = {
  name: string;
};

export type JointInfo = {
  name: string;
  parent?: string;
  child?: string;
};

export type ModelInfo = {
  name: string;
  links: LinkInfo[];
  joints: JointInfo[];
};

type Props = {
  open: boolean;
  worldName: string;
  tree: ModelInfo[];
  expandedModels: ReadonlySet<string>;
  expandedLinks: ReadonlySet<string>;
  axesEnabled: ReadonlySet<string>;
  jointAngles: ReadonlyMap<string, number>;
  onToggleSidebar: () => void;
  onToggleModel: (modelName: string) => void;
  onToggleLink: (modelName: string, linkName: string) => void;
  onToggleAxes: (modelName: string, linkName: string, on: boolean) => void;
  onOpenSdf: (modelName: string) => void;
};

// Anchor position for the right-click context menu. We track the
// (x, y) page coordinates rather than an HTMLElement anchor so the
// menu pops up exactly where the cursor landed — matching the
// browser-native context-menu UX.
type ContextMenuState = {
  x: number;
  y: number;
  modelName: string;
};

const SIDEBAR_WIDTH = 280;
const COLLAPSED_WIDTH = 32;

const useStyles = makeStyles()((theme) => {
  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "#1c1e2a" : "#ffffff";
  const textPrimary = isDark ? "#e8eaf6" : "#1a1a2e";
  const textMuted = isDark ? "#90a4ae" : "#5f6b7a";
  const divider = isDark ? "#2a2d3e" : "#e0e0e0";
  const hover = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  return {
    sidebar: {
      width: SIDEBAR_WIDTH,
      flexShrink: 0,
      backgroundColor: cardBg,
      borderRight: `1px solid ${divider}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "width 120ms ease-out",
    },
    sidebarCollapsed: {
      width: COLLAPSED_WIDTH,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      borderBottom: `1px solid ${divider}`,
      minHeight: 36,
    },
    headerTitle: {
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      color: textMuted,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    toggleButton: {
      width: 24,
      height: 24,
      padding: 0,
      fontSize: "14px",
      color: textPrimary,
    },
    body: {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      padding: theme.spacing(0.5, 0),
    },
    rowModel: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1),
      cursor: "pointer",
      userSelect: "none",
      fontSize: "12px",
      fontWeight: 600,
      color: textPrimary,
      "&:hover": { backgroundColor: hover },
    },
    rowLink: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1, 0.25, 3),
      cursor: "pointer",
      userSelect: "none",
      fontSize: "12px",
      color: textPrimary,
      "&:hover": { backgroundColor: hover },
    },
    rowJoint: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1, 0.25, 5),
      fontSize: "11px",
      color: textMuted,
      fontFamily: theme.typography.fontMonospace,
    },
    overlays: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.25),
      marginLeft: theme.spacing(0.5),
    },
    overlayCheckbox: {
      padding: 2,
    },
    chevron: {
      width: 14,
      display: "inline-block",
      textAlign: "center",
      fontSize: "10px",
      color: textMuted,
    },
    rowLabel: {
      flex: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    jointAngle: {
      fontVariantNumeric: "tabular-nums",
    },
    emptyState: {
      padding: theme.spacing(2, 1),
      color: textMuted,
      fontSize: "11px",
      fontStyle: "italic",
      textAlign: "center",
    },
    worldLabel: {
      padding: theme.spacing(0.5, 1),
      fontSize: "10px",
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      color: textMuted,
      borderBottom: `1px solid ${divider}`,
    },
  };
});

function formatAngle(rad: number | undefined): string {
  if (rad == undefined || Number.isNaN(rad)) {
    return "--";
  }
  // Show degrees for human-readable rotor angle inspection.
  const deg = (rad * 180) / Math.PI;
  return `${deg >= 0 ? "+" : ""}${deg.toFixed(1)}°`;
}

export function GazeboModelTree(props: Props): JSX.Element {
  const {
    open,
    worldName,
    tree,
    expandedModels,
    expandedLinks,
    axesEnabled,
    jointAngles,
    onToggleSidebar,
    onToggleModel,
    onToggleLink,
    onToggleAxes,
    onOpenSdf,
  } = props;
  const { classes, cx } = useStyles();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | undefined>(
    undefined,
  );

  const handleAxesChange = useCallback(
    (modelName: string, linkName: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        onToggleAxes(modelName, linkName, event.target.checked);
      },
    [onToggleAxes],
  );

  // Open the right-click menu for the given model. Used by both
  // model rows and link rows; the link variant passes its parent
  // model name so "Open SDF in VSCode" always targets the model
  // SDF (links don't have standalone SDF files).
  const handleRowContextMenu = useCallback(
    (modelName: string) => (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, modelName });
    },
    [],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(undefined);
  }, []);

  const handleOpenSdfClick = useCallback(() => {
    if (contextMenu != undefined) {
      onOpenSdf(contextMenu.modelName);
    }
    setContextMenu(undefined);
  }, [contextMenu, onOpenSdf]);

  return (
    <div className={cx(classes.sidebar, !open && classes.sidebarCollapsed)}>
      <div className={classes.header}>
        {open && <span className={classes.headerTitle}>Scene Tree</span>}
        <IconButton
          size="small"
          onClick={onToggleSidebar}
          className={classes.toggleButton}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? "‹" : "›"}
        </IconButton>
      </div>
      {open && (
        <>
          {worldName !== "" && (
            <div className={classes.worldLabel}>world: {worldName}</div>
          )}
          <div className={classes.body}>
            {tree.length === 0 ? (
              <div className={classes.emptyState}>No models in scene</div>
            ) : (
              tree.map((model) => {
                const isModelOpen = expandedModels.has(model.name);
                return (
                  <div key={model.name}>
                    <div
                      className={classes.rowModel}
                      onClick={() => {
                        onToggleModel(model.name);
                      }}
                      onContextMenu={handleRowContextMenu(model.name)}
                    >
                      <span className={classes.chevron}>
                        {isModelOpen ? "▾" : "▸"}
                      </span>
                      <span className={classes.rowLabel}>{model.name}</span>
                    </div>
                    {isModelOpen &&
                      model.links.map((link) => {
                        const linkKey = `${model.name}/${link.name}`;
                        const isLinkOpen = expandedLinks.has(linkKey);
                        const linkJoints = model.joints.filter(
                          (j) => j.child === link.name,
                        );
                        return (
                          <div key={linkKey}>
                            <div
                              className={classes.rowLink}
                              onContextMenu={handleRowContextMenu(model.name)}
                            >
                              <span
                                className={classes.chevron}
                                onClick={() => {
                                  onToggleLink(model.name, link.name);
                                }}
                              >
                                {linkJoints.length > 0
                                  ? isLinkOpen
                                    ? "▾"
                                    : "▸"
                                  : "·"}
                              </span>
                              <span
                                className={classes.rowLabel}
                                onClick={() => {
                                  onToggleLink(model.name, link.name);
                                }}
                              >
                                {link.name}
                              </span>
                              <div className={classes.overlays}>
                                <Tooltip title="Toggle coordinate frame">
                                  <Checkbox
                                    size="small"
                                    className={classes.overlayCheckbox}
                                    checked={axesEnabled.has(linkKey)}
                                    onChange={handleAxesChange(
                                      model.name,
                                      link.name,
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    inputProps={{
                                      "aria-label": `Coordinate frame for ${linkKey}`,
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip title="Configure session ID in panel settings">
                                  <span>
                                    <Checkbox
                                      size="small"
                                      className={classes.overlayCheckbox}
                                      disabled
                                      checked={false}
                                      inputProps={{
                                        "aria-label": `Inertia ellipsoid for ${linkKey} (disabled)`,
                                      }}
                                    />
                                  </span>
                                </Tooltip>
                                <Tooltip title="Configure session ID in panel settings">
                                  <span>
                                    <Checkbox
                                      size="small"
                                      className={classes.overlayCheckbox}
                                      disabled
                                      checked={false}
                                      inputProps={{
                                        "aria-label": `Collision geometry for ${linkKey} (disabled)`,
                                      }}
                                    />
                                  </span>
                                </Tooltip>
                              </div>
                            </div>
                            {isLinkOpen &&
                              linkJoints.map((joint) => {
                                const angle = jointAngles.get(
                                  `${model.name}/${joint.name}`,
                                );
                                return (
                                  <div
                                    key={`${linkKey}/${joint.name}`}
                                    className={classes.rowJoint}
                                  >
                                    <span className={classes.rowLabel}>
                                      {joint.name}
                                    </span>
                                    <span className={classes.jointAngle}>
                                      {formatAngle(angle)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      <Menu
        open={contextMenu != undefined}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu != undefined
            ? { top: contextMenu.y, left: contextMenu.x }
            : undefined
        }
      >
        <MenuItem onClick={handleOpenSdfClick}>Open SDF in VSCode</MenuItem>
        {/*
          MUI disables pointer events on a disabled MenuItem, which
          would suppress the Tooltip. Wrap in a <span> so the
          tooltip's mouse listeners still fire, matching the same
          pattern used for the disabled overlay checkboxes above.
        */}
        <Tooltip title="Requires service hot-reload (coming in M7)">
          <span>
            <MenuItem disabled>Reload model</MenuItem>
          </span>
        </Tooltip>
      </Menu>
    </div>
  );
}

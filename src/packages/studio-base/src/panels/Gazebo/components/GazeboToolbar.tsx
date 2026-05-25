// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Tooltip } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles()(() => ({
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "0 10px",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#161b22",
    borderBottom: "1px solid #21262d",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
  },
  sep: {
    width: 1,
    height: 28,
    backgroundColor: "#30363d",
    flexShrink: 0,
    margin: "0 4px",
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  groupLabel: {
    fontSize: 7,
    color: "#6e7681",
    letterSpacing: ".8px",
    marginRight: 1,
    whiteSpace: "nowrap" as const,
  },
  // Base icon button
  ib: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 4,
    background: "transparent",
    color: "#8b949e",
    fontSize: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
    transition: "background 0.15s, color 0.15s",
    padding: 0,
    "&:hover": {
      background: "#1c2128",
      color: "#c9d1d9",
    },
  },
  ibActive: {
    background: "rgba(249,115,22,.18)",
    color: "#f97316",
    outline: "1px solid #f97316",
  },
  ibDanger: {
    "&:hover": {
      color: "#ef4444",
    },
  },
}));

// ── Small helpers ─────────────────────────────────────────────────────────────

function Sep(): JSX.Element {
  const { classes } = useStyles();
  return <div className={classes.sep} />;
}

function GroupLabel({ text }: { text: string }): JSX.Element {
  const { classes } = useStyles();
  return <span className={classes.groupLabel}>{text}</span>;
}

type IbProps = {
  title: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

function IB({ title, active = false, danger = false, onClick, children }: IbProps): JSX.Element {
  const { classes, cx } = useStyles();
  return (
    <Tooltip title={title} placement="bottom" arrow>
      <button
        className={cx(classes.ib, active && classes.ibActive, danger && classes.ibDanger)}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// SVG icon components — sized to 13×13 to match the mockup
function IconTranslate(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="7" y1="1" x2="7" y2="13" />
      <line x1="1" y1="7" x2="13" y2="7" />
      <polyline points="5,3 7,1 9,3" />
      <polyline points="11,5 13,7 11,9" />
      <polyline points="5,11 7,13 9,11" />
      <polyline points="3,5 1,7 3,9" />
    </svg>
  );
}

function IconRotate(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 3A6 6 0 1 0 11 11" />
      <polyline points="11,8 11,12 7,12" />
    </svg>
  );
}

function IconScale(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="1" width="4" height="4" />
      <rect x="9" y="9" width="4" height="4" />
      <line x1="5" y1="5" x2="9" y2="9" />
    </svg>
  );
}

function IconSelect(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polyline points="2,2 2,11 5,8 7,12 9,11 7,7 11,7" />
    </svg>
  );
}

function IconDirLight(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="5" r="2.5" />
      <line x1="7" y1="9" x2="7" y2="13" />
      <line x1="2" y1="9" x2="4" y2="11" />
      <line x1="12" y1="9" x2="10" y2="11" />
    </svg>
  );
}

function IconPointLight(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="2.5" />
      <line x1="7" y1="1" x2="7" y2="3" />
      <line x1="7" y1="11" x2="7" y2="13" />
      <line x1="1" y1="7" x2="3" y2="7" />
      <line x1="11" y1="7" x2="13" y2="7" />
      <line x1="3" y1="3" x2="4.5" y2="4.5" />
      <line x1="11" y1="3" x2="9.5" y2="4.5" />
    </svg>
  );
}

function IconWireframe(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polygon points="7,1 13,12 1,12" />
      <line x1="7" y1="1" x2="7" y2="12" />
      <line x1="4" y1="6.5" x2="10" y2="6.5" />
    </svg>
  );
}

function IconJoints(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="2" />
      <circle cx="7" cy="7" r="5" />
      <line x1="7" y1="1" x2="7" y2="5" />
      <line x1="7" y1="9" x2="7" y2="13" />
      <line x1="1" y1="7" x2="5" y2="7" />
      <line x1="9" y1="7" x2="13" y2="7" />
    </svg>
  );
}

function IconInertia(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <ellipse cx="7" cy="7" rx="6" ry="3.5" />
      <ellipse cx="7" cy="7" rx="3.5" ry="6" />
    </svg>
  );
}

function IconScreenshot(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="3" width="12" height="9" rx="1" />
      <circle cx="7" cy="7.5" r="2.2" />
      <rect x="4" y="1" width="6" height="2" rx=".5" />
    </svg>
  );
}

function IconVideo(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="3" width="8" height="8" rx="1" />
      <polyline points="9,5 13,3 13,11 9,9" />
    </svg>
  );
}

// Expand (enter focus mode) icon
function IconExpand(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polyline points="1,5 1,1 5,1" />
      <polyline points="9,1 13,1 13,5" />
      <polyline points="13,9 13,13 9,13" />
      <polyline points="5,13 1,13 1,9" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  focusMode: boolean;
  onToggleFocus: () => void;
};

export function GazeboToolbar({ focusMode, onToggleFocus }: Props): JSX.Element {
  const { classes, cx } = useStyles();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const groupsRef    = useRef<HTMLDivElement | null>(null);
  const [availWidth, setAvailWidth] = useState(9999);

  useEffect(() => {
    const el = groupsRef.current;
    if (!el) { return; }
    const ro = new ResizeObserver(([entry]) => {
      if (entry) { setAvailWidth(entry.contentRect.width); }
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  // Thresholds based on measured cumulative group widths (label + buttons + inner gaps)
  // SIM and VIEW groups moved to CenterViewport HUDs — toolbar now starts with EDIT
  const showInsert = availWidth >= 420;
  const showViz    = availWidth >= 660;
  const showTools  = availWidth >= 820;

  return (
    <div ref={containerRef} className={classes.toolbar}>

      {/*
       * groups-inner: flex:1 + min-width:0 lets this div shrink below its
       * content size. overflow:hidden clips groups that no longer fit.
       * The expand button lives OUTSIDE this div so it is never clipped.
       */}
      <div
        ref={groupsRef}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
          height: "100%",
        }}
      >
        {/* ── EDIT ───────────────────────────────────── */}
        <div className={classes.group}>
          <GroupLabel text="EDIT" />
          <IB title="Select Mode" active><IconSelect /></IB>
          <IB title="Translate"><IconTranslate /></IB>
          <IB title="Rotate"><IconRotate /></IB>
          <IB title="Scale"><IconScale /></IB>
          <Box sx={{ width: 1, height: 20, bgcolor: "#30363d", mx: "2px" }} />
          <IB title="Copy">⬗</IB>
          <IB title="Paste">⬘</IB>
        </div>

        {showInsert && (
          <>
            <Sep />
            {/* ── INSERT ─────────────────────────────────── */}
            <div className={classes.group}>
              <GroupLabel text="INSERT" />
              <IB title="Spawn Box">■</IB>
              <IB title="Spawn Sphere">●</IB>
              <IB title="Spawn Cylinder">⬟</IB>
              <Box sx={{ width: 1, height: 20, bgcolor: "#30363d", mx: "2px" }} />
              <IB title="Add Directional Light"><IconDirLight /></IB>
              <IB title="Add Point Light"><IconPointLight /></IB>
            </div>
          </>
        )}

        {showViz && (
          <>
            <Sep />
            {/* ── VISUALIZE ──────────────────────────────── */}
            <div className={classes.group}>
              <GroupLabel text="VIZ" />
              <IB title="Transparent Mode">□</IB>
              <IB title="Wireframe"><IconWireframe /></IB>
              <IB title="Show Joints" active><IconJoints /></IB>
              <IB title="Show Collisions">▣</IB>
              <IB title="Show Inertia"><IconInertia /></IB>
              <IB title="Center of Mass">CoM</IB>
              <IB title="Show Contacts" active>✦</IB>
            </div>
          </>
        )}

        {showTools && (
          <>
            <Sep />
            {/* ── TOOLS ──────────────────────────────────── */}
            <div className={classes.group}>
              <GroupLabel text="TOOLS" />
              <IB title="Screenshot"><IconScreenshot /></IB>
              <IB title="Record Video"><IconVideo /></IB>
              <IB title="Tape Measure">↦</IB>
              <IB title="Shutdown" danger>⏻</IB>
            </div>
          </>
        )}
      </div>

      {/* ── Always-visible end — outside the overflow container ── */}
      <Sep />
      <Tooltip title="Focus Mode — hide all panels (F)" placement="bottom" arrow>
        <button
          className={cx(classes.ib, focusMode && classes.ibActive)}
          onClick={onToggleFocus}
        >
          <IconExpand />
        </button>
      </Tooltip>

    </div>
  );
}

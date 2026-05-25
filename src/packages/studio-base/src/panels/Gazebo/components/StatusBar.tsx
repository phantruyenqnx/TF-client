// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(() => ({
  root: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    paddingLeft: 10,
    paddingRight: 10,
    gap: 14,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 8,
    color: "#6e7681",
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    letterSpacing: ".4px",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    flexShrink: 0,
    boxShadow: "0 0 4px rgba(34,197,94,.7)",
  },
  brand: {
    color: "#c9d1d9",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: ".5px",
  },
  sep: {
    color: "#30363d",
    fontSize: 10,
    lineHeight: 1,
    flexShrink: 0,
  },
  badge: {
    padding: "1px 6px",
    borderRadius: 3,
    border: "1px solid #30363d",
    fontSize: 7,
    letterSpacing: ".6px",
    flexShrink: 0,
  },
  badgeOrange: {
    color: "#f97316",
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,.10)",
  },
  badgeCyan: {
    color: "#22d3ee",
    borderColor: "#22d3ee",
    backgroundColor: "rgba(34,211,238,.08)",
  },
  entity: {
    color: "#fb923c",
    fontWeight: 700,
  },
  spacer: { flex: 1 },
}));

type Props = {
  worldName?: string;
  selectedEntity?: string;
  connected?: boolean;
};

export function StatusBar({
  worldName = "default",
  selectedEntity = "x500",
  connected = true,
}: Props): JSX.Element {
  const { classes, cx } = useStyles();

  return (
    <div className={classes.root}>
      <div className={classes.dot} />
      <span className={classes.brand}>GAZEBO SIM 8.9.0</span>
      <span className={classes.sep}>│</span>
      <span>WORLD: <span style={{ color: "#c9d1d9" }}>{worldName}</span></span>
      <span className={classes.sep}>│</span>
      <span>
        ENTITY: <span className={classes.entity}>{selectedEntity}</span>
      </span>
      <span className={classes.sep}>│</span>
      <span
        style={{ color: connected ? "#22c55e" : "#ef4444" }}
      >
        {connected ? "GZWEB ✓" : "GZWEB ✗"}
      </span>

      <div className={classes.spacer} />

      <span className={cx(classes.badge, classes.badgeCyan)}>STEP: 0.001 s</span>
      <span className={cx(classes.badge, classes.badgeOrange)}>SELECT MODE</span>
    </div>
  );
}

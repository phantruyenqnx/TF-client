// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(({ typography }) => ({
  root: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    paddingLeft: 10,
    paddingRight: 10,
    gap: 14,
    fontFamily: typography.fontMonospace,
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    letterSpacing: ".4px",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "var(--color-success)",
    flexShrink: 0,
    boxShadow: "0 0 4px rgba(34,197,94,.7)",
  },
  brand: {
    color: "var(--color-text-primary)",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: ".5px",
  },
  sep: {
    color: "var(--color-border-default)",
    fontSize: 10,
    lineHeight: 1,
    flexShrink: 0,
  },
  badge: {
    padding: "1px 6px",
    borderRadius: 3,
    border: "1px solid var(--color-border-default)",
    fontSize: 7,
    letterSpacing: ".6px",
    flexShrink: 0,
  },
  badgeOrange: {
    color: "var(--color-accent)",
    borderColor: "var(--color-accent)",
    backgroundColor: "var(--color-accent-muted)",
  },
  badgeCyan: {
    color: "var(--color-info)",
    borderColor: "var(--color-info)",
    backgroundColor: "var(--color-info-muted)",
  },
  entity: {
    color: "var(--color-accent)",
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
      <span>WORLD: <span style={{ color: "var(--color-text-primary)" }}>{worldName}</span></span>
      <span className={classes.sep}>│</span>
      <span>
        ENTITY: <span className={classes.entity}>{selectedEntity}</span>
      </span>
      <span className={classes.sep}>│</span>
      <span
        style={{ color: connected ? "var(--color-success)" : "var(--color-danger)" }}
      >
        {connected ? "GZWEB ✓" : "GZWEB ✗"}
      </span>

      <div className={classes.spacer} />

      <span className={cx(classes.badge, classes.badgeCyan)}>STEP: 0.001 s</span>
      <span className={cx(classes.badge, classes.badgeOrange)}>SELECT MODE</span>
    </div>
  );
}

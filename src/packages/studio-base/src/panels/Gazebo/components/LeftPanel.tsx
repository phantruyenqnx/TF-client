// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { STUB_ENTITY_TREE } from "../placeholder";
import type { EntityNode, EntityNodeType } from "../types";

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles()(({ typography }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    fontFamily: typography.fontMonospace,
    fontSize: 11,
    color: "var(--color-text-primary)",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "var(--color-bg-panel)",
    borderBottom: "1px solid var(--color-border-subtle)",
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: "8px 4px",
    textAlign: "center" as const,
    fontSize: 9,
    color: "var(--color-text-tertiary)",
    cursor: "pointer",
    letterSpacing: ".6px",
    transition: "color .15s, border-color .15s",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: typography.fontMonospace,
    "&:hover": { color: "var(--color-text-primary)" },
  },
  tabActive: {
    color: "var(--color-accent)",
    borderBottom: "2px solid var(--color-accent) !important",
    fontWeight: 700,
    backgroundColor: "var(--color-bg-page)",
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "10px 8px",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-track": { background: "var(--color-bg-page)" },
    "&::-webkit-scrollbar-thumb": { background: "var(--color-border-default)", borderRadius: 3 },
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 8px",
    backgroundColor: "var(--color-bg-panel)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    marginBottom: 8,
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".8px",
  },
  // Entity tree rows
  treeRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 4px",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 9,
    color: "var(--color-text-primary)",
    "&:hover": { backgroundColor: "var(--color-bg-panel)" },
  },
  treeRowSelected: {
    backgroundColor: "var(--color-bg-panel)",
    color: "var(--color-accent)",
  },
  treeIcon: {
    fontSize: 9,
    color: "var(--color-text-tertiary)",
    width: 14,
    textAlign: "center" as const,
  },
  treeTag: {
    marginLeft: "auto",
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".3px",
    whiteSpace: "nowrap" as const,
  },
  // Resource items
  resSearch: {
    width: "100%",
    backgroundColor: "var(--color-bg-panel)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    padding: "5px 8px",
    color: "var(--color-text-primary)",
    fontFamily: typography.fontMonospace,
    fontSize: 9,
    marginBottom: 8,
    outline: "none",
    "&::placeholder": { color: "var(--color-text-tertiary)" },
  },
  resTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 8,
  },
  resTab: {
    padding: "3px 10px",
    fontSize: 8,
    borderRadius: 3,
    cursor: "pointer",
    backgroundColor: "var(--color-bg-panel)",
    color: "var(--color-text-tertiary)",
    border: "1px solid var(--color-border-default)",
    fontFamily: typography.fontMonospace,
  },
  resTabActive: {
    backgroundColor: "var(--color-accent-muted)",
    color: "var(--color-accent)",
    borderColor: "var(--color-accent)",
  },
  resItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 6px",
    borderRadius: 3,
    cursor: "pointer",
    borderBottom: "1px solid var(--color-border-subtle)",
    "&:hover": { backgroundColor: "var(--color-bg-panel)" },
  },
  resIcon: {
    width: 28,
    height: 28,
    backgroundColor: "var(--color-bg-elevated)",
    borderRadius: 3,
    border: "1px solid var(--color-border-default)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  resName: { fontSize: 9, color: "var(--color-text-primary)" },
  resSub: { fontSize: 8, color: "var(--color-text-tertiary)" },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const NODE_ICONS: Record<EntityNodeType, string> = {
  world: "◈",
  model: "▲",
  link:  "◆",
  joint: "↻",
  sensor: "○",
};

const TAG_COLORS: Record<EntityNodeType, string> = {
  world:  "#6e7681",
  model:  "#22d3ee",
  link:   "#22c55e",
  joint:  "#6e7681",
  sensor: "#fbbf24",
};

// Indent in pixels per depth level
const INDENT_PX = 14;

type TreeNodeProps = {
  node: EntityNode;
  depth: number;
};

function TreeNode({ node, depth }: TreeNodeProps): JSX.Element {
  const { classes, cx } = useStyles();
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <>
      <div
        className={cx(classes.treeRow, node.selected === true && classes.treeRowSelected)}
        style={{ paddingLeft: 5 + depth * INDENT_PX }}
        onClick={() => { if (hasChildren) setOpen((v) => !v); }}
      >
        {/* Collapse/expand indicator */}
        <span style={{ width: 10, flexShrink: 0, fontSize: 8, color: "var(--color-text-tertiary)" }}>
          {hasChildren ? (open ? "▾" : "▸") : ""}
        </span>
        <span className={classes.treeIcon}>{NODE_ICONS[node.type]}</span>
        <span>{node.label}</span>
        <span className={classes.treeTag} style={{ color: TAG_COLORS[node.type] }}>
          {node.type}
        </span>
      </div>

      {open && hasChildren &&
        node.children!.map((child) => (
          <TreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeftPanel(): JSX.Element {
  const { classes, cx } = useStyles();
  const [activeTab, setActiveTab] = useState<"tree" | "resources">("tree");

  return (
    <div className={classes.root}>

      {/* Tab bar */}
      <div className={classes.tabBar}>
        <button
          className={cx(classes.tab, activeTab === "tree" && classes.tabActive)}
          onClick={() => { setActiveTab("tree"); }}
        >
          ENTITY TREE
        </button>
        <button
          className={cx(classes.tab, activeTab === "resources" && classes.tabActive)}
          onClick={() => { setActiveTab("resources"); }}
        >
          RESOURCES
        </button>
      </div>

      {/* Tab content */}
      <div className={classes.body}>

        {/* ── ENTITY TREE ── */}
        {activeTab === "tree" && (
          <>
            <div className={classes.sectionHeader}>
              <span>WORLD — default</span>
              <span style={{ color: "var(--color-accent)", cursor: "pointer", fontWeight: 700, fontSize: 9 }}>
                ⋯
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {STUB_ENTITY_TREE.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
            </div>
          </>
        )}

        {/* ── RESOURCES ── */}
        {activeTab === "resources" && (
          <>
            <input
              className={classes.resSearch}
              placeholder="⌕  Search models…"
              type="text"
              readOnly
            />
            <div className={classes.resTabs}>
              <button className={cx(classes.resTab, classes.resTabActive)}>LOCAL</button>
              <button className={classes.resTab}>FUEL</button>
            </div>
            {[
              { icon: "▲", name: "x500",          sub: "tf-gz-models · quadcopter" },
              { icon: "■", name: "ground_plane",   sub: "gz-models · terrain" },
              { icon: "☀", name: "sun",            sub: "gz-models · light" },
              { icon: "■", name: "depot",          sub: "gz-models · environment" },
            ].map(({ icon, name, sub }) => (
              <div key={name} className={classes.resItem}>
                <div className={classes.resIcon}>{icon}</div>
                <div>
                  <div className={classes.resName}>{name}</div>
                  <div className={classes.resSub}>{sub}</div>
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}

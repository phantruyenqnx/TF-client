// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { STUB_ENTITY_TREE } from "../placeholder";
import type { EntityNode, EntityNodeType } from "../types";

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles()(() => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "#c9d1d9",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "#161b22",
    borderBottom: "1px solid #21262d",
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: "8px 4px",
    textAlign: "center" as const,
    fontSize: 9,
    color: "#6e7681",
    cursor: "pointer",
    letterSpacing: ".6px",
    transition: "color .15s, border-color .15s",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: "'JetBrains Mono', monospace",
    "&:hover": { color: "#c9d1d9" },
  },
  tabActive: {
    color: "#f97316",
    borderBottom: "2px solid #f97316 !important",
    fontWeight: 700,
    backgroundColor: "#0d1117",
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "10px 8px",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-track": { background: "#0d1117" },
    "&::-webkit-scrollbar-thumb": { background: "#30363d", borderRadius: 3 },
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 8px",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 3,
    marginBottom: 8,
    fontSize: 8,
    color: "#6e7681",
    letterSpacing: ".8px",
  },
  // Entity tree rows
  treeRow: {
    display: "flex",
    alignItems: "center",
    padding: "3px 5px",
    borderRadius: 3,
    cursor: "pointer",
    gap: 5,
    color: "#c9d1d9",
    fontSize: 10,
    "&:hover": { backgroundColor: "#161b22" },
  },
  treeRowSelected: {
    backgroundColor: "rgba(249,115,22,.10)",
    color: "#fb923c",
    fontWeight: 700,
  },
  treeIcon: {
    width: 12,
    textAlign: "center" as const,
    flexShrink: 0,
    fontSize: 9,
    color: "#6e7681",
  },
  treeTag: {
    marginLeft: "auto",
    fontSize: 8,
    color: "#6e7681",
    whiteSpace: "nowrap" as const,
  },
  // Resource items
  resSearch: {
    width: "100%",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 3,
    padding: "5px 8px",
    color: "#c9d1d9",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    marginBottom: 8,
    outline: "none",
    "&::placeholder": { color: "#6e7681" },
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
    backgroundColor: "#161b22",
    color: "#6e7681",
    border: "1px solid #30363d",
    fontFamily: "'JetBrains Mono', monospace",
  },
  resTabActive: {
    backgroundColor: "rgba(249,115,22,.15)",
    color: "#f97316",
    borderColor: "#f97316",
  },
  resItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 6px",
    borderRadius: 3,
    cursor: "pointer",
    borderBottom: "1px solid #21262d",
    "&:hover": { backgroundColor: "#161b22" },
  },
  resIcon: {
    width: 28,
    height: 28,
    backgroundColor: "#1c2128",
    borderRadius: 3,
    border: "1px solid #30363d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  resName: { fontSize: 9, color: "#c9d1d9" },
  resSub: { fontSize: 8, color: "#6e7681" },
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
        <span style={{ width: 10, flexShrink: 0, fontSize: 8, color: "#6e7681" }}>
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
              <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700, fontSize: 9 }}>
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

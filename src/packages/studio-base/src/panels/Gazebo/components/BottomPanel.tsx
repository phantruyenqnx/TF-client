// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Slider } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

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
    overflowX: "auto" as const,
    "&::-webkit-scrollbar": { height: 0 },
  },
  tab: {
    flexShrink: 0,
    padding: "7px 10px",
    fontSize: 8,
    color: "#6e7681",
    cursor: "pointer",
    letterSpacing: ".5px",
    whiteSpace: "nowrap" as const,
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
    overflow: "hidden",
    position: "relative" as const,
  },
  scrollBody: {
    height: "100%",
    overflowY: "auto" as const,
    padding: "10px 12px",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-track": { background: "#0d1117" },
    "&::-webkit-scrollbar-thumb": { background: "#30363d", borderRadius: 3 },
  },
  // Plotting
  plotHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  plotTitle: { fontSize: 8, color: "#6e7681", letterSpacing: ".6px" },
  plotAddBtn: {
    fontSize: 7,
    color: "#f97316",
    cursor: "pointer",
    background: "none",
    border: "1px solid #f97316",
    borderRadius: 3,
    padding: "2px 6px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  plotCanvas: {
    width: "100%",
    height: 100,
    backgroundColor: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
    overflow: "hidden",
  },
  plotLegend: {
    display: "flex",
    gap: 12,
    marginTop: 6,
    flexWrap: "wrap" as const,
  },
  plotLegendItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 7,
    color: "#6e7681",
  },
  plotDot: {
    width: 8,
    height: 2,
    borderRadius: 1,
    flexShrink: 0,
  },
  // Image viewer
  imageFrame: {
    width: "100%",
    height: 140,
    backgroundColor: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column" as const,
    gap: 6,
  },
  imageIcon: { fontSize: 28, color: "#30363d" },
  imageLabel: { fontSize: 8, color: "#6e7681", letterSpacing: ".5px" },
  // Topic echo / viewer
  topicSelector: {
    display: "flex",
    gap: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  topicSelect: {
    flex: 1,
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 3,
    padding: "4px 8px",
    color: "#c9d1d9",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 8,
    outline: "none",
  },
  topicSubBtn: {
    fontSize: 7,
    color: "#22d3ee",
    cursor: "pointer",
    background: "none",
    border: "1px solid #22d3ee",
    borderRadius: 3,
    padding: "4px 8px",
    fontFamily: "'JetBrains Mono', monospace",
    flexShrink: 0,
  },
  echoBlock: {
    backgroundColor: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    padding: "8px 10px",
    fontSize: 8,
    color: "#22c55e",
    lineHeight: 1.8,
    fontFamily: "'JetBrains Mono', monospace",
  },
  // Log playback
  playbackHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: "1px solid #30363d",
    background: "#161b22",
    color: "#c9d1d9",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    flexShrink: 0,
  },
  playbackTime: { fontSize: 9, color: "#22d3ee" },
  playbackDur: { fontSize: 9, color: "#6e7681", marginLeft: "auto" },
  // NavSat map
  mapFrame: {
    width: "100%",
    height: 130,
    backgroundColor: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    position: "relative" as const,
    overflow: "hidden",
  },
  mapGrid: {
    position: "absolute" as const,
    inset: 0,
    backgroundImage:
      "linear-gradient(#21262d 1px, transparent 1px), linear-gradient(90deg, #21262d 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  },
  mapCoords: {
    position: "absolute" as const,
    bottom: 6,
    right: 8,
    fontSize: 7,
    color: "#22d3ee",
    letterSpacing: ".4px",
  },
  mapMarker: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: "#f97316",
    border: "2px solid #fb923c",
    boxShadow: "0 0 6px rgba(249,115,22,.6)",
  },
  // Point cloud
  pcFrame: {
    width: "100%",
    height: 130,
    backgroundColor: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
    overflow: "hidden",
  },
  // Generic key-value rows
  kvRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
    borderBottom: "1px solid #21262d",
    "&:last-child": { borderBottom: "none" },
  },
  kvKey: { fontSize: 8, color: "#6e7681" },
  kvVal: { fontSize: 8, color: "#c9d1d9" },
}));

// ── Plotting SVG (stub waveform) ──────────────────────────────────────────────

function PlotSVG(): JSX.Element {
  const w = 600;
  const h = 90;
  const points = (color: string, offset: number, amp: number): string => {
    return Array.from({ length: 61 }, (_, i) => {
      const x = (i / 60) * w;
      const y = h / 2 + Math.sin((i / 60) * Math.PI * 6 + offset) * amp
              + Math.sin((i / 60) * Math.PI * 14 + offset * 2) * (amp * 0.3);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Grid lines */}
      {[1, 2, 3].map((i) => (
        <line key={i} x1="0" y1={h * i / 4} x2={w} y2={h * i / 4}
          stroke="#21262d" strokeWidth="1" />
      ))}
      <polyline points={points("#f97316", 0, 18)} fill="none" stroke="#f97316" strokeWidth="1.4" />
      <polyline points={points("#22d3ee", 1, 14)} fill="none" stroke="#22d3ee" strokeWidth="1.4" />
      <polyline points={points("#22c55e", 2, 10)} fill="none" stroke="#22c55e" strokeWidth="1.4" />
    </svg>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function PlottingTab(): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.scrollBody}>
      <div className={classes.plotHeader}>
        <span className={classes.plotTitle}>TOPIC PLOTTING</span>
        <button className={classes.plotAddBtn}>+ ADD TOPIC</button>
      </div>
      <div className={classes.plotCanvas}>
        <PlotSVG />
      </div>
      <div className={classes.plotLegend}>
        {[
          { color: "#f97316", label: "/imu/angular_velocity/z" },
          { color: "#22d3ee", label: "/imu/linear_acceleration/x" },
          { color: "#22c55e", label: "/odometry/local/twist/twist/linear/z" },
        ].map(({ color, label }) => (
          <div key={label} className={classes.plotLegendItem}>
            <div className={classes.plotDot} style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageViewerTab(): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.scrollBody}>
      <div className={classes.topicSelector}>
        <select className={classes.topicSelect}>
          <option value="">/camera/image_raw</option>
          <option value="">/camera/depth/image_rect_raw</option>
        </select>
        <button className={classes.topicSubBtn}>SUB</button>
      </div>
      <div className={classes.imageFrame}>
        <div className={classes.imageIcon}>▣</div>
        <div className={classes.imageLabel}>NO IMAGE — subscribe to a camera topic</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {[
          { k: "Encoding", v: "bgr8" },
          { k: "Size",     v: "640 × 480" },
          { k: "FPS",      v: "30" },
        ].map(({ k, v }) => (
          <div key={k} style={{ fontSize: 8, color: "#6e7681" }}>
            {k}: <span style={{ color: "#c9d1d9" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicEchoTab(): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.scrollBody}>
      <div className={classes.topicSelector}>
        <select className={classes.topicSelect}>
          <option>/world/default/stats</option>
          <option>/imu/data</option>
          <option>/navsat/fix</option>
        </select>
        <button className={classes.topicSubBtn}>ECHO</button>
      </div>
      <div className={classes.echoBlock}>
        <div style={{ color: "#6e7681", marginBottom: 4 }}>--- /world/default/stats</div>
        <div>sim_time:</div>
        <div style={{ paddingLeft: 12 }}>sec: 48</div>
        <div style={{ paddingLeft: 12 }}>nsec: 320000000</div>
        <div>real_time:</div>
        <div style={{ paddingLeft: 12 }}>sec: 49</div>
        <div style={{ paddingLeft: 12 }}>nsec: 100000000</div>
        <div>real_time_factor: <span style={{ color: "#22d3ee" }}>0.985</span></div>
        <div>iterations: <span style={{ color: "#22d3ee" }}>48320</span></div>
        <div style={{ color: "#6e7681", marginTop: 4 }}>---</div>
      </div>
    </div>
  );
}

function TopicViewerTab(): JSX.Element {
  const { classes } = useStyles();
  const topics = [
    { name: "/world/default/stats",               type: "gz.msgs.WorldStatistics" },
    { name: "/world/default/scene/info",          type: "gz.msgs.Scene" },
    { name: "/world/default/dynamic_pose/info",   type: "gz.msgs.Pose_V" },
    { name: "/imu/data",                          type: "gz.msgs.IMU" },
    { name: "/navsat/fix",                        type: "gz.msgs.NavSat" },
    { name: "/camera/image_raw",                  type: "gz.msgs.Image" },
    { name: "/command/motor_speed",               type: "gz.msgs.Actuators" },
  ];
  return (
    <div className={classes.scrollBody}>
      {topics.map(({ name, type }) => (
        <div key={name} className={classes.kvRow}>
          <span className={classes.kvKey}>{name}</span>
          <span className={classes.kvVal} style={{ color: "#22d3ee", fontSize: 7 }}>{type}</span>
        </div>
      ))}
    </div>
  );
}

function LogPlaybackTab(): JSX.Element {
  const { classes } = useStyles();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(23);
  const totalSec = 120;
  const currentSec = Math.round((position / 100) * totalSec);

  function formatSec(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className={classes.scrollBody}>
      <div className={classes.playbackHeader}>
        <button
          className={classes.playBtn}
          onClick={() => { setPlaying((v) => !v); }}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button className={classes.playBtn} onClick={() => { setPosition(0); }} title="Rewind">
          ⏮
        </button>
        <span className={classes.playbackTime}>{formatSec(currentSec)}</span>
        <span className={classes.playbackDur}>/ {formatSec(totalSec)}</span>
      </div>
      <Slider
        value={position}
        min={0}
        max={100}
        step={0.1}
        size="small"
        onChange={(_e, val) => { setPosition(val as number); }}
        sx={{
          color: "#f97316",
          padding: "6px 0",
          "& .MuiSlider-thumb": {
            width: 12,
            height: 12,
            "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 6px rgba(249,115,22,.2)" },
          },
          "& .MuiSlider-rail": { backgroundColor: "#30363d" },
        }}
      />
      <div style={{ marginTop: 8 }}>
        {[
          { k: "Log file",  v: "flight_2026-05-25.mcap" },
          { k: "Duration",  v: `${formatSec(totalSec)}` },
          { k: "Topics",    v: "7" },
          { k: "Start",     v: "2026-05-25 08:14:03 UTC" },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavSatMapTab(): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.scrollBody}>
      <div className={classes.mapFrame}>
        <div className={classes.mapGrid} />
        <div className={classes.mapMarker} />
        <div className={classes.mapCoords}>10.762622° N  106.660172° E</div>
      </div>
      <div style={{ marginTop: 8 }}>
        {[
          { k: "Lat",       v: "10.762622 °" },
          { k: "Lon",       v: "106.660172 °" },
          { k: "Alt (MSL)", v: "12.40 m" },
          { k: "Fix",       v: "3D FIX" },
          { k: "Sats",      v: "14" },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvVal} style={{ color: k === "Fix" ? "#22c55e" : "#c9d1d9" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointCloudTab(): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.scrollBody}>
      <div className={classes.topicSelector}>
        <select className={classes.topicSelect}>
          <option>/lidar/points</option>
          <option>/depth/points</option>
        </select>
        <button className={classes.topicSubBtn}>SUB</button>
      </div>
      <div className={classes.pcFrame}>
        {/* Stub dot cloud */}
        <svg width="100%" height="100%" viewBox="0 0 300 110" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 120 }, (_, i) => {
            const x = 15 + ((i * 97) % 270);
            const y = 10 + ((i * 61) % 90);
            const r = 1 + ((i * 13) % 3) * 0.5;
            const hue = (i * 7) % 360;
            return (
              <circle key={i} cx={x} cy={y} r={r}
                fill={`hsl(${hue},70%,55%)`} opacity={0.7} />
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: 8 }}>
        {[
          { k: "Topic",  v: "/lidar/points" },
          { k: "Points", v: "—" },
          { k: "Frame",  v: "base_link" },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type BottomTab =
  | "plotting"
  | "image"
  | "echo"
  | "topics"
  | "log"
  | "navsat"
  | "pointcloud";

const TABS: { id: BottomTab; label: string }[] = [
  { id: "plotting",    label: "PLOTTING" },
  { id: "image",       label: "IMAGE VIEWER" },
  { id: "echo",        label: "TOPIC ECHO" },
  { id: "topics",      label: "TOPIC VIEWER" },
  { id: "log",         label: "LOG PLAYBACK" },
  { id: "navsat",      label: "NAVSAT MAP" },
  { id: "pointcloud",  label: "POINT CLOUD" },
];

export function BottomPanel(): JSX.Element {
  const { classes, cx } = useStyles();
  const [activeTab, setActiveTab] = useState<BottomTab>("plotting");

  return (
    <div className={classes.root}>
      <div className={classes.tabBar}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={cx(classes.tab, activeTab === id && classes.tabActive)}
            onClick={() => { setActiveTab(id); }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={classes.body}>
        {activeTab === "plotting"   && <PlottingTab />}
        {activeTab === "image"      && <ImageViewerTab />}
        {activeTab === "echo"       && <TopicEchoTab />}
        {activeTab === "topics"     && <TopicViewerTab />}
        {activeTab === "log"        && <LogPlaybackTab />}
        {activeTab === "navsat"     && <NavSatMapTab />}
        {activeTab === "pointcloud" && <PointCloudTab />}
      </div>
    </div>
  );
}

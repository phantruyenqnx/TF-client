// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Slider } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { STUB_PHYSICS, STUB_POSE, STUB_ROTOR_SPEEDS, STUB_SENSOR_RATES } from "../placeholder";
import type { RotorSpeeds } from "../types";

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
    padding: "8px 2px",
    textAlign: "center" as const,
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    cursor: "pointer",
    letterSpacing: ".5px",
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
  sectionLabel: {
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".8px",
    marginBottom: 4,
    marginTop: 10,
  },
  card: {
    backgroundColor: "var(--color-bg-panel)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 4,
    padding: "8px 10px",
    marginBottom: 8,
  },
  // Vec3 grid: label | x | y | z
  vec3Grid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr 1fr 1fr",
    gap: "4px 6px",
    alignItems: "center",
  },
  vec3Label: {
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".5px",
  },
  vec3Cell: {
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    padding: "3px 6px",
    fontSize: 9,
    color: "var(--color-info)",
    textAlign: "right" as const,
  },
  vec3Header: {
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    textAlign: "center" as const,
  },
  // Key-value rows
  kvRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
    borderBottom: "1px solid var(--color-border-subtle)",
    "&:last-child": { borderBottom: "none" },
  },
  kvKey: {
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".4px",
  },
  kvValue: {
    fontSize: 9,
    color: "var(--color-text-primary)",
    fontWeight: 700,
  },
  // Sensor rows
  sensorRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 6px",
    borderRadius: 3,
    "&:hover": { backgroundColor: "var(--color-bg-elevated)" },
  },
  sensorName: { fontSize: 9, color: "var(--color-text-primary)" },
  sensorHz: { fontSize: 8, color: "var(--color-info)" },
  // Material swatches
  swatchRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 0",
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: "1px solid var(--color-border-default)",
    flexShrink: 0,
  },
  swatchLabel: { fontSize: 8, color: "var(--color-text-tertiary)" },
  swatchValue: { fontSize: 9, color: "var(--color-text-primary)", marginLeft: "auto" },
  // Inertia matrix cells
  matrixGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 3,
    marginTop: 4,
  },
  matrixCell: {
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    padding: "3px 6px",
    fontSize: 8,
    color: "var(--color-info)",
    textAlign: "center" as const,
  },
  matrixDiag: {
    color: "var(--color-accent)",
  },
  // Rotor slider rows
  rotorRow: {
    marginBottom: 14,
  },
  rotorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  rotorLabel: {
    fontSize: 9,
    color: "var(--color-text-primary)",
  },
  rotorValue: {
    fontSize: 9,
    color: "var(--color-info)",
    fontWeight: 700,
  },
  rotorDir: {
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    marginLeft: 6,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 3): string {
  return n.toFixed(decimals);
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function PropsTab(): JSX.Element {
  const { classes } = useStyles();
  const { position, rotation } = STUB_POSE;

  return (
    <>
      {/* Position / Rotation vec3 grids */}
      <div className={classes.sectionLabel}>POSE</div>
      <div className={classes.card}>
        <div className={classes.vec3Grid}>
          {/* Header row */}
          <div />
          <div className={classes.vec3Header}>X</div>
          <div className={classes.vec3Header}>Y</div>
          <div className={classes.vec3Header}>Z</div>
          {/* Position */}
          <div className={classes.vec3Label}>POS</div>
          <div className={classes.vec3Cell}>{fmt(position.x)}</div>
          <div className={classes.vec3Cell}>{fmt(position.y)}</div>
          <div className={classes.vec3Cell}>{fmt(position.z)}</div>
          {/* Rotation */}
          <div className={classes.vec3Label}>ROT</div>
          <div className={classes.vec3Cell}>{fmt(rotation.roll)}</div>
          <div className={classes.vec3Cell}>{fmt(rotation.pitch)}</div>
          <div className={classes.vec3Cell}>{fmt(rotation.yaw)}</div>
        </div>
      </div>

      {/* Sensors */}
      <div className={classes.sectionLabel}>SENSORS</div>
      <div className={classes.card}>
        {Object.entries(STUB_SENSOR_RATES).map(([name, hz]) => (
          <div key={name} className={classes.sensorRow}>
            <span className={classes.sensorName}>{name}</span>
            <span className={classes.sensorHz}>{hz} Hz</span>
          </div>
        ))}
      </div>

      {/* Material */}
      <div className={classes.sectionLabel}>MATERIAL</div>
      <div className={classes.card}>
        {[
          { label: "Diffuse",  value: "#1a1a2e", color: "#1a1a2e" },
          { label: "Specular", value: "#4a4a6a", color: "#4a4a6a" },
          { label: "Emissive", value: "#000000", color: "#010409" },
        ].map(({ label, value, color }) => (
          <div key={label} className={classes.swatchRow}>
            <div className={classes.swatch} style={{ backgroundColor: color }} />
            <span className={classes.swatchLabel}>{label}</span>
            <span className={classes.swatchValue}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function PhysicsTab(): JSX.Element {
  const { classes } = useStyles();
  const p = STUB_PHYSICS;

  return (
    <>
      <div className={classes.sectionLabel}>BODY</div>
      <div className={classes.card}>
        {[
          { k: "Mass",     v: `${p.mass} kg` },
          { k: "Gravity",  v: p.gravity ? "enabled" : "disabled" },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvValue}>{v}</span>
          </div>
        ))}
      </div>

      <div className={classes.sectionLabel}>INERTIA MATRIX (kg·m²)</div>
      <div className={classes.card}>
        <div className={classes.matrixGrid}>
          {/* Row 1 */}
          <div className={`${classes.matrixCell} ${classes.matrixDiag}`}>{p.ixx.toFixed(5)}</div>
          <div className={classes.matrixCell}>0.00000</div>
          <div className={classes.matrixCell}>0.00000</div>
          {/* Row 2 */}
          <div className={classes.matrixCell}>0.00000</div>
          <div className={`${classes.matrixCell} ${classes.matrixDiag}`}>{p.iyy.toFixed(5)}</div>
          <div className={classes.matrixCell}>0.00000</div>
          {/* Row 3 */}
          <div className={classes.matrixCell}>0.00000</div>
          <div className={classes.matrixCell}>0.00000</div>
          <div className={`${classes.matrixCell} ${classes.matrixDiag}`}>{p.izz.toFixed(5)}</div>
        </div>
      </div>

      <div className={classes.sectionLabel}>AERODYNAMICS</div>
      <div className={classes.card}>
        {[
          { k: "Motor constant",  v: p.motorConstant.toExponential(5) },
          { k: "Moment constant", v: p.momentConstant.toFixed(4) },
          { k: "Drag coefficient", v: p.dragCoefficient.toExponential(5) },
          { k: "Max rotor vel",   v: `${p.maxRotVelocity} rad/s` },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvValue}>{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function LightTab(): JSX.Element {
  const { classes } = useStyles();

  return (
    <>
      <div className={classes.sectionLabel}>SUN (DIRECTIONAL)</div>
      <div className={classes.card}>
        {[
          { k: "Type",       v: "Directional" },
          { k: "Cast shadow", v: "true" },
        ].map(({ k, v }) => (
          <div key={k} className={classes.kvRow}>
            <span className={classes.kvKey}>{k}</span>
            <span className={classes.kvValue}>{v}</span>
          </div>
        ))}
      </div>

      <div className={classes.sectionLabel}>DIRECTION</div>
      <div className={classes.card}>
        <div className={classes.vec3Grid}>
          <div />
          <div style={{ fontSize: 7, color: "var(--color-text-tertiary)", textAlign: "center" }}>X</div>
          <div style={{ fontSize: 7, color: "var(--color-text-tertiary)", textAlign: "center" }}>Y</div>
          <div style={{ fontSize: 7, color: "var(--color-text-tertiary)", textAlign: "center" }}>Z</div>
          <div className={classes.vec3Label}>DIR</div>
          <div className={classes.vec3Cell}>-0.500</div>
          <div className={classes.vec3Cell}>0.100</div>
          <div className={classes.vec3Cell}>-0.900</div>
        </div>
      </div>

      <div className={classes.sectionLabel}>COLOR</div>
      <div className={classes.card}>
        {[
          { label: "Diffuse",  value: "0.8 0.8 0.8", color: "#cccccc" },
          { label: "Specular", value: "0.2 0.2 0.2", color: "#333333" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <div className={classes.swatch} style={{ backgroundColor: color }} />
            <span className={classes.swatchLabel}>{label}</span>
            <span className={classes.swatchValue}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const ROTOR_LABELS = [
  { id: 0, name: "rotor_0", dir: "FR CCW" },
  { id: 1, name: "rotor_1", dir: "BL CCW" },
  { id: 2, name: "rotor_2", dir: "FL CW" },
  { id: 3, name: "rotor_3", dir: "BR CW" },
] as const;

function JointsTab(): JSX.Element {
  const { classes } = useStyles();
  const [speeds, setSpeeds] = useState<RotorSpeeds>([...STUB_ROTOR_SPEEDS]);

  return (
    <>
      <div className={classes.sectionLabel}>ROTOR SPEEDS (rad/s)</div>
      <div className={classes.card}>
        {ROTOR_LABELS.map(({ id, name, dir }) => (
          <div key={id} className={classes.rotorRow}>
            <div className={classes.rotorHeader}>
              <span className={classes.rotorLabel}>
                {name}
                <span className={classes.rotorDir}>{dir}</span>
              </span>
              <span className={classes.rotorValue}>{speeds[id]}</span>
            </div>
            <Slider
              value={speeds[id]}
              min={0}
              max={1000}
              step={1}
              size="small"
              onChange={(_e, val) => {
                setSpeeds((prev) => {
                  const next = [...prev] as RotorSpeeds;
                  next[id] = val as number;
                  return next;
                });
              }}
              sx={{
                color: "var(--color-accent)",
                padding: "6px 0",
                "& .MuiSlider-thumb": {
                  width: 10,
                  height: 10,
                  "&:hover, &.Mui-focusVisible": {
                    boxShadow: "0 0 0 6px color-mix(in srgb, var(--color-accent) 20%, transparent)",
                  },
                },
                "& .MuiSlider-rail": { backgroundColor: "var(--color-border-default)" },
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type RightTab = "props" | "physics" | "light" | "joints";

export function RightPanel(): JSX.Element {
  const { classes, cx } = useStyles();
  const [activeTab, setActiveTab] = useState<RightTab>("props");

  const tabs: { id: RightTab; label: string }[] = [
    { id: "props",   label: "PROPS" },
    { id: "physics", label: "PHYSICS" },
    { id: "light",   label: "LIGHT" },
    { id: "joints",  label: "JOINTS" },
  ];

  return (
    <div className={classes.root}>
      <div className={classes.tabBar}>
        {tabs.map(({ id, label }) => (
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
        {activeTab === "props"   && <PropsTab />}
        {activeTab === "physics" && <PhysicsTab />}
        {activeTab === "light"   && <LightTab />}
        {activeTab === "joints"  && <JointsTab />}
      </div>
    </div>
  );
}

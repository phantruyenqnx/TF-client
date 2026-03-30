// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PanelExtensionContext } from "@tf/studio";

import {
  BatteryStatus,
  Config,
  NAV_STATE_COLORS,
  NAV_STATE_LABELS,
  VehicleAttitude,
  VehicleGlobalPosition,
  VehicleLocalPosition,
  VehicleStatus,
  defaultConfig,
  getFlightStatus,
  quatToEuler,
} from "./types";

// ── Drone SVG arrow icon (points up = north, rotates with yaw) ──
function makeDroneIcon(yawDeg: number): L.DivIcon {
  // Arrow SVG pointing up, rotated by yaw
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <g transform="rotate(${yawDeg}, 18, 18)">
        <!-- Body -->
        <polygon points="18,4 26,28 18,23 10,28" fill="#1976d2" stroke="#fff" stroke-width="2"/>
        <!-- Center dot -->
        <circle cx="18" cy="18" r="3" fill="#fff"/>
      </g>
    </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

type Props = { context: PanelExtensionContext };

export function GCSPanel({ context }: Props): JSX.Element {
  // Always use defaultConfig for topic names so stale localStorage never breaks subscriptions
  const config: Config = defaultConfig;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | undefined>(undefined);
  const markerRef = useRef<L.Marker | undefined>(undefined);
  const pathRef = useRef<L.Polyline | undefined>(undefined);
  const pathPointsRef = useRef<L.LatLngTuple[]>([]);

  const [position, setPosition] = useState<VehicleGlobalPosition | undefined>(undefined);
  const [localPos, setLocalPos] = useState<VehicleLocalPosition | undefined>(undefined);
  const [attitude, setAttitude] = useState<VehicleAttitude | undefined>(undefined);
  const [status, setStatus] = useState<VehicleStatus | undefined>(undefined);
  const [battery, setBattery] = useState<BatteryStatus | undefined>(undefined);
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>(undefined);

  // Derived
  const euler = attitude ? quatToEuler(attitude.q) : undefined;
  // heading: prefer localPos.heading (NED yaw), else attitude yaw
  const headingRad = localPos?.heading_good_for_control
    ? localPos.heading
    : undefined;
  const headingDeg = headingRad != undefined ? (headingRad * 180) / Math.PI : (euler?.yaw ?? 0);

  // ── Init Leaflet map ──────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [0, 0],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
      touchZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 22,
    }).addTo(map);

    const marker = L.marker([0, 0], { icon: makeDroneIcon(0) }).addTo(map);
    const path = L.polyline([], { color: "#1976d2", weight: 2, opacity: 0.65 }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    pathRef.current = path;

    return () => {
      map.remove();
      mapRef.current = undefined;
      markerRef.current = undefined;
      pathRef.current = undefined;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update marker position + heading ─────────────────────────
  useEffect(() => {
    if (!position?.lat_lon_valid || !markerRef.current) {
      return;
    }
    const latlng: L.LatLngTuple = [position.lat, position.lon];

    markerRef.current.setLatLng(latlng);
    markerRef.current.setIcon(makeDroneIcon(headingDeg));

    pathPointsRef.current.push(latlng);
    if (pathPointsRef.current.length > 600) {
      pathPointsRef.current = pathPointsRef.current.slice(-600);
    }
    pathRef.current?.setLatLngs(pathPointsRef.current);

    if (config.followDrone && mapRef.current) {
      const zoom = Math.max(mapRef.current.getZoom(), 16);
      mapRef.current.setView(latlng, zoom);
    }
  }, [position, headingDeg, config.followDrone]);

  // ── Panel render lifecycle ────────────────────────────────────
  useLayoutEffect(() => {
    context.watch("colorScheme");
    context.watch("currentFrame");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
      for (const msg of renderState.currentFrame ?? []) {
        if (msg.topic === config.positionTopic) {
          setPosition(msg.message as VehicleGlobalPosition);
        } else if (msg.topic === config.localPositionTopic) {
          setLocalPos(msg.message as VehicleLocalPosition);
        } else if (msg.topic === config.attitudeTopic) {
          setAttitude(msg.message as VehicleAttitude);
        } else if (msg.topic === config.statusTopic) {
          setStatus(msg.message as VehicleStatus);
        } else if (msg.topic === config.batteryTopic) {
          setBattery(msg.message as BatteryStatus);
        }
      }
    };
  }, [
    context,
    config.positionTopic,
    config.localPositionTopic,
    config.attitudeTopic,
    config.statusTopic,
    config.batteryTopic,
  ]);

  // ── Subscribe to topics ───────────────────────────────────────
  useEffect(() => {
    context.subscribe([
      { topic: config.positionTopic },
      { topic: config.localPositionTopic },
      { topic: config.attitudeTopic },
      { topic: config.statusTopic },
      { topic: config.batteryTopic },
    ]);
    return () => context.unsubscribeAll();
  }, [
    context,
    config.positionTopic,
    config.localPositionTopic,
    config.attitudeTopic,
    config.statusTopic,
    config.batteryTopic,
  ]);

  useEffect(() => {
    renderDone?.();
  });

  // ── Theme ─────────────────────────────────────────────────────
  const isDark = colorScheme === "dark";
  const bg = isDark ? "#12131a" : "#f0f2f5";
  const cardBg = isDark ? "#1c1e2a" : "#ffffff";
  const textPrimary = isDark ? "#e8eaf6" : "#1a1a2e";
  const textMuted = isDark ? "#607d8b" : "#9e9e9e";
  const divider = isDark ? "#2a2d3e" : "#e0e0e0";

  // ── Derived display values ────────────────────────────────────
  const isArmed = status?.arming_state === 2;
  const flightStatus = status ? getFlightStatus(status) : undefined;
  const modeName = status != undefined
    ? (NAV_STATE_LABELS[status.nav_state] ?? `Mode ${status.nav_state}`)
    : "—";
  const modeColor = status != undefined
    ? (NAV_STATE_COLORS[status.nav_state] ?? "#9e9e9e")
    : textMuted;

  const battPct = battery != undefined ? Math.round(Number(battery.remaining) * 100) : undefined;
  const battColor =
    battPct == undefined ? textMuted
    : battPct > 50 ? "#4caf50"
    : battPct > 20 ? "#ff9800"
    : "#f44336";

  const hasGps = position?.lat_lon_valid === true;

  // Speed: horizontal = sqrt(vx²+vy²), vertical = |vz|
  const speedH =
    localPos?.v_xy_valid
      ? Math.sqrt(localPos.vx ** 2 + localPos.vy ** 2)
      : undefined;
  const speedV = localPos?.v_z_valid ? Math.abs(localPos.vz) : undefined;

  // Distance from origin in local frame
  const distFromOrigin =
    localPos?.xy_valid
      ? Math.sqrt(localPos.x ** 2 + localPos.y ** 2)
      : undefined;

  // Flight time in seconds from arming
  const flightTimeSec =
    status?.armed_time != undefined && Number(status.armed_time) > 0
      ? (Number(status.timestamp) - Number(status.armed_time)) / 1_000_000
      : undefined;
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: bg,
        color: textPrimary,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      {/* ── TOP STATUS BAR ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          background: cardBg,
          borderBottom: `1px solid ${divider}`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* Flight Status (Armed/Flying/Ready…) */}
        <StatusPill
          label="STATUS"
          value={flightStatus?.label ?? "—"}
          color={flightStatus?.color ?? textMuted}
          isDark={isDark}
        />

        {/* Arm/Disarm */}
        <StatusPill
          label="ARM"
          value={isArmed ? "ARMED" : "DISARMED"}
          color={isArmed ? "#f44336" : "#4caf50"}
          isDark={isDark}
        />

        {/* Flight Mode */}
        <StatusPill
          label="MODE"
          value={modeName}
          color={modeColor}
          isDark={isDark}
          wide
        />

        {/* GPS */}
        <StatusPill
          label="GPS"
          value={hasGps ? "FIX" : "NO FIX"}
          color={hasGps ? "#4caf50" : "#f44336"}
          isDark={isDark}
        />

        {/* Battery */}
        <StatusPill
          label="BAT"
          value={battPct != undefined ? `${battPct}%` : "—"}
          color={battColor}
          isDark={isDark}
        />

        {/* Pre-arm / Failsafe flags */}
        {status?.failsafe === true && (
          <StatusPill label="⚠" value="FAILSAFE" color="#f44336" isDark={isDark} blink />
        )}
        {!isArmed && status?.pre_flight_checks_pass === false && (
          <StatusPill label="⚠" value="PRE-ARM FAIL" color="#ff9800" isDark={isDark} />
        )}
        {status?.gcs_connection_lost === true && (
          <StatusPill label="⚠" value="GCS LOST" color="#f44336" isDark={isDark} blink />
        )}
      </div>

      {/* ── MAP ─────────────────────────────────────────────── */}
      <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0 }} />

      {/* ── BOTTOM TELEMETRY BAR ─────────────────────────────── */}
      <div
        style={{
          display: "flex",
          background: cardBg,
          borderTop: `1px solid ${divider}`,
          flexShrink: 0,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <TelCell label="ROLL" value={euler ? `${euler.roll.toFixed(1)}°` : "—"} muted={textMuted} text={textPrimary} />
        <TelCell label="PITCH" value={euler ? `${euler.pitch.toFixed(1)}°` : "—"} muted={textMuted} text={textPrimary} />
        <TelCell label="YAW" value={euler ? `${((euler.yaw % 360) + 360) % 360 | 0}°` : "—"} muted={textMuted} text={textPrimary} />
        <TelCell
          label="SPD H"
          value={speedH != undefined ? `${speedH.toFixed(1)} m/s` : "—"}
          muted={textMuted}
          text={textPrimary}
        />
        <TelCell
          label="SPD V"
          value={speedV != undefined ? `${speedV.toFixed(1)} m/s` : "—"}
          muted={textMuted}
          text={textPrimary}
        />
        <TelCell
          label="DIST"
          value={distFromOrigin != undefined ? `${distFromOrigin.toFixed(1)} m` : "—"}
          muted={textMuted}
          text={textPrimary}
        />
        <TelCell
          label="ALT AGL"
          value={
            localPos?.z_valid
              ? `${(-localPos.z).toFixed(1)} m`
              : "—"
          }
          muted={textMuted}
          text={textPrimary}
        />
        <TelCell
          label="FLY TIME"
          value={flightTimeSec != undefined && isArmed ? formatTime(flightTimeSec) : "—"}
          muted={textMuted}
          text={textPrimary}
        />
      </div>

      {/* Blink keyframe injected once */}
      <style>{`
        @keyframes gcs-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function StatusPill({
  label,
  value,
  color,
  isDark,
  wide = false,
  blink = false,
}: {
  label: string;
  value: string;
  color: string;
  isDark: boolean;
  wide?: boolean;
  blink?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        background: isDark ? "#0d1117" : "#f5f5f5",
        minWidth: wide ? 72 : 52,
        animation: blink ? "gcs-blink 1s step-start infinite" : undefined,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 8, color: isDark ? "#546e7a" : "#9e9e9e", letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontWeight: 700, fontSize: 12, color, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function TelCell({
  label,
  value,
  muted,
  text,
}: {
  label: string;
  value: string;
  muted: string;
  text: string;
}): JSX.Element {
  return (
    <div
      style={{
        flex: "1 1 80px",
        padding: "4px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderRight: "1px solid rgba(128,128,128,0.15)",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 9, color: muted, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: text,
          fontFamily: "monospace",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

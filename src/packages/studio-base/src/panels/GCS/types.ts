// GCS Panel types — PX4 ROS2 message definitions

export type Config = {
  positionTopic: string;
  localPositionTopic: string;
  statusTopic: string;
  batteryTopic: string;
  attitudeTopic: string;
  followDrone: boolean;
};

export const defaultConfig: Config = {
  positionTopic: "/fmu/out/vehicle_global_position",
  localPositionTopic: "/fmu/out/vehicle_local_position",
  statusTopic: "/fmu/out/vehicle_status_v1",
  batteryTopic: "/fmu/out/battery_status",
  attitudeTopic: "/fmu/out/vehicle_attitude",
  followDrone: true,
};

// px4_msgs/VehicleGlobalPosition
export type VehicleGlobalPosition = {
  timestamp: bigint;
  lat: number;
  lon: number;
  alt: number;
  alt_ellipsoid: number;
  lat_lon_valid: boolean;
  alt_valid: boolean;
  eph: number;
  epv: number;
};

// px4_msgs/VehicleLocalPosition
export type VehicleLocalPosition = {
  timestamp: bigint;
  xy_valid: boolean;
  z_valid: boolean;
  v_xy_valid: boolean;
  v_z_valid: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number; // yaw in radians (-PI..+PI)
  heading_good_for_control: boolean;
};

// px4_msgs/VehicleAttitude — quaternion q[w,x,y,z]
export type VehicleAttitude = {
  timestamp: bigint;
  q: [number, number, number, number]; // [w, x, y, z]
};

// px4_msgs/VehicleStatus
export type VehicleStatus = {
  timestamp: number;
  armed_time: number;
  takeoff_time: number;
  arming_state: number;
  nav_state: number;
  nav_state_user_intention: number;
  failsafe: boolean;
  failsafe_and_user_took_over: boolean;
  pre_flight_checks_pass: boolean;
  gcs_connection_lost: boolean;
  in_transition_mode: boolean;
  failure_detector_status: number;
  vehicle_type: number;
};

// px4_msgs/BatteryStatus
export type BatteryStatus = {
  timestamp: number;
  connected: boolean;
  voltage_v: number;
  current_a: number;
  remaining: number; // 0.0–1.0
  temperature: number;
  cell_count: number;
  time_remaining_s: number;
};

// ── Nav state labels matching QGC naming ─────────────────────
export const NAV_STATE_LABELS: Record<number, string> = {
  0: "Manual",
  1: "Altitude",
  2: "Position",
  3: "Mission",
  4: "Hold",
  5: "Return",
  6: "Pos Slow",
  10: "Acro",
  12: "Descend",
  13: "Terminate",
  14: "Offboard",
  15: "Stabilized",
  17: "Takeoff",
  18: "Land",
  19: "Follow Me",
  20: "Prec.Land",
  21: "Orbit",
  22: "VTOL Tkof",
};

export const NAV_STATE_COLORS: Record<number, string> = {
  0: "#ff9800", // Manual — orange
  1: "#03a9f4", // Altitude — blue
  2: "#03a9f4", // Position — blue
  3: "#9c27b0", // Mission — purple
  4: "#03a9f4", // Hold
  5: "#ff9800", // Return — orange
  10: "#ff5722", // Acro
  12: "#f44336", // Descend
  13: "#f44336", // Terminate
  14: "#9c27b0", // Offboard
  15: "#ff9800", // Stabilized
  17: "#4caf50", // Takeoff
  18: "#ff9800", // Land
  21: "#9c27b0", // Orbit
};

// Derived flight status from arming_state + nav_state + takeoff_time
export function getFlightStatus(s: VehicleStatus): { label: string; color: string } {
  if (s.arming_state !== 2) {
    return s.pre_flight_checks_pass
      ? { label: "Ready", color: "#4caf50" }
      : { label: "Not Ready", color: "#f44336" };
  }
  // Armed — derive state
  if (s.nav_state === 17) return { label: "Taking Off", color: "#4caf50" };
  if (s.nav_state === 18) return { label: "Landing", color: "#ff9800" };
  if (s.nav_state === 12) return { label: "Descending", color: "#ff9800" };
  if (s.nav_state === 13) return { label: "Terminated!", color: "#f44336" };
  if (s.failsafe) return { label: "Failsafe", color: "#f44336" };
  if (s.in_transition_mode) return { label: "Transition", color: "#ff9800" };
  // takeoff_time > 0 means it has taken off at some point
  const hasTakenOff = Number(s.takeoff_time) > 0;
  return hasTakenOff
    ? { label: "Flying", color: "#4caf50" }
    : { label: "Armed", color: "#ff5722" };
}

// ── Math helpers ─────────────────────────────────────────────

/** Convert quaternion [w,x,y,z] to Euler angles in degrees */
export function quatToEuler(q: [number, number, number, number]): {
  roll: number;
  pitch: number;
  yaw: number;
} {
  const [w, x, y, z] = q;
  // Roll (x-axis)
  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = (Math.atan2(sinrCosp, cosrCosp) * 180) / Math.PI;

  // Pitch (y-axis)
  const sinp = 2 * (w * y - z * x);
  const pitch =
    Math.abs(sinp) >= 1
      ? (Math.sign(sinp) * 90)
      : (Math.asin(sinp) * 180) / Math.PI;

  // Yaw (z-axis)
  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = (Math.atan2(sinyCosp, cosyCosp) * 180) / Math.PI;

  return { roll, pitch, yaw };
}

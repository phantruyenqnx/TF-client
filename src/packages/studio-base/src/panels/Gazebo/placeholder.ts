// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Static stub data used while real API/WebSocket integration is pending.
// Replace each constant with a live subscription when the backend is ready.

import type { EntityNode, WorldStats, PoseData, PhysicsData, RotorSpeeds } from "./types";

// Stub world statistics — replace with /world/*/stats gz-transport subscription
export const STUB_STATS: WorldStats = {
  iterations: 48320,
  simTime: "00:00:48.32",
  realTime: "00:00:49.10",
  rtf: 0.985,
  fps: 59.7,
  contacts: 2,
};

// x500 entity tree matching the actual SDF structure in tf-gz-models
// Replace with /world/*/scene/info subscription when ready
export const STUB_ENTITY_TREE: EntityNode[] = [
  {
    id: "world",
    label: "default",
    type: "world",
    children: [
      { id: "ground", label: "ground_plane", type: "model" },
      {
        id: "x500",
        label: "x500",
        type: "model",
        selected: true,
        children: [
          {
            id: "base_link",
            label: "base_link",
            type: "link",
            children: [
              { id: "imu", label: "imu_sensor", type: "sensor" },
              { id: "navsat", label: "navsat_sensor", type: "sensor" },
              { id: "baro", label: "air_pressure_sensor", type: "sensor" },
              { id: "mag", label: "magnetometer_sensor", type: "sensor" },
            ],
          },
          {
            id: "rotor_0",
            label: "rotor_0 (FR CCW)",
            type: "link",
            children: [{ id: "rotor_0_joint", label: "rotor_0_joint", type: "joint" }],
          },
          {
            id: "rotor_1",
            label: "rotor_1 (BL CCW)",
            type: "link",
            children: [{ id: "rotor_1_joint", label: "rotor_1_joint", type: "joint" }],
          },
          {
            id: "rotor_2",
            label: "rotor_2 (FL CW)",
            type: "link",
            children: [{ id: "rotor_2_joint", label: "rotor_2_joint", type: "joint" }],
          },
          {
            id: "rotor_3",
            label: "rotor_3 (BR CW)",
            type: "link",
            children: [{ id: "rotor_3_joint", label: "rotor_3_joint", type: "joint" }],
          },
        ],
      },
    ],
  },
];

// Pose of the x500 base_link at spawn — replace with /world/*/dynamic_pose/info
export const STUB_POSE: PoseData = {
  position: { x: 0, y: 0, z: 0.24 },
  rotation: { roll: 0, pitch: 0, yaw: 0 },
};

// Physics properties from x500_base SDF — replace with SDF parser or component msgs
export const STUB_PHYSICS: PhysicsData = {
  mass: 2.064,
  gravity: true,
  ixx: 0.00902,
  iyy: 0.00902,
  izz: 0.018,
  motorConstant: 8.54858e-6,
  momentConstant: 0.016,
  dragCoefficient: 8.06428e-5,
  maxRotVelocity: 1000,
};

// Initial rotor speeds in rad/s — replace with command/motor_speed topic
export const STUB_ROTOR_SPEEDS: RotorSpeeds = [523, 518, 531, 515];

// Sensor update rates from the SDF (Hz)
export const STUB_SENSOR_RATES: Record<string, number> = {
  imu_sensor: 250,
  navsat_sensor: 30,
  air_pressure_sensor: 50,
  magnetometer_sensor: 100,
};

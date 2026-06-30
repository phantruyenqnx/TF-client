// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Panel settings stored in the Studio layout
export type GazeboConfig = {
  websocketUrl: string;
};

// Entity types that appear in the scene tree
export type EntityNodeType = "world" | "model" | "link" | "joint" | "sensor";

export type EntityNode = {
  id: string;
  label: string;
  type: EntityNodeType;
  selected?: boolean;
  children?: EntityNode[];
};

// World statistics received from the /world/*/stats gz-transport topic.
// Fields are pre-formatted strings; raw numbers come later when the API is wired.
export type WorldStats = {
  iterations: number;
  simTime: string;
  realTime: string;
  rtf: number;
  fps: number;
  contacts: number;
};

// Pose of a selected entity (position in metres, rotation in radians)
export type PoseData = {
  position: { x: number; y: number; z: number };
  rotation: { roll: number; pitch: number; yaw: number };
};

// Physics properties of a rigid body link
export type PhysicsData = {
  mass: number;
  gravity: boolean;
  ixx: number;
  iyy: number;
  izz: number;
  motorConstant: number;
  momentConstant: number;
  dragCoefficient: number;
  maxRotVelocity: number;
};

// Four rotor speeds in rad/s: [FR rotor_0, BL rotor_1, FL rotor_2, BR rotor_3]
export type RotorSpeeds = [number, number, number, number];

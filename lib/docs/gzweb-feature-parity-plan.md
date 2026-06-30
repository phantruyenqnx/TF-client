# GZWeb Full Feature Parity Plan
**Target:** Bring `TF-client/lib` (gzweb v2.0.14 fork) to full visual parity with Gazebo Harmonic (gz-sim 8.9.0 / gz-gui 8.4.0) for all assets in `tf-gz-models/models` and `tf-gz-models/worlds`.

**Date:** 2026-05-21  
**Author:** Auto-generated from full codebase + bridge + asset audit

---

## 1. Architecture Overview

```
gz-sim (server) ──► gz-transport IPC ──► gz-launch-websocket-server (port 9002)
                                              │
                                    Protobuf binary frames
                                              │
                                         Transport.ts
                                              │
                                    SceneManager.ts ──► Scene.ts (THREE.js)
                                              │              │
                                         SDFParser.ts        └── FuelServer.ts
```

**Bridge config confirmed (`websocket.gzlaunch`):**
- Port: 9002, Publication cap: 100 Hz, No topic whitelist → ALL gz-transport topics forwarded
- `server.config` plugins: SceneBroadcaster (`publish_link_pose=true`), Sensors, IMU, NavSat, Contact, GstCamera
- Pose frames: SceneBroadcaster sends **parent-relative** poses → `setPose()` logic in SceneManager is correct
- No JointStatePublisher → dynamic_pose covers link motion
- No actor/skeleton system → out of scope

---

## 2. Asset Inventory (Ground Truth)

### 2.1 Models (46 directories)
| Category | Models | Key SDF Features |
|----------|--------|-----------------|
| UAV base | `x500_base`, `x500_hitl` | PBR albedo maps (`model://x500_base/materials/textures/*.png`), 4× revolute rotor joints, `.dae` meshes |
| UAV variants | `x500`, `x500_depth`, `x500_flow`, `x500_gimbal`, `x500_lidar_*`, `x500_mono_cam*`, `x500_vision`, `x500_uav_contest_2026` | Sensor attachments (camera, lidar, depth), IMU, NavSat, Magnetometer |
| Sensors | `gimbal`, `mono_cam`, `OakD-Lite`, `lidar_2d_v2`, `livox_mid_360`, `optical_flow`, `airspeed`, `LW20` | Camera, depth_camera, gpu_lidar, IMU sensors; 3× revolute joints (gimbal) |
| Rovers | `r1_rover`, `rover_ackermann`, `lawnmower` | STL meshes, IMU/NavSat, revolute wheel joints |
| Aircraft | `rc_cessna`, `standard_vtol`, `quadtailsitter`, `tiltrotor`, `advanced_plane`, `omnicopter`, `spacecraft_2d` | Complex joints, STL meshes |
| Environment | `Oak Tree`, `Pine Tree`, `grasspatch`, `baylands`, `Coast Water`, `workcell`, `arucotag`, `moving_platform`, `uav_contest_2026` | PBR with `model://` and relative URIs, `.dae` meshes |
| Misc | `tether_cable`, `payload`, `px4vision`, `Tarot650_base` | Fixed joints |

**Mesh formats used:** `.dae` (dominant), `.stl` (secondary). No `.obj`, `.glb`, `.gltf`.

### 2.2 Worlds (14 files)
| World | Key Features |
|-------|-------------|
| `default.sdf` | Ground plane, directional light, atmosphere |
| `baylands.sdf` | `<sky><clouds>true</clouds></sky>`, `<include>` for baylands + Coast Water |
| `forest.sdf` | 7× grasspatch (PBR, relative URI), ~20 tree includes |
| `lawn.sdf` | 2× directional lights, sky with clouds (speed=12) |
| `uav_contest_2026.sdf` | PBR textures on inline box models (Ground.png, Heliport.png, racing.png), contact sensors |
| `windy.sdf` | `<wind><linear_velocity>5 2 0</linear_velocity></wind>`, `<enable_wind>true` on link |
| `warehouse.sdf` | DART physics engine |
| `walls.sdf` | Inline box geometry walls |
| `aruco.sdf` | `<include>` for arucotag |
| `rover.sdf` | Grid visualization |
| `hitl_default.sdf` | `<include>` for x500_hitl |
| others | Standard ground plane + sun |

---

## 3. Feature Gap Analysis

### 3.1 Critical Bugs (P0 — Blocks Rendering)

#### BUG-01: Particle Emitter Null Crash
**File:** `SDFParser.ts:1792`  
**Symptom:** Any model with `<particle_emitter>` crashes the entire web client.  
**Root cause:** `particleMaterial.pbr.albedo_map` — no null guard.

```typescript
// BROKEN
const particleTextureUrl = particleMaterial.pbr.albedo_map;

// FIX
const particleTextureUrl = particleMaterial?.pbr?.albedo_map ?? '';
```

#### BUG-02: Particle Emitter Returns Empty Object
**File:** `SDFParser.ts:1882`  
**Symptom:** Particle effects never appear (particles run in Nebula system but the returned THREE.Object3D is unpopulated, never gets added to scene graph properly).  
**Root cause:** `particleEmitterObj` is created but nothing is ever added to it.

```typescript
// After nebulaEmitter setup, before return:
particleEmitterObj.userData.nebulaEmitter = nebulaEmitter;
particleEmitterObj.name = emitterName;
this.scene.setPose(particleEmitterObj, pose.position, pose.orientation);
return particleEmitterObj;
```

#### BUG-03: `<scene>` Element in World SDF Silently Ignored
**File:** `SDFParser.ts:spawnWorldFromSDF()` (~line 1389)  
**Symptom:** Ambient color, background color, fog, shadows, grid flags in all 14 worlds are ignored. Scene always renders with hardcoded defaults.  
**Affected worlds:** ALL 14 (all have `<scene><ambient>` and `<scene><background>`).  
**Root cause:** `spawnWorldFromSDF()` only processes `world.model`, `world.light`, `world.include` — never reads `world.scene`.

#### BUG-04: PBR Relative URI (No `model://` Prefix)
**File:** `SDFParser.ts:createMaterial()` (~line 534)  
**Symptom:** `grasspatch` model (used 7× in `forest.sdf`) renders without texture — albedo map `materials/textures/grass_dry.png` has no base URL context.  
**Root cause:** `createMaterial()` only handles `https://` URLs and filename-matching against `customUrls`. A relative path without scheme has no way to be resolved.  
**Models affected:** `grasspatch` (all forest.sdf instances).

---

### 3.2 Missing Topic Subscriptions (P1 — Bridge Sends, Client Ignores)

#### TOPIC-01: Entity Deletion
**Topic:** `/world/{world}/scene/deletion` (published by SceneBroadcaster)  
**File:** `SceneManager.ts:subscribeToTopics()` (~line 489)  
**Symptom:** When a model is deleted in Gazebo (e.g., `gz service -s /world/default/remove`), it stays visible on web forever.  

#### TOPIC-02: World Statistics
**Topic:** `/world/{world}/stats` (sim_time, real_time_factor)  
**File:** `SceneManager.ts`  
**Symptom:** No simulation time or RTF available to web UI components.

#### TOPIC-03: Camera Image Feed
**Topic:** `/model/{model}/sensor/{sensor}/camera` (gz.msgs.Image)  
**File:** `Transport.ts` already decodes image frames as raw bytes (line 433). `SceneManager.ts` never subscribes.  
**Symptom:** Onboard camera view (x500_mono_cam, gimbal camera) not available on web.  
**Models affected:** `x500_mono_cam`, `x500_mono_cam_down`, `x500_gimbal`, `gimbal`, `mono_cam`, `OakD-Lite`.

---

### 3.3 Missing SDF Parsing (P1 — Data Available, Not Rendered)

#### SDF-01: `<joint>` Elements
**File:** `SDFParser.ts:spawnModelFromSDF()` (~line 1309)  
**Symptom:** No joint axis visualization. `Scene.ts` already has a complete `viewJoints()` implementation (line 3006) that renders XYZ axes, revolute torus, prismatic arrow — it just never gets called.  
**Models affected:** `x500_base` (4× revolute), `gimbal` (3× revolute), `r1_rover`, `rover_ackermann`, `lawnmower`, all x500 variants.

#### SDF-02: World `<scene>` Sub-elements
**File:** `SDFParser.ts:spawnWorldFromSDF()`  
Already covered in BUG-03. Full list of sub-elements to parse:
- `<ambient>` — ambient light color
- `<background>` — sky background color  
- `<fog>` — fog with type, color, density (Scene.ts has `setFog()` at line 817, never called from SDF)
- `<shadows>` — enable/disable shadows globally
- `<grid>` — show/hide ground grid (Scene.ts has grid display, never driven from SDF)
- `<sky>` with `<clouds>` — sky box + cloud rendering

#### SDF-03: Sensor Visualization
**File:** `SDFParser.ts:createSensor()` (line 1163) — returns empty `THREE.Object3D`.  
**Sensor types actually used in models:**

| Sensor Type | Count | Visual Representation Needed |
|-------------|-------|------------------------------|
| `camera` | 4 | Camera frustum wireframe (CameraHelper) |
| `depth_camera` | 1 | Camera frustum wireframe |
| `imu` | ~15 | Small orientation marker (arrow) |
| `air_pressure` | ~15 | Small sphere marker |
| `magnetometer` | ~15 | Small sphere marker |
| `navsat` (GPS) | ~15 | Antenna marker |
| `gpu_lidar` | 2 | Rotating scan plane or point cloud |
| `contact` | 5+ | Contact point indicator |

#### SDF-04: `<double_sided>` Material Property
**File:** `SDFParser.ts:createMaterial()` / `Scene.ts:setMaterial()`  
**Symptom:** `Oak Tree` branches (leaves) only visible from one side. Backfaces culled.  
**Models affected:** `Oak Tree`, `Pine Tree` (both have `<double_sided>true</double_sided>`).

#### SDF-05: `<script>` + `<pbr>` Combination
**File:** `SDFParser.ts:createMaterial()`  
**Symptom:** `Oak Tree` and `Pine Tree` have both `<script>` (Gazebo material) and `<pbr>` in the same `<material>` block. The web client should ignore the `<script>` block entirely and use `<pbr>` only (scripts are Ogre-specific, not available in THREE.js). Currently the parser processes them independently and the behavior is undefined.

#### SDF-06: `<wind>` Element
**File:** `SDFParser.ts:spawnWorldFromSDF()` / `SDFParser.ts:createLink()`  
**Symptom:** `windy.sdf` wind information (`linear_velocity: 5 2 0`) is not parsed. Link `<enable_wind>` flag ignored.  
**Minimum viable:** Parse and expose `world.wind.linear_velocity` as metadata; add visual wind direction indicator. No physics needed.

---

### 3.4 Rendering Gaps (P2 — Quality / Visual Fidelity)

#### RENDER-01: Sky + Cloud Rendering
**File:** `SceneManager.ts:sceneInfoSubscription` (line 373) handles `sceneInfo.sky` but only for cubemap URIs.  
**Actual usage:** `baylands.sdf` and `lawn.sdf` use `<sky><clouds>true</clouds></sky>` — no cubemap URI, just a boolean cloud flag.  
**Fix:** When `<sky>` is present without cubemap, fall back to THREE.js procedural sky (e.g., `Sky` from `three/examples/jsm/objects/Sky.js`).

#### RENDER-02: GPU LIDAR Point Cloud
**Models:** `x500_lidar_2d`, `x500_lidar_down`, `x500_lidar_front`, `x500_lidar_down`, `lidar_2d_v2`, `livox_mid_360`.  
**Topic:** `/model/{model}/sensor/{sensor}/scan` (gz.msgs.LaserScan or PointCloudPacked)  
**Fix:** Subscribe to lidar scan topic, render as `THREE.Points` with `BufferGeometry`.

#### RENDER-03: `metalness` + `roughness` Direct Values
**File:** `SDFParser.ts:createMaterial()` (line 491)  
**Already parsed?** Yes — `material.pbr.metalness = srcMaterial.pbr.metal.metalness` is there. But `Scene.ts:setMaterial()` must apply these to `MeshStandardMaterial.metalness` and `MeshStandardMaterial.roughness`.  
**Affected:** `uav_contest_2026.sdf` zones (metalness=0.0, roughness=0.9), `uav_contest_2026.sdf` helipad (roughness=0.8).  
**Verify this works end-to-end** — parsed value may never reach THREE.js material.

---

## 4. Implementation Plan

### Phase 1 — Critical Bug Fixes
**Effort:** ~3h | **Risk:** Low | **Files:** `SDFParser.ts`

| Task | Location | Change |
|------|----------|--------|
| BUG-01: Particle null guard | `SDFParser.ts:1792` | Optional chaining `?.` + nullish coalescing |
| BUG-02: Particle empty return | `SDFParser.ts:1880-1882` | Populate `particleEmitterObj` before return |
| BUG-03: Parse `world.scene` | `SDFParser.ts:spawnWorldFromSDF()` | Add block to read ambient, background, fog, shadows, grid, sky |
| BUG-04: Relative PBR URI | `SDFParser.ts:createMaterial()` | Pass model base URL context; resolve relative paths |

**For BUG-03, add to `spawnWorldFromSDF()` after parsing lights:**
```typescript
if (sdfObj.world.scene) {
  const s = sdfObj.world.scene;
  if (s.ambient)    this.scene.setAmbient(this.parseColor(s.ambient));
  if (s.background) this.scene.setBackground(this.parseColor(s.background));
  if (s.fog)        this.scene.setFog(this.parseColor(s.fog.color || '1 1 1 1'),
                                       parseFloat(s.fog.density || '0.001'));
  if (s.grid !== undefined)    this.scene.showGrid(this.parseBool(String(s.grid)));
  if (s.shadows !== undefined) this.scene.enableShadows(this.parseBool(String(s.shadows)));
  if (s.sky) {
    if (s.sky.clouds) this.scene.addProceduralSky(this.parseBool(String(s.sky.clouds)));
    else              this.scene.addSky();
  }
}
```

**Required additions to `Scene.ts`:**
- `setAmbient(color: Color)` — set `this.ambient.color`
- `setBackground(color: Color)` — set `this.scene.background`
- `showGrid(visible: boolean)` — toggle grid visibility
- `enableShadows(enabled: boolean)` — toggle shadow map renderer
- `addProceduralSky(withClouds: boolean)` — THREE.js Sky shader

**For BUG-04**, `createMaterial()` needs a `modelBaseUrl` parameter passed down from `createGeom()` → `createVisual()` → `createLink()` → `spawnModelFromSDF()` so relative texture paths can be resolved:
```typescript
// In createMaterial(), after checking for https://
if (!albedoMapUri.includes('://') && modelBaseUrl) {
  albedoMap = `${modelBaseUrl}/${albedoMapUri}`;
}
```

---

### Phase 2 — Missing Topic Subscriptions
**Effort:** ~2.5h | **Risk:** Low | **Files:** `SceneManager.ts`, `Transport.ts`

#### TOPIC-01: Entity Deletion
Add to `SceneManager.ts:subscribeToTopics()`:
```typescript
const deletionTopic = new Topic(
  `/world/${this.transport.getWorld()}/scene/deletion`,
  (msg: any) => {
    (msg['entity'] ?? []).forEach((ent: any) => {
      const obj = this.scene.getByName(ent['name']);
      if (obj) {
        this.scene.remove(obj);
        this.models = this.models.filter(m => m['gz3dName'] !== ent['name']);
      }
    });
  }
);
this.transport.subscribe(deletionTopic);
```

#### TOPIC-02: World Statistics
Add to `SceneManager.ts`:
```typescript
public simTime$ = new BehaviorSubject<number>(0);
public realTimeFactor$ = new BehaviorSubject<number>(0);

// In subscribeToTopics():
this.transport.subscribe(new Topic(
  `/world/${this.transport.getWorld()}/stats`,
  (msg: any) => {
    const sec  = msg['sim_time']?.['sec']  ?? 0;
    const nsec = msg['sim_time']?.['nsec'] ?? 0;
    this.simTime$.next(sec + nsec * 1e-9);
    this.realTimeFactor$.next(msg['real_time_factor'] ?? 0);
  }
));
```

#### TOPIC-03: Camera Feed API
Add to `SceneManager.ts`:
```typescript
public subscribeToCameraFeed(
  topic: string,
  onFrame: (data: Uint8Array, width: number, height: number) => void
): void {
  this.transport.subscribeToImageTopic(topic, onFrame);
}
```

Add to `Transport.ts`:
```typescript
private imageCallbacks = new Map<string, (d: Uint8Array, w: number, h: number) => void>();

public subscribeToImageTopic(
  topic: string,
  cb: (data: Uint8Array, width: number, height: number) => void
): void {
  this.imageCallbacks.set(topic, cb);
  this.sendMessage(['subscribe', topic, 'gz.msgs.Image', '']);
}
```
Wire the existing image-frame handling in `onMessage()` (lines 433–434) to call `imageCallbacks.get(frameTopic)?.(imageBytes, width, height)`.

---

### Phase 3 — Missing SDF Parsing
**Effort:** ~4h | **Risk:** Low–Medium | **Files:** `SDFParser.ts`, `Scene.ts`

#### SDF-01: Joint Visualization
`Scene.ts` already has complete joint visualization at `viewJoints()` (line 3006). Only need to wire SDF data to it.

Add to `SDFParser.ts:spawnModelFromSDF()` after link loop:
```typescript
if (sdfObj.model.joint) {
  if (!(sdfObj.model.joint instanceof Array))
    sdfObj.model.joint = [sdfObj.model.joint];

  modelObj.userData.joints = sdfObj.model.joint.map((j: any) => ({
    name:  j['@name'] || j['name'],
    type:  this.parseJointType(j['@type'] || j['type'] || 'fixed'),
    parent: j.parent,
    child:  j.child,
    axis:  j.axis  ? { xyz: this.parse3DVector(j.axis.xyz  || '0 0 1') } : { xyz: new THREE.Vector3(0,0,1) },
    axis2: j.axis2 ? { xyz: this.parse3DVector(j.axis2.xyz || '0 1 0') } : undefined,
    pose:  j.pose  ? this.parsePose(j.pose) : new Pose(),
  }));
  // Scene.viewJoints() uses modelObj.userData.joints directly
}
```

Add private helper:
```typescript
private parseJointType(s: string): number {
  const map: Record<string, number> = {
    revolute:1, revolute2:2, prismatic:3, universal:4,
    ball:5, screw:6, gearbox:7, fixed:8, continuous:1
  };
  return map[s.toLowerCase()] ?? 8;
}
```

**Joint types used in actual models:**
- `revolute` (22 joints): x500_base rotors, gimbal arms, r1_rover wheels
- `universal` (24 joints): gimbal multi-DOF mounts
- `fixed` (19 joints): camera/sensor attachments, tether
- `ball` (1 joint): specialized

#### SDF-03: Sensor Visualization
Rewrite `SDFParser.ts:createSensor()`:
```typescript
public createSensor(sensor: any, options: any): THREE.Object3D {
  const obj = new THREE.Object3D();
  obj.name = sensor['name'] || sensor['@name'] || '';
  const type = sensor['@type'] || sensor['type'] || '';

  if (sensor.pose) {
    const p = this.parsePose(sensor.pose);
    this.scene.setPose(obj, p.position, p.orientation);
  }

  switch (type) {
    case 'camera':
    case 'depth_camera':
    case 'rgbd_camera': {
      const hfov   = parseFloat(sensor.camera?.horizontal_fov ?? '1.047');
      const w      = parseFloat(sensor.camera?.image?.width   ?? '640');
      const h      = parseFloat(sensor.camera?.image?.height  ?? '480');
      const near   = parseFloat(sensor.camera?.clip?.near     ?? '0.1');
      const far    = Math.min(parseFloat(sensor.camera?.clip?.far ?? '100'), 10);
      obj.add(this.scene.createCameraFrustum(hfov, w / h, near, far));
      break;
    }
    case 'gpu_lidar':
    case 'ray':
    case 'lidar':
      obj.add(this.scene.createSensorMarker('lidar'));
      break;
    case 'imu':
      obj.add(this.scene.createSensorMarker('imu'));
      break;
    case 'navsat':
      obj.add(this.scene.createSensorMarker('gps'));
      break;
    case 'magnetometer':
    case 'air_pressure':
    case 'air_speed':
      obj.add(this.scene.createSensorMarker('generic'));
      break;
    case 'contact':
      obj.add(this.scene.createSensorMarker('contact'));
      break;
  }
  return obj;
}
```

**Add to `Scene.ts`:**
```typescript
public createCameraFrustum(hfov: number, aspect: number, near: number, far: number): THREE.Object3D {
  const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(hfov), aspect, near, far);
  const helper = new THREE.CameraHelper(cam);
  helper.name = 'SENSOR_VISUAL';
  return helper;
}

public createSensorMarker(type: string): THREE.Object3D {
  const colors: Record<string, number> = {
    lidar: 0x00ff00, camera: 0x0088ff, imu: 0xff8800,
    gps: 0x00ffff, contact: 0xff0000, generic: 0xffffff
  };
  const geo = new THREE.SphereGeometry(0.05);
  const mat = new THREE.MeshBasicMaterial({ color: colors[type] ?? 0xffffff });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'SENSOR_VISUAL';
  return m;
}
```

#### SDF-04: `<double_sided>` Material
**File:** `SDFParser.ts:createMaterial()` — parse flag and store in `Material` object.  
**File:** `Scene.ts:setMaterial()` — apply `material.side = THREE.DoubleSide` when flag set.

```typescript
// SDFParser.createMaterial():
material.doubleSided = this.parseBool(srcMaterial.double_sided) || false;

// Scene.setMaterial():
if (material.doubleSided) {
  threeMat.side = THREE.DoubleSide;
}
```

**Add `doubleSided: boolean` field to `Material.ts`.**

#### SDF-05: `<script>` + `<pbr>` Combination
**File:** `SDFParser.ts:createMaterial()`  
When both `<script>` and `<pbr>` are present, `<pbr>` takes precedence. Scripts reference Ogre RTSS shaders which don't exist in THREE.js. Simply skip `<script>` processing when `<pbr>` is present:
```typescript
// In createMaterial(), only process script if pbr is absent:
if (!srcMaterial.pbr && srcMaterial.script) {
  // ... existing script handling (currently there is none — no-op)
}
// pbr is already processed separately
```
*Note: script-based materials (Gazebo/Grey etc.) are not rendered anyway — this is just to prevent potential future conflicts.*

#### SDF-06: Wind Metadata
**File:** `SDFParser.ts:spawnWorldFromSDF()`  
Minimal: parse and attach to worldObj userData for UI display:
```typescript
if (sdfObj.world.wind) {
  const vel = this.parse3DVector(sdfObj.world.wind.linear_velocity || '0 0 0');
  worldObj.userData.wind = { velocity: vel };
  // Optional: add wind direction arrow via Scene.createWindIndicator()
}
```

---

### Phase 4 — Rendering Quality
**Effort:** ~3h | **Risk:** Medium | **Files:** `Scene.ts`, `SceneManager.ts`

#### RENDER-01: Procedural Sky + Clouds
`Scene.ts` has `addSky(cubemapUri?)` (line 694). When called without URI, add `THREE.Sky` shader:
```typescript
import { Sky } from 'three/examples/jsm/objects/Sky.js';

public addProceduralSky(withClouds: boolean = false): void {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  sky.material.uniforms['sunPosition'].value.set(0.3, 0.8, 0.2);
  sky.material.uniforms['turbidity'].value = withClouds ? 6 : 2;
  sky.material.uniforms['rayleigh'].value = 1;
  this.scene.add(sky);
}
```
`THREE.Sky` (MIT licensed, part of three.js examples) provides physically-based atmosphere with configurable turbidity for cloud effect.

#### RENDER-02: GPU LIDAR Point Cloud
**Subscribe in `SceneManager.ts`:**
```typescript
public subscribeLidarFeed(
  topic: string,
  modelName: string
): void {
  this.transport.subscribe(new Topic(topic, (msg: any) => {
    const points = this.scene.updateLidarCloud(modelName, msg);
  }));
}
```

**Add to `Scene.ts`:**
```typescript
private lidarClouds = new Map<string, THREE.Points>();

public updateLidarCloud(name: string, scanMsg: any): void {
  const ranges: number[] = scanMsg['ranges'] ?? [];
  const angleMin: number = scanMsg['angle_min'] ?? 0;
  const angleStep: number = scanMsg['angle_step'] ?? 0.01;
  const positions: number[] = [];

  ranges.forEach((r, i) => {
    if (r > 0 && isFinite(r)) {
      const a = angleMin + i * angleStep;
      positions.push(r * Math.cos(a), r * Math.sin(a), 0);
    }
  });

  let cloud = this.lidarClouds.get(name);
  if (!cloud) {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.PointsMaterial({ color: 0x00ff00, size: 0.05 });
    cloud = new THREE.Points(geo, mat);
    cloud.name = `${name}_lidar_cloud`;
    this.scene.add(cloud);
    this.lidarClouds.set(name, cloud);
  }
  cloud.geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(positions, 3));
  cloud.geometry.computeBoundingSphere();
}
```

#### RENDER-03: Verify Metalness/Roughness Direct Values
**File:** `Scene.ts:setMaterial()` — confirm `MeshStandardMaterial` receives both mapped and direct values:
```typescript
// Verify this block exists and is complete:
if (material.pbr) {
  const mat = new THREE.MeshStandardMaterial();
  if (material.pbr.metalness  !== undefined) mat.metalness  = material.pbr.metalness;
  if (material.pbr.roughness  !== undefined) mat.roughness  = material.pbr.roughness;
  if (material.pbr.albedoMap)  mat.map          = loadTexture(material.pbr.albedoMap);
  if (material.pbr.normalMap)  mat.normalMap    = loadTexture(material.pbr.normalMap);
  if (material.pbr.roughnessMap) mat.roughnessMap = loadTexture(material.pbr.roughnessMap);
  if (material.pbr.metalnessMap) mat.metalnessMap = loadTexture(material.pbr.metalnessMap);
  // ...
}
```

---

### Phase 5 — Bridge Optimization
**Effort:** ~1h | **Risk:** Low | **Files:** `websocket.gzlaunch`, `SceneManager.ts`

#### OPT-01: Topic Whitelist
Current config floods the websocket with ALL gz-transport topics (sensor data, IMU at 100Hz, etc.).  
**Verify that `gz-launch-websocket-server` supports `<topic_whitelist>` with regex.**  
If supported, add to `websocket.gzlaunch`:
```xml
<topic_whitelist>
  /world/.*/dynamic_pose/info
  /world/.*/scene/info
  /world/.*/scene/deletion
  /world/.*/stats
  /model/.*/sensor/.*/camera
  /model/.*/sensor/.*/depth_camera
  /model/.*/sensor/.*/scan
</topic_whitelist>
```
If not supported natively, implement client-side topic filtering in `Transport.ts`.

#### OPT-02: fileFromUrl → fetch
**File:** `SDFParser.ts:2058-2089`  
Replace legacy `XMLHttpRequest` with `fetch`:
```typescript
public async fileFromUrl(url: string): Promise<Document | null> {
  const headers: HeadersInit = this.requestHeaderKey
    ? { [this.requestHeaderKey]: this.requestHeaderValue } : {};
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new DOMParser().parseFromString(await res.text(), 'text/xml');
  } catch (e) {
    console.error(`fileFromUrl failed [${url}]:`, e);
    return null;
  }
}
```
All callers must be updated from callback pattern to `await`.

---

## 5. Execution Order

| # | Phase | Tasks | Files Changed | Effort | Risk |
|---|-------|-------|---------------|--------|------|
| 1 | Bug Fixes | BUG-01, BUG-02 | SDFParser.ts | 1h | Low |
| 2 | Scene Parsing | BUG-03, SDF-02 | SDFParser.ts, Scene.ts | 2h | Low |
| 3 | PBR URI Fix | BUG-04, SDF-05 | SDFParser.ts | 1h | Medium |
| 4 | Material Quality | SDF-04, RENDER-03 | SDFParser.ts, Scene.ts, Material.ts | 1h | Low |
| 5 | Topic Subscriptions | TOPIC-01, TOPIC-02 | SceneManager.ts | 1h | Low |
| 6 | Joint Visualization | SDF-01 | SDFParser.ts | 1.5h | Low |
| 7 | Sensor Visualization | SDF-03 | SDFParser.ts, Scene.ts | 2h | Medium |
| 8 | Sky Rendering | RENDER-01 | Scene.ts, SceneManager.ts | 1.5h | Medium |
| 9 | Camera Feed | TOPIC-03 | SceneManager.ts, Transport.ts | 2h | Medium |
| 10 | LIDAR Point Cloud | RENDER-02 | Scene.ts, SceneManager.ts | 2h | Medium |
| 11 | Wind Metadata | SDF-06 | SDFParser.ts | 30m | Low |
| 12 | Bridge Whitelist | OPT-01 | websocket.gzlaunch | 30m | Low |
| 13 | fetch Migration | OPT-02 | SDFParser.ts | 2h | Medium |

**Total estimate: ~18h**

---

## 6. Out of Scope (Confirmed Not Present in Assets)

| Feature | Reason |
|---------|--------|
| **Heightmap** | 0 uses in all 46 models + 14 worlds |
| **Polyline geometry** | 0 uses |
| **Capsule/Ellipsoid/Cone primitives** | Already supported; 0 actual uses |
| **Actor / Skeletal Animation** | No `gz-sim-actor-system` in server.config; 0 actor models |
| **JointStatePublisher** | Not in server.config; SceneBroadcaster dynamic_pose is sufficient |
| **DART physics debug rendering** | Physics-engine-specific; web client renders visuals only |
| **Gazebo material scripts** | Ogre-specific; THREE.js has no equivalent; replaced by PBR |

---

## 7. Verification Matrix

| Feature | Test Command / Method |
|---------|----------------------|
| **Particle emitter** | Load `x500_flow` (optical flow has particle effect) → no crash, particles visible |
| **Ambient/background** | Load `baylands.sdf` → purplish ambient (`0.8 0.5 1`), correct sky color |
| **Sky + clouds** | Load `baylands.sdf` → procedural sky visible |
| **PBR textures** | Load `forest.sdf` → Oak Tree/Pine Tree bark textures visible, grasspatch grass texture visible |
| **Double-sided material** | Load `Oak Tree` → leaves visible from both sides |
| **Joint axes** | Enable joint visualization for `x500_base` → 4 revolute rotor axes shown |
| **Camera frustum** | Load `x500_mono_cam` → camera frustum wireframe visible |
| **Entity deletion** | `gz service -s /world/default/remove --reqtype gz.msgs.Entity --reptype gz.msgs.Boolean --timeout 300 --req 'name:"box"'` → disappears in web |
| **Sim time** | `sceneManager.simTime$.subscribe(t => console.log(t))` → incrementing values |
| **Camera feed** | `sceneManager.subscribeToCameraFeed('/model/x500_0/sensor/imager/camera', cb)` → callback receives image bytes |
| **LIDAR cloud** | Load `x500_lidar_down`, call `subscribeLidarFeed()` → green point cloud visible |
| **Wind metadata** | Load `windy.sdf` → `worldObj.userData.wind.velocity` = `{x:5, y:2, z:0}` |
| **TypeScript build** | `cd TF-client/lib && npm run build` → 0 errors |

---

## 8. Key File Reference

| File | Purpose | Critical Sections |
|------|---------|-------------------|
| `TF-client/lib/src/SDFParser.ts` | SDF → THREE.js spawning | `createMaterial()`, `spawnWorldFromSDF()`, `spawnModelFromSDF()`, `createSensor()`, `createParticleEmitter()` |
| `TF-client/lib/src/Scene.ts` | THREE.js wrapper | `viewJoints()` L3006, `setFog()` L817, `addSky()` L694, `setMaterial()`, `loadTexture()` |
| `TF-client/lib/src/SceneManager.ts` | Topic orchestration | `subscribeToTopics()` L489, `sceneInfoSubscription` L373, `animate()` L599 |
| `TF-client/lib/src/Transport.ts` | WebSocket + Protobuf | `onMessage()` L346, image handling L433, `imageCallbacks` (to add) |
| `TF-client/lib/src/Material.ts` | Material data class | Add `doubleSided: boolean` field |
| `TF-server/externals/tf-gz-models/websocket.gzlaunch` | Bridge config | Port, rate, whitelist |
| `TF-server/externals/tf-gz-models/server.config` | World plugins | SceneBroadcaster, Sensors |

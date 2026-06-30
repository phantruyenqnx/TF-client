# Plan: gzweb Full Feature Wire-up — Verified Against Codebase + gz-gui Reference

## Context

Verified against: actual SDFParser.ts/SceneManager.ts/Scene.ts code, gz-gui C++ plugin sources,
server.config (14 plugins), websocket.gzlaunch (port 9002, 100Hz, no auth),
14 world files, 43 model directories, standalone Go test launcher.

---

## WS :9002 vs Go API — Classification

### Direct via WebSocket :9002 (gz-transport bridge — full bidirectional access)

| Operation | Frame / Path | Notes |
|---|---|---|
| Subscribe any gz-transport topic | `sub` or `image` frame | Topics discovered via `topics-types` |
| Scene initial load | `scene` frame on connect | SceneBroadcaster → full scene |
| Pose stream 100Hz | `/world/{w}/dynamic_pose/info` | Already wired |
| World stats (sim_time, RTF, paused) | `/world/{w}/stats` | `gz.msgs.WorldStatistics` |
| Entity deletion | `/world/{w}/scene/deletion` | `gz.msgs.UInt32_V` — IDs, NOT names |
| Camera image feed | any `gz.msgs.Image` topic | Raw PNG bytes via `image` frame |
| LiDAR scan | any `gz.msgs.LaserScan` topic | ranges[], angle_min/step |
| **Play/Pause** | service `/world/{w}/control` | `{ pause: bool }` |
| **Step N iterations** | service `/world/{w}/control` | `{ multi_step: N }` |
| **Reset world** | service `/world/{w}/control` | `{ reset: { all: true } }` |
| **Spawn model** | service `/world/{w}/create` | `{ sdf: string, pose: {...} }` |
| **Remove entity** | service `/world/{w}/remove` | `{ name: string }` |
| Publish teleop/cmd | `adv` + `pub_in` frames | Any msg type |
| Load SDF/mesh asset | `asset` frame | `model://` URI resolved by server |
| Topic discovery | `topics-types` frame | Returns all live topics |

### Requires Go API (not accessible via gz-transport)

| Operation | Why Go API | Existing endpoint |
|---|---|---|
| List world .sdf files | Filesystem, not gz-transport | `GET /api/v1/worlds` ✅ exists |
| List model directories | Filesystem, not gz-transport | `GET /api/v1/models` ✅ exists |
| Get WebSocket port (9002) | From platform.yaml `ports.gazebo_ws` | Derive from `GET /api/v1/sessions` ✅ |
| Start Gazebo process | exec.Cmd orchestration | `POST /api/v1/projects/{id}/sessions` ✅ |
| Stop Gazebo process | exec.Cmd teardown | `POST /api/v1/sessions/{id}/stop` ✅ |
| Stream process logs | WebSocket log tail | `WS /ws/v1/sessions/{id}/status` ✅ |
| Spawn model by name | Needs disk SDF → then WS /world/{w}/create | ❌ missing `POST /api/v1/models/spawn` |
| Remove entity by name | Already doable via WS /world/{w}/remove | ❌ not needed in Go |

**Key insight:** Spawn-by-name is the only hybrid case. Two options:
- (A) Load SDF via `asset` frame (`model://x500/model.sdf`) → send SDF string to `/world/{w}/create` — **pure WS, no Go change needed**
- (B) `POST /api/v1/models/spawn` → Go reads SDF from disk → calls `gz service` — **requires new Go endpoint**

---

## Critical Files

| File | What changes |
|------|-------------|
| `TF-client/lib/src/SDFParser.ts` | P0 bugs: particles, world.scene, PBR URI; P1: double_sided, joints, sensors |
| `TF-client/lib/src/Scene.ts` | Add: metalness/roughness scalars, DoubleSide, setAmbient, setBackground |
| `TF-client/lib/src/SceneManager.ts` | Add: step(), reset(), deletion topic (ID-based), spawnModel(), removeModel() |
| `TF-client/lib/src/Material.ts` | Add: `doubleSided: boolean` field |
| `TF-client/src/.../Gazebo/components/CenterViewport.tsx` | UI wiring: Tasks A–E |

**Rebuild required** after any lib/src/ change:
```bash
cd TF-client/lib && npm run build
```

---

## Phase 1 — P0 Bug Fixes (SDFParser.ts)

All confirmed present in actual code. Fix before anything else.

### BUG-01 — Particle null crash (SDFParser.ts ~line 1792)

```typescript
// Line 1792 — BEFORE (crashes if no <pbr> or no albedo_map):
const particleTextureUrl = particleMaterial.pbr.albedo_map;

// AFTER:
const particleTextureUrl = particleMaterial?.pbr?.albedo_map ?? '';
```

**Verify:** Load x500_flow world → no crash, page stays loaded.

---

### BUG-02 — Particle emitter returns empty Object3D (~line 1882)

```typescript
// Add before final `return particleEmitterObj;`:
particleEmitterObj.userData.nebulaEmitter = nebulaEmitter;
particleEmitterObj.name = emitterName;
this.scene.setPose(particleEmitterObj, pose.position, pose.orientation);
```

**Verify:** x500_flow optical flow particles visible in 3D view.

---

### BUG-03 — world.scene element ignored in spawnWorldFromSDF()

**Context:** Affects the SDF-file-loading code path only (offline/preview mode).
In live gz-sim mode, SceneManager.ts:412–418 already applies ambient from `sceneInfo`
broadcast by SceneBroadcaster. BUG-03 matters when loading SDF directly in browser.

**File:** `SDFParser.ts:spawnWorldFromSDF()` — add after the `world.include` block (~line 1451):

```typescript
// Parse world <scene> sub-elements
if (sdfObj.world.scene) {
  const s = sdfObj.world.scene;
  if (s.ambient)    this.scene.setAmbient(this.parseColor(s.ambient));
  if (s.background) this.scene.setBackground(this.parseColor(s.background));
  if (s.fog)        this.scene.addFog(s.fog.color ?? '1 1 1 1',
                      parseFloat(s.fog.density ?? '0.001'));
  if (s.grid !== undefined)
    (this.scene as any).grid.visible = this.parseBool(String(s.grid));
  if (s.sky) this.scene.addSky();
}
// Parse world <wind>
if (sdfObj.world.wind) {
  const vel = this.parse3DVector(sdfObj.world.wind.linear_velocity ?? '0 0 0');
  (this.scene as any).scene.userData.wind = { velocity: vel };
}
```

**Add to Scene.ts:**
```typescript
public setAmbient(color: THREE.Color): void { this.ambient.color.copy(color); }
public setBackground(color: THREE.Color): void { this.scene.background = color; }
```

**Verify:** Load `baylands.sdf` from URL → purplish ambient, sky visible.

---

### BUG-04 — PBR relative URI not resolved (SDFParser.ts:createMaterial() ~line 534)

**Confirmed:** Only `https://` and `customUrls` matching are handled. `materials/textures/grass_dry.png` (grasspatch in forest.sdf) fails silently.

**Fix:** Thread `modelBaseUrl` through the call chain:
`spawnModelFromSDF()` → `createLink()` → `createVisual()` → `createGeom()` → `createMaterial(modelBaseUrl)`.

```typescript
// In createMaterial(), apply to albedoMap, normalMap, roughnessMap, metalnessMap:
function resolveUri(uri: string, base?: string): string {
  if (!uri || uri.startsWith('https://') || uri.startsWith('model://')) return uri;
  return base ? `${base}/${uri}` : uri;
}
material.pbr.albedoMap = resolveUri(srcMaterial.pbr.metal.albedo_map, modelBaseUrl);
```

**Verify:** Load `forest.sdf` → grasspatch shows grass_dry.png texture (green patches visible).

---

## Phase 2 — P1 Rendering Quality (SDFParser.ts + Scene.ts + Material.ts)

### RENDER-03 — Metalness/roughness scalar values never applied

**Confirmed:** `SDFParser.ts:491-495` parses scalars into `material.pbr.metalness` and `material.pbr.roughness`. `Scene.ts:setMaterial()` (~line 2353) applies only map variants — scalar values are NEVER assigned to the THREE.js material.

**Fix in Scene.ts after the metalnessMap block (~line 2392):**
```typescript
if (material.pbr.metalness !== undefined) {
  (obj.material as THREE.MeshStandardMaterial).metalness = material.pbr.metalness;
}
if (material.pbr.roughness !== undefined) {
  (obj.material as THREE.MeshStandardMaterial).roughness = material.pbr.roughness;
}
```

**Verify:** Load `uav_contest_2026.sdf` → ground shows matte (roughness=0.9), not mirror-shiny.

---

### SDF-04 — `<double_sided>` never applied (affects Oak Tree, Pine Tree leaves)

**Confirmed:** `Material.ts` has no `doubleSided` field. `Scene.ts:setMaterial()` never sets `THREE.DoubleSide`.

**Step 1 — Material.ts:** add field:
```typescript
public doubleSided: boolean = false;
```

**Step 2 — SDFParser.ts:createMaterial():** parse it:
```typescript
material.doubleSided = this.parseBool(srcMaterial.double_sided) || false;
```

**Step 3 — Scene.ts:setMaterial():** apply in both PBR and Phong branches, after all map/texture assignments:
```typescript
if (material.doubleSided) {
  (obj.material as THREE.Material).side = THREE.DoubleSide;
}
```

**Verify:** Load `Oak Tree` → orbit camera below canopy → leaves visible from underside.

---

## Phase 3 — P1 SDF Parsing Gaps (SDFParser.ts)

### SDF-01 — Joint parsing completely absent

**Confirmed:** `grep "joint"` returns 0 results in SDFParser.ts. `spawnModelFromSDF()` processes `model.link`, `model.model`, `model.include` but never `model.joint`. `Scene.ts:viewJoints()` at line 3006 is fully implemented but never called.

**Add to SDFParser.ts:spawnModelFromSDF() after the link loop (~line 1341):**
```typescript
if (sdfObj.model.joint) {
  if (!(sdfObj.model.joint instanceof Array))
    sdfObj.model.joint = [sdfObj.model.joint];

  modelObj.userData.joints = sdfObj.model.joint.map((j: any) => ({
    name:   j['@name'] || j.name,
    type:   this.parseJointType(j['@type'] || j.type || 'fixed'),
    parent: j.parent,
    child:  j.child,
    axis:   j.axis  ? { xyz: this.parse3DVector(j.axis.xyz  || '0 0 1') } : undefined,
    pose:   j.pose  ? this.parsePose(j.pose) : new Pose(),
  }));
}
```

Add private helper:
```typescript
private parseJointType(s: string): number {
  const m: Record<string, number> = {
    revolute:1, revolute2:2, prismatic:3, universal:4,
    ball:5, screw:6, gearbox:7, fixed:8, continuous:1
  };
  return m[s.toLowerCase()] ?? 8;
}
```

**Joint types in actual models (from inventory):**
- `revolute`: x500_base (4), gimbal (3), r1_rover, omnicopter (8), rc_cessna, tiltrotor, quadtailsitter
- `fixed`: structural attachments (most multi-body models)
- `universal`: gimbal multi-DOF mounts

**Verify:** After loading x500_base, call `(sceneMgr as any).scene.viewJoints(modelObj)` in console → 4 revolute axes visible.

---

### SDF-03 — createSensor returns empty Object3D

**Confirmed:** `SDFParser.ts:createSensor()` lines 1163–1173 creates an empty `Object3D`, sets pose, and returns. No geometry for any sensor type.

**Replace the entire createSensor() method:**
```typescript
public createSensor(sensor: any, options: any): THREE.Object3D {
  const obj = new THREE.Object3D();
  obj.name = sensor['@name'] || sensor.name || '';
  const type: string = (sensor['@type'] || sensor.type || '').toLowerCase();

  if (sensor.pose) {
    const p = this.parsePose(sensor.pose);
    this.scene.setPose(obj, p.position, p.orientation);
  }

  switch (type) {
    case 'camera':
    case 'depth_camera':
    case 'rgbd_camera': {
      const hfov = parseFloat(sensor.camera?.horizontal_fov ?? '1.047');
      const w    = parseFloat(sensor.camera?.image?.width   ?? '640');
      const h    = parseFloat(sensor.camera?.image?.height  ?? '480');
      const near = parseFloat(sensor.camera?.clip?.near     ?? '0.1');
      const far  = Math.min(parseFloat(sensor.camera?.clip?.far ?? '100'), 15);
      const cam  = new THREE.PerspectiveCamera(
        THREE.MathUtils.radToDeg(hfov), w / h, near, far);
      obj.add(new THREE.CameraHelper(cam));
      break;
    }
    case 'gpu_lidar':
    case 'lidar':
    case 'ray':
      obj.add(this.makeSensorSphere(0x00ff00));   // green
      break;
    case 'imu':
      obj.add(this.makeSensorSphere(0xff8800));   // orange
      break;
    case 'navsat':
      obj.add(this.makeSensorSphere(0x00ffff));   // cyan
      break;
    case 'contact':
      obj.add(this.makeSensorSphere(0xff0000));   // red
      break;
    default:
      obj.add(this.makeSensorSphere(0xffffff));
  }
  return obj;
}

private makeSensorSphere(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.05),
    new THREE.MeshBasicMaterial({ color })
  );
}
```

**Sensors in actual models (from inventory):** gpu_lidar (advanced_plane, livox_mid_360, x500_lidar variants), imu (livox_mid_360), camera (x500 cam variants, OakD-Lite).

**Verify:** Load `x500_lidar_down` → small green sphere visible at lidar sensor origin.

---

## Phase 4 — P1 New Topic Subscriptions + SceneManager APIs

### TOPIC-01 — Entity deletion (CRITICAL CORRECTION from previous plan)

**⚠ Message type correction:** gz-gui TransportSceneManager uses `gz::msgs::UInt32_V` for deletion, NOT entity name structs. The websocket bridge forwards this as `msg['data']` (array of uint32 IDs). The previous plan incorrectly used `msg['entity'][].name`.

**SceneManager already stores `model['id']`** (set at line 540) alongside `model['gz3dName']` (line 401). Use ID→name lookup.

**Add to SceneManager.ts:subscribeToTopics() after sceneTopic subscription (~line 545):**
```typescript
const deletionTopic = new Topic(
  `/world/${this.transport.getWorld()}/scene/deletion`,
  (msg: any) => {
    const ids: number[] = msg['data'] ?? [];
    ids.forEach((id: number) => {
      const model = this.models.find((m: any) => m['id'] === id);
      if (!model) return;
      const gz3dName: string = model['gz3dName'] || model['name'];
      const obj = this.scene.getByName(gz3dName);
      if (obj) this.scene.remove(obj);
      this.models = this.models.filter((m: any) => m['id'] !== id);
    });
  }
);
this.transport.subscribe(deletionTopic);
```

**Verify:** `gz service -s /world/default/remove --reqtype gz.msgs.Entity --reptype gz.msgs.Boolean --timeout 300 --req 'name:"box"'` → box disappears immediately.

---

### TOPIC-03 — Camera feed

**Add to SceneManager.ts:**
```typescript
public subscribeToCameraFeed(
  topic: string,
  onFrame: (pngBytes: Uint8Array) => void
): void {
  this.transport.subscribe(new Topic(topic, (raw: any) => {
    if (raw instanceof Uint8Array) onFrame(raw);
    else if (raw instanceof ArrayBuffer) onFrame(new Uint8Array(raw));
  }));
}
```

`Transport.ts:180–182` already detects `ignition.msgs.Image` and routes via `image` frame — raw PNG bytes delivered directly without protobuf decode. No Transport.ts changes needed.

---

### step() / reset() — add to SceneManager.ts after pause() (~line 469)

```typescript
public step(steps: number = 1): void {
  this.transport.requestService(
    `/world/${this.transport.getWorld()}/control`,
    'ignition.msgs.WorldControl',
    { multi_step: steps }
  );
}

public reset(): void {
  this.transport.requestService(
    `/world/${this.transport.getWorld()}/control`,
    'ignition.msgs.WorldControl',
    { reset: { all: true } }
  );
}
```

**Confirmed from gz-gui WorldControl.cc:** `set_multi_step()` and `set_allocated_reset()` with `reset.set_all(true)` are the exact native equivalents.

---

### spawnModel() / removeModel() — add to SceneManager.ts

```typescript
// Option A: spawn from inline SDF string
public spawnModel(sdfString: string, pose?: {x:number;y:number;z:number}): void {
  this.transport.requestService(
    `/world/${this.transport.getWorld()}/create`,
    'ignition.msgs.EntityFactory',
    { sdf: sdfString, ...(pose ? { pose: { position: pose } } : {}) }
  );
}

// Option B: spawn by model:// URI (server resolves SDF)
public spawnModelByUri(uri: string, name: string): void {
  this.transport.requestService(
    `/world/${this.transport.getWorld()}/create`,
    'ignition.msgs.EntityFactory',
    { sdf_filename: uri, name }
  );
}

public removeModel(name: string): void {
  this.transport.requestService(
    `/world/${this.transport.getWorld()}/remove`,
    'ignition.msgs.Entity',
    { name, type: 2 }   // type 2 = MODEL
  );
}
```

---

## Phase 5 — UI Wiring (CenterViewport.tsx)

No lib rebuild needed for this phase.

### TASK A — Drive simRunning from backend `paused` field

**Confirmed from gz-gui WorldControl.cc:** subscribes to `/world/{w}/stats` and reads `pause()` field (protobuf field name `paused`). `gz.msgs.WorldStatistics` proto field `bool paused = 7`.

```typescript
// Add to GzWorldStats type: paused: boolean
// In stats callback, switch to functional updater:
const isPaused: boolean = msg.paused ?? true;
setSimRunning(!isPaused);
setWorldStats((prev) => ({
  simTime: msg.sim_time ?? null,
  realTime: msg.real_time ?? null,
  realtimeFactor: msg.real_time_factor ?? 0,
  iterations: msg.iterations ?? 0,
  fps: prev.fps,
  contacts: 0,
  paused: isPaused,
}));
```

---

### TASK B — Wire Play / Pause / Step / Reset buttons

```typescript
// Play/Pause (line 399):
onClick={() => {
  const mgr = sceneMgrRef.current as any;
  if (!mgr) return;
  simRunning ? mgr.pause() : mgr.play();
  setSimRunning((v) => !v);
}}

// Step Forward (disabled while running):
onClick={() => { if (!simRunning) (sceneMgrRef.current as any)?.step(1); }}
// sx add: opacity: simRunning ? 0.35 : 1, cursor: simRunning ? "not-allowed" : "pointer"

// Reset World:
onClick={() => { (sceneMgrRef.current as any)?.reset(); }}
```

**Verify:** Step while paused → ITER +1. Play/Pause toggles via UI AND via native gz GUI simultaneously.

---

### TASK C — View controls (TOP / FNT / SID / HOME / Grid / P-O)

**Confirmed:** Scene.ts Z-up (`camera.up=(0,0,1)` Scene.ts:2592). Grid at `(scene as any).grid` (GridHelper). `(scene as any).controls` is OrbitControls.

```typescript
// HOME:
onClick={() => { (sceneMgrRef.current as any)?.resetView(); }}

// TOP:
onClick={() => {
  const s = (sceneMgrRef.current as any)?.scene; if (!s) return;
  s.camera.position.set(0, 0, 20); s.camera.up.set(0, 1, 0); s.camera.lookAt(0,0,0);
  (s as any).controls?.update();
}}
// FRONT (look along +Y):
onClick={() => {
  const s = (sceneMgrRef.current as any)?.scene; if (!s) return;
  s.camera.position.set(0, -15, 5); s.camera.up.set(0, 0, 1); s.camera.lookAt(0,0,0);
  (s as any).controls?.update();
}}
// SIDE (look along -X):
onClick={() => {
  const s = (sceneMgrRef.current as any)?.scene; if (!s) return;
  s.camera.position.set(15, 0, 5); s.camera.up.set(0, 0, 1); s.camera.lookAt(0,0,0);
  (s as any).controls?.update();
}}
// Grid toggle:
onClick={() => {
  const grid = (sceneMgrRef.current as any)?.scene?.grid;
  if (grid) grid.visible = !grid.visible;
}}
// P/O toggle — add const [isOrtho, setIsOrtho] = useState(false):
onClick={() => {
  const scene = (sceneMgrRef.current as any)?.scene;
  if (!scene || !(scene as any).cameraOrtho) return;
  const next = !isOrtho;
  if (next) { (scene as any)._prevCam = scene.camera; scene.camera = (scene as any).cameraOrtho; scene.camera.position.copy((scene as any)._prevCam.position); }
  else { if ((scene as any)._prevCam) scene.camera = (scene as any)._prevCam; }
  if ((scene as any).controls) (scene as any).controls.object = scene.camera;
  (scene as any).controls?.update(); setIsOrtho(next);
}}
```

---

### TASK D — FPS Counter

```typescript
const fpsCountRef = useRef(0);
const fpsLastRef  = useRef(performance.now());

useEffect(() => {
  let rafId: number;
  const tick = () => {
    fpsCountRef.current += 1;
    const now = performance.now();
    const elapsed = now - fpsLastRef.current;
    if (elapsed >= 1000) {
      const fps = (fpsCountRef.current * 1000) / elapsed;
      fpsLastRef.current = now; fpsCountRef.current = 0;
      setWorldStats((prev) => ({ ...prev, fps }));
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(rafId); };
}, []);
```

---

### TASK E — Selected entity HUD (replace hardcoded "x500")

```typescript
const [selectedEntity, setSelectedEntity] = useState<{
  name: string; linkCount: number; jointCount: number;
} | null>(null);

// In readySub block after stats topic:
const emitter = (sceneMgr as any)?.scene?.emitter;
if (emitter) {
  emitter.on('setTreeSelected', (entityName: string) => {
    const models: any[] = (sceneMgr as any).models ?? [];
    const m = models.find((x: any) => x['gz3dName'] === entityName || x['name'] === entityName);
    setSelectedEntity({ name: entityName, linkCount: m?.link?.length ?? 0, jointCount: m?.joint?.length ?? 0 });
  });
  emitter.on('setTreeDeselected', () => setSelectedEntity(null));
}
// cleanup: emitter?.removeAllListeners('setTreeSelected'); emitter?.removeAllListeners('setTreeDeselected');
```

Replace hardcoded HUD block (lines 259–274):
```tsx
{selectedEntity != null && (
  <Box sx={{ ...hudSx, top: 12, left: 12, display: "flex", alignItems: "center", gap: 1 }}>
    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#f97316", flexShrink: 0 }} />
    <Box>
      <Box sx={{ color: "#fb923c", fontWeight: 700, fontSize: 10 }}>{selectedEntity.name}</Box>
      <Box sx={{ color: "#6e7681", fontSize: 8 }}>
        model · {selectedEntity.linkCount} links · {selectedEntity.jointCount} joints
      </Box>
    </Box>
  </Box>
)}
```

---

## Task Order & Dependency

```
Phase 1 (P0 bugs — SDFParser)          → npm run build
  BUG-01  BUG-02  BUG-03  BUG-04        (all independent)
        ↓
Phase 2 (P1 rendering — Scene/Material) → npm run build
  RENDER-03   SDF-04                     (independent)
        ↓
Phase 3 (P1 SDF parsing — SDFParser)   → npm run build
  SDF-01   SDF-03                        (independent)
        ↓
Phase 4 (P1 topics — SceneManager)     → npm run build
  TOPIC-01  TOPIC-03  step/reset  spawn/remove  (independent)
        ↓
Phase 5 (UI wiring — CenterViewport)   → no rebuild
  TASK A → TASK B → TASK C / TASK D / TASK E  (C/D/E independent)
```

---

## What the standalone Go test launcher does

`TF-server/src/cmd/standalone/main.go` (`sim-run` binary):
- Launches: gz-sim → waits for world ready → PX4 SITL → gz websocket bridge (:9002) → optional DDS + ROS2
- Use `option=1` (sim-only, no DDS/ROS2) for isolated gzweb testing
- Usage: `./sim-run default default.sdf gz_headless=1 option=1`
- Graceful shutdown with 15s timeout + force-kill

**Test per model:** Use `gz service -s /world/default/create` to spawn each model after world is loaded, then verify in browser at `ws://localhost:9002`.

---

## Do NOT Touch

- `SceneManager.ts:373–419` — ambient from sceneInfo already works for live gz-sim mode
- `ResizeObserver` in CenterViewport (lines 156–175)
- `sceneMgr.disconnect()` cleanup (line 148)
- `formatGzTime()` — correct
- `OrbitControls` — never call `controls.reset()`
- `Transport.ts` image frame detection (lines 180–182) — already correct

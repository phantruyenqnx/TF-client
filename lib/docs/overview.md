# Gzweb Library — Architecture Overview

## Summary

The `lib` directory contains **`gzweb` v2.0.14**, a TypeScript/JavaScript library that enables web clients to render and interact with [Gazebo](https://gazebosim.org) robotics simulations directly in the browser. It wraps Three.js 3D rendering, Gazebo's WebSocket transport protocol, and SDF model parsing into a single installable npm package.

---

## Layered Architecture

```
┌─────────────────────────────────────────┐
│          Public API (gzweb.js)          │  ← Entry point / barrel export
├────────────────────┬────────────────────┤
│   SceneManager     │   AssetViewer      │  ← Two main facades
│  (live simulation) │  (static viewing)  │
├────────────────────┴────────────────────┤
│      Transport     │      Scene         │  ← Core layers
│  (WebSocket/Proto) │  (Three.js render) │
├────────────────────┴────────────────────┤
│   SDFParser  │  FuelServer  │  WsLoader │  ← Support layer
└─────────────────────────────────────────┘
```

---

## Core Modules

### `SceneManager` — Live Simulation Facade
Orchestrates the full rendering pipeline for a **running Gazebo simulation**. On construction it:
1. Opens a WebSocket via `Transport`.
2. Initializes a Three.js `Scene` and `SDFParser` once connected.
3. Subscribes to `/world/<name>/dynamic_pose/info` to update model poses every frame.
4. Subscribes to `/world/<name>/scene/info` to add or remove models dynamically.
5. Drives a `requestAnimationFrame` render loop.

Exposes controls: `play()`, `pause()`, `stop()`, `follow()`, `moveTo()`, `select()`, `snapshot()`, `resize()`.

### `AssetViewer` — Static Asset Facade
Renders a **static model or world** without any WebSocket connection. Accepts a list of resource URLs, parses SDF, and renders the result. Useful for model preview pages.

### `Transport` — WebSocket Layer
Manages the single WebSocket connection to a Gazebo server.
- Handles the connection handshake: auth key → protobuf definitions → topic list → world name → scene info.
- Exposes `subscribe`, `unsubscribe`, `advertise`, `publish`, `requestService`, `throttle`.
- Streams connection state (`disconnected` → `connected` → `ready` → `error`) as an RxJS `Observable`.
- Deserializes incoming binary frames using protobufjs.

### `Scene` — Three.js Rendering Engine
Wraps a `THREE.Scene` with camera, lighting, and controls:
- `THREE.PerspectiveCamera` + `OrbitControls` for navigation.
- Loads mesh formats: **COLLADA** (`.dae`), **OBJ/MTL**, **STL**, **DDS**, **TGA**.
- Supports a `three-nebula` particle system for visual effects.
- Custom `WsLoadingManager` to fetch assets over WebSocket instead of HTTP.

### `SDFParser` — SDF Format Parser
Parses Gazebo's **Simulation Description Format** (XML-based) into Three.js objects.
Handles models, links, visuals, materials, lights, joints, and particle emitters.

### `FuelServer` — Asset URI Resolver
Converts local filesystem paths (e.g. `/home/.../.ignition/fuel/.../model.sdf`) into valid HTTPS URLs pointing to `fuel.gazebosim.org`, Gazebo's public 3D asset store.

### `Publisher` / `Topic` — Transport Abstractions
Thin wrappers around the pub/sub pattern used by Gazebo's transport:
- `Topic`: holds a topic name and a message callback.
- `Publisher`: created via `Transport.advertise()`, encodes and sends protobuf messages.

---

## Supporting Modules

| Module | Purpose |
|--------|---------|
| `Asset.ts` | Data type for an asset request (URI + callback) |
| `WsLoadingManager.ts` | Three.js `LoadingManager` subclass that routes asset requests through the WebSocket |
| `AudioTopic.ts` | Subscribes to a Gazebo audio control topic and plays back audio files |
| `Gamepad.ts` | Maps gamepad input events to scene actions |
| `SpawnModel.ts` | Constructs a model spawn request message |
| `Pose.ts` / `Color.ts` / `Material.ts` / `PBRMaterial.ts` / `Inertia.ts` | Data-transfer types mirroring Gazebo protobuf message fields |
| `Globals.ts` | Shared utility functions (`getDescendants`, `binaryToImage`, etc.) |
| `Shaders.js` | Custom GLSL shaders for materials |
| `GzObjLoader.ts` | Extended OBJ loader with Gazebo-specific material handling |

---

## 3D Asset Loaders (`include/`)

Vendored loaders adapted from Three.js examples:

| File | Format |
|------|--------|
| `ColladaLoader.js` | COLLADA `.dae` |
| `OBJLoader.js` + `MTLLoader.js` | Wavefront OBJ/MTL |
| `STLLoader.js` | Stereolithography STL |
| `DDSLoader.js` | DirectDraw Surface DDS textures |
| `TGALoader.js` | Truevision TGA textures |
| `OrbitControls.js` | Mouse/touch camera orbit |

---

## Key Dependencies

| Library | Used For |
|---------|----------|
| `three` | 3D scene rendering |
| `protobufjs` | Encode/decode Gazebo binary messages |
| `rxjs` | Reactive streams for connection state and scene info |
| `eventemitter2` | Internal event bus within the scene |
| `three-nebula` | Particle system effects |
| `jszip` | Decompress zipped asset bundles |
| `fast-xml-parser` | Parse SDF/XML model descriptions |

---

## Build Pipeline

```
src/*.ts
   │
   ▼  tsc (TypeScript compiler)
tsc-out/*.js
   │
   ▼  rollup + babel
dist/
  ├── gzweb.module.js   — ES Module (for bundlers like Vite/Webpack)
  ├── gzweb.js          — UMD unminified (for direct browser use)
  └── gzweb.min.js      — UMD minified (for production)
```

Build commands:
```bash
npm run build   # rimraf dist && tsc && rollup -c
npm run test    # jest
```

---

## Usage

### Live Simulation
```typescript
import { SceneManager } from 'gzweb';

const mgr = new SceneManager({
  elementId: 'gz-scene',       // id of the HTML container element
  websocketUrl: 'ws://localhost:9002',
  websocketKey: 'optional-auth-key',
});

// Control the simulation
mgr.play();
mgr.pause();
mgr.follow('robot_model');
mgr.resize();   // call on window resize

// Clean up
mgr.destroy();
```

### Static Model / World Viewer
```typescript
import { AssetViewer } from 'gzweb';

const viewer = new AssetViewer({
  elementId: 'gz-scene',
  enablePBR: true,
  scaleModel: true,
});
```

---

## WebSocket Message Protocol

Messages are comma-separated strings with four fields:

```
<operation>,<topic>,<message_type>,<payload>
```

Key operations sent by the client:

| Operation | Meaning |
|-----------|---------|
| `auth` | Send authentication key |
| `protos` | Request protobuf definitions |
| `topics-types` | Request list of available topics |
| `worlds` | Request world name |
| `scene` | Request initial scene state |
| `sub` | Subscribe to a topic |
| `unsub` | Unsubscribe from a topic |
| `pub_in` | Publish a message to a topic |
| `adv` | Advertise a topic |
| `req` | Call a service |
| `image` | Subscribe to an image topic |
| `asset` | Request an asset file |
| `throttle` | Throttle publish rate on a topic |

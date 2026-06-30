# Gazebo GUI Panel — Features & Layout

Source: gz-gui 8.4.0 plugins + gz-sim 8.9.0 GUI plugins (audited from source)

---

## Layout Overview

```
┌─────────────────────────────────────────────────────┐
│                     TOOLBAR (top)                   │
├──────────┬──────────────────────────────┬───────────┤
│          │                              │           │
│  LEFT    │        CENTER (3D viewport)  │  RIGHT    │
│  PANEL   │                             │  PANEL    │
│          │                              │           │
├──────────┴──────────────────────────────┴───────────┤
│                  BOTTOM PANEL                       │
└─────────────────────────────────────────────────────┘
```

---

## TOOLBAR (top)

### Simulation Controls — `WorldControl` (gz-gui)
- Play / Pause (Space shortcut)
- Step forward (single step)
- Multi-step (configurable N steps)
- Reset world

### World Stats display — `WorldStats` (gz-gui)
- Sim Time
- Real Time
- Real Time Factor (RTF)
- Iterations
> Normally floats over viewport bottom-right, can be placed inline in toolbar

### Transform Tools — `TransformControl` (gz-sim)
- Select mode
- Translate (move entity)
- Rotate entity
- Scale entity
- Snap-to-grid (configurable snap increment)

### Entity Actions — `CopyPaste` (gz-sim)
- Copy selected entity
- Paste entity

### Spawn Shapes — `Shapes` / `Spawn` (gz-sim)
- Spawn Box
- Spawn Sphere
- Spawn Cylinder
- Spawn Capsule
- Spawn Ellipsoid

### Add Lights — `Lights` (gz-sim)
- Add Directional Light
- Add Point Light
- Add Spot Light

### View Control — `InteractiveViewControl` + `ViewAngle` (gz-gui + gz-sim)
- Perspective / Orthographic projection toggle
- View angle presets: Top, Front, Side, Home
- Camera FPS display — `CameraFps`

### Capture — `Screenshot` + `VideoRecorder` (gz-gui + gz-sim)
- Screenshot viewport
- Start/Stop video recording

### Grid — `GridConfig` (gz-gui)
- Toggle grid visibility
- Configure horizontal/vertical cell count, cell size, color

### Utilities
- Tape Measure — `TapeMeasure` (gz-gui): click two points to measure distance
- Keyboard Publisher — `KeyPublisher` (gz-gui)
- Shutdown — `ShutdownButton` (gz-gui)
- **Focus Mode** (mockup UX, not a gz plugin): toggle button that collapses all panels (toolbar, left, right, bottom) leaving only the 3D viewport; keyboard shortcut `F`, exit with `Esc` or floating FAB button

---

## LEFT PANEL

### Tab 1 — Entity Tree — `EntityTree` (gz-sim)
- Hierarchical world tree: World → Model → Link → Joint → Sensor
- Show/hide entities
- Select entity (syncs with right panel Component Inspector)
- Right-click context menu — `EntityContextMenu` (gz-sim):
  - Move to entity
  - Follow entity
  - Copy / Paste / Delete

### Tab 2 — Resource Spawner — `ResourceSpawner` (gz-sim)
- Browse local model paths
- Browse Gazebo Fuel online model library
- Search by name
- Click to spawn model into world

---

## CENTER (3D Viewport)

### Core Rendering — `MinimalScene` (gz-gui)
- Ogre2 3D scene render (web: Three.js via gzweb)
- Perspective + Orthographic camera

### Mouse Interaction
- `InteractiveViewControl`: Orbit (middle drag), Pan (left drag), Zoom (scroll)
- `SelectEntities`: Left-click to select entity, highlights in entity tree
- `MouseDrag`: Drag selected entity to translate/rotate in scene
- `TransformControl`: Show translate/rotate/scale gizmo on selected entity

### Scene Data
- `TransportSceneManager`: Subscribe to gz-transport scene/pose topics, update render
- `MarkerManager`: Add/update/remove visual markers via `/marker` topic

### Camera Behaviors — `CameraTracking` (gz-gui)
- Move To entity (animate camera)
- Follow entity (continuous tracking)
- Track entity (look-at only, camera stays put)
- Follow offset configurable

### Overlays (floating on viewport)
- `WorldControl` buttons — bottom-left of viewport
- `WorldStats` panel — bottom-right of viewport

### Visualization Toggles — `VisualizationCapabilities` (gz-sim)
- Transparent mode
- Wireframe mode
- Visualize collisions (collision geometry)
- Visualize inertia (inertia ellipsoid)
- Visualize Center of Mass
- Visualize joints (axis arrows, revolute torus)
- Visualize lights (light icons)
- Visualize sensors (camera frustum, lidar scan plane)

### Contact Visualization — `VisualizeContacts` (gz-sim)
- Toggle contact point display (color + radius configurable)

### Lidar Visualization — `VisualizeLidar` (gz-sim)
- Render laser scan rays / point cloud in scene

### Camera Frustum Visualization — `VisualizeFrustum` (gz-sim)
- Render camera FOV frustum wireframe

### 3D Trajectory Plot — `Plot3D` (gz-sim)
- Plot entity trajectory path over time directly in 3D scene

### Apply Force/Torque — `ApplyForceTorque` (gz-sim)
- Select link, set force vector (N), torque vector (N·m)
- Apply impulse to simulation

---

## RIGHT PANEL

### Component Inspector — `ComponentInspectorEditor` (gz-sim)
Displays and edits all ECS components of the selected entity:

**Pose**
- Position (X, Y, Z)
- Rotation (Roll, Pitch, Yaw)
- Apply pose button

**Physics**
- Mass
- Inertia matrix
- Gravity enabled toggle

**Light** (when light entity selected)
- Light type (directional / point / spot)
- Diffuse / Specular color
- Attenuation (range, constant, linear, quadratic)
- Cast shadows toggle
- Spot inner/outer angle (spot lights)

**Joint** (when joint entity selected)
- Joint type
- Parent / child links
- Axis vector
- Position / velocity limits

**Sensors** (when sensor entity selected)
- Sensor type label
- Update rate
- Topic name

**Material** (when visual entity selected)
- Ambient / Diffuse / Specular / Emissive colors
- Transparency value

### Joint Position Controller — `JointPositionController` (gz-sim)
- List of all joints in selected model
- Slider per joint to set target position
- Real-time update

---

## BOTTOM PANEL

### Tab 1 — Plotting — `Plotting` / `TransportPlotting` (gz-gui + gz-sim)
- Time-series line chart
- Drag topic fields from Topic Viewer to add a plot line
- Multiple series per chart, configurable colors
- X axis: sim time / real time
- Y axis: auto-scale or fixed range
- Pause/resume plot, clear data

### Tab 2 — Image Viewer — `ImageDisplay` (gz-gui)
- Topic picker (dropdown of `gz.msgs.Image` topics)
- Live camera frame display
- Supports: RGB8, L8, R_FLOAT32 image encodings
- Resize to fit panel

### Tab 3 — Topic Echo — `TopicEcho` (gz-gui)
- Topic name input field
- Subscribe / Unsubscribe button
- Scrolling raw message text output
- Buffer size configurable

### Tab 4 — Topic Viewer — `TopicViewer` (gz-gui)
- Tree of all active gz-transport topics
- Expand topic to see message type and individual fields
- Drag field to Plotting panel to add plot line

### Tab 5 — Log Playback — `PlaybackScrubber` (gz-sim)
- Timeline slider
- Jump to time position
- Current time display
- Paired with WorldControl play/pause for playback

### Tab 6 — NavSat Map — `NavSatMap` (gz-gui)
- GPS coordinate display on map tile
- Follow GPS topic (`gz.msgs.NavSat`)
- Toggle satellite / map tile style

### Tab 7 — Point Cloud — `PointCloud` (gz-gui)
- Subscribe to `gz.msgs.PointCloudPacked` topic
- Render colored point cloud in 3D viewport
- Min/max intensity color mapping

---

## FLOATING / SIDE DRAWER (optional panels)

| Panel | Plugin | Trigger |
|---|---|---|
| Apply Force/Torque | `ApplyForceTorque` | Right-click entity → Apply wrench |
| Teleop | `Teleop` | Side drawer |
| Publisher | `Publisher` | Side drawer — send arbitrary topic message |
| Environment Loader | `EnvironmentLoader` | Load environmental data (wind fields, etc.) |
| Global Illumination | `GlobalIlluminationVct` / `Civct` | Advanced rendering |
| Banana for Scale | `BananaForScale` | Easter egg reference object |

---

## Feature → gzweb Parity Status

| Feature | Location | gz-gui plugin | gzweb support |
|---|---|---|---|
| 3D render | Center | MinimalScene | ✅ SceneManager |
| Scene sync | Center | TransportSceneManager | ✅ SceneManager |
| Orbit/Pan/Zoom | Center | InteractiveViewControl | ✅ OrbitControls |
| Perspective/Ortho | Toolbar | InteractiveViewControl | ⚠️ not exposed |
| Play/Pause/Step | Toolbar | WorldControl | ✅ SceneManager.play/pause |
| Sim Time / RTF | Toolbar | WorldStats | ⚠️ TOPIC-02 planned |
| Entity deletion | Center | TransportSceneManager | ⚠️ TOPIC-01 planned |
| Follow / Move to | Toolbar | CameraTracking | ✅ follow(), moveTo() |
| Screenshot | Toolbar | Screenshot | ✅ snapshot() |
| Entity tree | Left | EntityTree | ❌ no UI |
| Model spawner | Left | ResourceSpawner | ⚠️ SpawnModel.ts, no UI |
| Component inspector | Right | ComponentInspectorEditor | ❌ no UI |
| Transform gizmo | Center | TransformControl | ❌ no TransformControls |
| Copy/Paste entity | Toolbar | CopyPaste | ❌ |
| Visualization toggles | Center | VisualizationCapabilities | ❌ |
| Contact visualization | Center | VisualizeContacts | ⚠️ SDF-03 partial |
| Joint visualization | Center | VisualizationCapabilities | ⚠️ SDF-01 planned |
| Apply Force/Torque | Right/float | ApplyForceTorque | ❌ |
| Plotting | Bottom | TransportPlotting | ❌ no charting |
| Image viewer | Bottom | ImageDisplay | ⚠️ TOPIC-03 planned |
| Topic echo | Bottom | TopicEcho | ❌ |
| Topic viewer | Bottom | TopicViewer | ❌ |
| Log playback | Bottom | PlaybackScrubber | ❌ |
| NavSat map | Bottom | NavSatMap | ❌ |
| Point cloud | Bottom | PointCloud | ⚠️ RENDER-02 planned |
| Lidar viz | Center | VisualizeLidar | ⚠️ RENDER-02 planned |
| Video recorder | Toolbar | VideoRecorder | ❌ |
| View angle presets | Toolbar | ViewAngle | ❌ |
| Grid config | Toolbar | GridConfig | ⚠️ SDF-02 partial |
| Tape measure | Toolbar | TapeMeasure | ❌ |
| Joint controller | Right | JointPositionController | ❌ |
| Mouse drag entity | Center | MouseDrag | ❌ |
| Add lights | Toolbar | Lights | ❌ |
| Spawn shapes | Toolbar | Shapes | ❌ |
| Focus Mode (viewport only) | Toolbar | — (custom UX) | ✅ CSS grid transition + FAB |

**Legend:** ✅ Done · ⚠️ Partial/Planned · ❌ Not available

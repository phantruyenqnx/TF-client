# TF-client

Web frontend for the **TF-platform** drone-simulation stack — a browser-based ground
control station and robotics data-visualization app. TF-client merges a
[Foxglove Studio](https://github.com/foxglove/studio)-derived visualization core with
**gzweb** (Gazebo's web 3D renderer) into a single panel-based UI branded **TF**
(Transform).

It is the *data plane* and UI of the platform: it connects directly to the simulation
bridges for live telemetry and 3D state, and talks to [TF-server](../TF-server) for
control. Telemetry is **not** proxied through the backend.

---

## What it does

- **Panel-based workspace** — a drag-and-drop mosaic of visualization panels
  (`react-mosaic-component`), with layouts and per-panel settings persisted to
  `localStorage`.
- **~22 built-in panels**, including:
  - 3D / spatial: **3D scene** (Three.js), **Map** (Leaflet), Gauge, Indicator
  - Time series: **Plot** (Chart.js), State Transitions
  - Data inspection: Raw Messages, Table, Log, Diagnostics, Topic Graph
  - Interaction: Publish, Call Service, Teleop, Parameters, Variable Slider
  - Platform control: **GCS** (ground control station), **Gazebo** (simulator control)
- **Live message pipeline** — pub/sub topic subscriptions with batched delivery, plus
  timeline playback (play / pause / seek, variable speed).
- **Multiple data sources** — TF/Foxglove WebSocket bridge, ROS 1 (rosbridge), local
  and remote MCAP / ROS 1 bag / ROS 2 bag files.
- **Gazebo 3D control** — full simulator scene rendering via the vendored `gzweb`
  library over the Gazebo WebSocket.
- **Extension system** — custom panels can be loaded at runtime.

---

## Tech stack

| Concern          | Choice |
|------------------|--------|
| Framework        | React 18 + TypeScript 5 |
| Build            | Webpack 5 |
| Package manager  | Yarn 3 (workspaces / monorepo) |
| State            | Zustand + React Context |
| UI               | Material-UI v5 + custom theme (`tss-react`) |
| 3D rendering     | Three.js (via `gzweb`) |
| Charts / maps    | Chart.js, Leaflet |
| i18n             | i18next |

Package: `tf-studio` · License: MPL-2.0.

---

## Repository layout

```
TF-client/
├── src/                         # Yarn-workspaces monorepo (the app)
│   ├── packages/
│   │   ├── studio-base/         # Core: components, panels, players, contexts
│   │   │   └── src/Workspace.tsx   # main UI layout
│   │   ├── studio-web/          # browser entry (main())
│   │   ├── studio/              # shared type definitions
│   │   ├── theme/               # MUI theme
│   │   ├── ws-protocol/         # TF/Foxglove WebSocket wire types
│   │   ├── mcap-support/        # MCAP parsing
│   │   ├── message-path/        # message-path query language
│   │   └── ...                  # 17 internal packages total
│   ├── web/src/entrypoint.tsx   # webpack entry → studio-web main()
│   ├── benchmark/               # performance harness
│   └── .storybook/              # component library
└── lib/                         # gzweb — vendored Gazebo 3D web renderer (Three.js)
```

The `lib/` directory is **not** a workspace package — it is the vendored `gzweb`
library, consumed by `studio-base` via a `file:` dependency and used by the Gazebo panel.

---

## Setup & running

Dependencies are managed with Yarn workspaces. Commands run from `src/`.

```bash
cd src
yarn install

# Development server (http://localhost:8080)
yarn web:serve

# Production build (output in src/web/.webpack)
yarn web:build:prod

# Other
yarn build:packages   # TypeScript build of internal packages
yarn test             # Jest
yarn lint             # ESLint
yarn storybook        # component library on :9009
```

> The vendored `gzweb` library in `lib/` is built separately (`cd lib && yarn build`);
> its `dist/` is copied into `src/node_modules/gzweb/` for the app to consume.

---

## Backend connectivity

TF-client opens independent connections per data source — control via TF-server, and
telemetry / 3D directly from the bridges:

| Service              | Default port | Purpose |
|----------------------|--------------|---------|
| TF / Foxglove bridge | `8765` (ws)  | ROS 1/2 topics, services, parameters |
| Gazebo Web           | `9002` (ws)  | 3D simulator scene & sensor rendering (gzweb) |
| ROSBridge (legacy)   | `9090` (ws)  | ROS 1 bridge |
| TF-server REST/WS    | `3000`       | project & session control |

Supported encodings include JSON, ROS 1 serialization, and ROS 2 CDR, plus Protocol
Buffers, MessagePack, and MCAP. The TF WebSocket protocol is a superset-compatible
variant of the Foxglove WebSocket protocol (`@tf/ws-protocol`).

---

## Documentation

- [`docs/overview.md`](docs/overview.md) — architecture guide.
- [`docs/goal_gazebo_panel.md`](docs/goal_gazebo_panel.md) /
  [`docs/plan_dev_gazebo_panel.md`](docs/plan_dev_gazebo_panel.md) — Gazebo panel
  goals and development plan.

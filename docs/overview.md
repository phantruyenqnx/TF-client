# TF-Client — Source Architecture Overview

## Summary

`TF-client` is a **React + TypeScript web application** for real-time robotics data visualization and simulation control. It is built as a **monorepo** under `src/packages/`, where each package is an independently scoped library. The application connects to data sources (ROS topics, WebSocket servers, MCAP files) and presents data through a flexible, panel-based UI.

---

## Repository Layout

```
TF-client/
├── src/
│   ├── packages/
│   │   ├── studio-base/          # Core library — components, contexts, panels, players
│   │   ├── studio-web/           # Web entry point and browser-specific wiring
│   │   ├── studio/               # Shared type definitions (@tf/studio)
│   │   ├── theme/                # Material-UI theme definitions
│   │   ├── hooks/                # Shared React hooks
│   │   ├── log/                  # Logging utility
│   │   ├── den/                  # General utilities (async, math, workers, etc.)
│   │   ├── message-path/         # Message path query language
│   │   ├── mcap-support/         # MCAP file format parser
│   │   ├── ws-protocol/          # WebSocket protocol type definitions
│   │   └── comlink-transfer-handlers/  # Web worker transfer utilities
│   ├── web/
│   │   └── src/entrypoint.tsx    # Browser HTML mount point
│   ├── benchmark/                # Performance benchmarking app
│   └── .storybook/               # Storybook configuration
├── lib/                          # gzweb — Gazebo 3D rendering library
└── docs/                         # Project documentation
```

---

## Boot Sequence

```
web/src/entrypoint.tsx
  └── main()  [studio-web]
        ├── Browser compatibility check
        ├── initI18n(), installDevtoolsFormatters(), overwriteFetch()
        └── ReactDOM.render(<WebRoot />)
              └── WebRoot.tsx
                    ├── LocalStorageAppConfiguration  (settings persistence)
                    ├── Data source factories         (ROS, WebSocket, MCAP…)
                    └── <SharedRoot>
                          └── ColorSchemeThemeProvider, ErrorBoundary, CssBaseline
                                └── <StudioApp>
                                      ├── ProblemsContextProvider
                                      ├── PlayerManager
                                      ├── CurrentLayoutProvider
                                      ├── TimelineInteractionStateProvider
                                      ├── EventsProvider
                                      └── <Workspace />   ← main UI
```

---

## Package Responsibilities

### `studio-base` — Core Library

The largest and most important package. Everything below lives inside `src/packages/studio-base/src/`.

#### Context & State Management

State is managed with **Zustand** stores exposed through React context, consumed via selector hooks.

| Context | Purpose |
|---------|---------|
| `WorkspaceContext` | Sidebar open/close state, dialog visibility, playback repeat, feature tours |
| `CurrentLayoutContext` | Active panel mosaic layout and panel registry |
| `PlayerSelectionContext` | Selected data source and active player instance |
| `MessagePipelineContext` | Live message delivery — subscriptions, playback controls, topic list |
| `PanelStateContext` | Per-panel persisted configuration |
| `TimelineInteractionStateContext` | Timeline hover/seek UI state |
| `EventsContext` | Timeline event markers |
| `ExtensionCatalogContext` | Registered extension panels |
| `PanelCatalogContext` | Available built-in and extension panel types |
| `AppConfigurationContext` | App-wide settings (key/value, persisted to localStorage) |
| `ProblemsContext` | Errors and warnings surfaced in the UI |
| `StudioLogsSettingsContext` | Debug log channel visibility |

**Selector pattern example:**
```typescript
const isPanelSettingsOpen = useWorkspaceStore(
  (state) => state.sidebars.left.item === 'panel-settings'
);
```

#### Message Pipeline

`components/MessagePipeline/` is the central data bus between players and panels.

```
Player  ──setListener()──►  MessagePipelineProvider  ──useMessagePipeline()──►  Panel
         ◄──subscriptions──                           ◄──setSubscriptions()──
```

The `MessagePipelineContext` interface exposes:
- `playerState` — current player presence, capabilities, active data
- `sortedTopics` — list of available ROS topics
- `messageEventsBySubscriberId` — batched messages per subscriber
- `setSubscriptions()`, `setPublishers()`, `publish()`, `callService()`
- `startPlayback()`, `pausePlayback()`, `seekPlayback()`, `setPlaybackSpeed()`
- `pauseFrame(name): ResumeFrame` — frame-accurate rendering gate

#### Players (`players/`)

Players are the data source adapters. Each implements the `Player` interface.

| State | Meaning |
|-------|---------|
| `NOT_PRESENT` | No data source connected |
| `INITIALIZING` | Connecting / parsing headers |
| `RECONNECTING` | Lost connection, retrying |
| `BUFFERING` | Waiting for data |
| `PRESENT` | Active and delivering messages |
| `ERROR` | Unrecoverable failure |

Player capabilities: `playbackControl`, `advertise`, `callServices`, `assets`, `setSpeed`.

Current implementations include: ROS 1 bridge (`RosbridgePlayer`), TF WebSocket, MCAP file player, remote bag player.

#### Components (`components/`)

**Panel infrastructure:**
- `Panel.tsx` — HOC that adds panel chrome (toolbar, drag handles, settings button) to any component
- `PanelLayout.tsx` — Mosaic tile grid using `react-mosaic-component`
- `PanelRemounter.tsx` — Re-mounts a panel when its type or ID changes
- `PanelErrorBoundary.tsx` — Isolates panel crashes from the rest of the UI
- `UnknownPanel.tsx` — Fallback renderer for unregistered panel types

**Application shell:**
- `AppBar/` — Top bar with window controls and menu
- `Sidebars/` — Left sidebar (panel settings, topics, problems) and right sidebar (events, variables, logs, performance)
- `PlaybackControls/` — Play/pause, seek bar, speed selector
- `DataSourceDialog/` — Data source picker dialog

**Data display utilities:**
- `Chart/` — Chart.js wrapper component
- `TimeBasedChart/` — Time-series line/scatter chart
- `MessagePathSyntax/` — Message path query input with autocomplete
- `SettingsTreeEditor/` — Hierarchical settings form (used by all panel config UIs)
- `JsonTree/` — Collapsible JSON viewer
- `AutoSizingCanvas/` — Canvas that auto-fills its container

#### Panels (`panels/`)

Built-in panel types, each a self-contained React component wrapped with `Panel()`.

| Category | Panels |
|----------|--------|
| Visualization | `ThreeDeeRender` (3D scene), `Image`, `Plot`, `Map`, `Gauge`, `Indicator` |
| Data inspection | `RawMessages`, `Table`, `Log`, `StateTransitions` |
| Interaction | `Publish`, `CallService`, `VariableSlider`, `Parameters` |
| System | `GCS` (ground control), `Gazebo` (simulation control), `TopicGraph`, `DataSourceInfo`, `Teleop` |
| Container | `Tab` (nested panel groups), `Diagnostics` |

#### Hooks (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useMessagePipeline()` | Access the message pipeline context (with optional selector) |
| `useAppConfigurationValue()` | Read/write a single app setting |
| `useGlobalVariables()` | Read/write layout-level global variables |
| `useAddPanel()` | Programmatically add a panel to the layout |
| `usePublisher()` | Publish a message to a ROS topic |
| `useStateToURLSynchronization()` | Persist layout state in the URL |
| `useIndexedDbRecents()` | Read/write recently opened files |
| `useConfirm()` | Show a confirmation dialog imperatively |
| `usePanelDrag()` | Wire up panel drag-and-drop handle |

#### Services (`services/`)

- `migrateLayout/` — Versioned layout schema migration
- `ExtensionLoader.ts` — Dynamic loading of extension panels at runtime
- `messagePathDragging/` — Drag message paths from topic list into panels
- `IAnalytics.ts` / `NullAnalytics.ts` — Analytics interface (no-op default)

#### Utilities (`util/`)

- `appURLState.ts` — Serialize/deserialize app state to/from URL query string
- `layout.ts` — Panel ID generation and type helpers
- `formatTime.ts` — Human-readable time formatting
- `geometry.ts`, `colorUtils.ts` — Math/color helpers
- `bags.ts` — ROS bag utilities
- `FetchReader.ts`, `BrowserHttpReader.ts` — HTTP range request utilities

---

### `studio-web` — Web Entry Point

Thin layer responsible for browser-specific bootstrapping:
- `WebRoot.tsx` — Instantiates `LocalStorageAppConfiguration` and registers all data source factories, then renders `SharedRoot`.
- `LocalStorageAppConfiguration` — Implements the `IAppConfiguration` interface backed by `window.localStorage`.
- Handles browser compatibility detection (Chrome version guard).

---

### `studio` — Shared Types (`@tf/studio`)

Cross-package type definitions consumed by all other packages:

```typescript
interface MessageEvent<T> {
  topic: string;
  schemaName: string;
  receiveTime: Time;
  publishTime?: Time;
  message: T;
  sizeInBytes: number;
}

interface Topic {
  name: string;
  datatype: string;
  convertibleTo?: string[];
}
```

---

### Supporting Packages

| Package | Scope |
|---------|-------|
| `@tf/theme` | Material-UI v5 theme tokens (light/dark, colors, typography) |
| `@tf/hooks` | Generic React hooks shared across packages |
| `@tf/log` | Structured logging with channel-level enable/disable |
| `@tf/den` | Low-level utilities: async queues, math, record helpers, worker pools |
| `@tf/message-path` | Parser for message path expressions (e.g. `/topic.field[0].value`) |
| `@tf/mcap-support` | MCAP file reading — chunked, indexed, streaming |
| `@tf/ws-protocol` | TypeScript types for the TF WebSocket wire protocol |
| `@tf/comlink-transfer-handlers` | Transferable object handlers for `comlink` Web Worker RPC |

---

## Data Flow

### Message delivery (play mode)

```
Data Source (ROS / WebSocket / MCAP / Remote)
  │
  ▼
Player.setListener(callback)
  │  emits PlayerState { activeData: { messages, topics, ... } }
  ▼
MessagePipelineProvider
  │  routes messages to subscribers by topic
  ▼
Panel via useMessagePipeline()
  │  receives MessageEvent[] per render frame
  ▼
Panel renders data
```

### Panel subscription lifecycle

```
Panel mounts
  └── setSubscriptions(subscriberId, [{ topic, preloadType }])
        └── MessagePipelineProvider aggregates all panel subscriptions
              └── Player receives merged subscription list
                    └── Player delivers matching messages back
Panel unmounts
  └── setSubscriptions(subscriberId, [])   // auto-cleanup
```

### Settings persistence

```
User changes a setting
  └── useAppConfigurationValue().set(key, value)
        └── LocalStorageAppConfiguration.set()
              └── localStorage[key] = JSON.stringify(value)
                    └── Subscribers notified via change event
```

---

## Key Design Patterns

| Pattern | Where used |
|---------|-----------|
| **Context + Zustand store** | All global and workspace-level state |
| **Selector hooks** | `useWorkspaceStore(selector)` — avoids unnecessary re-renders |
| **HOC panel wrapper** | `Panel(MyComponent)` — injects drag handles, toolbar, error boundary |
| **Mosaic layout** | `react-mosaic-component` — arbitrary split/resize of panel grid |
| **Error boundaries** | Each panel is isolated; crashes don't propagate |
| **Provider layering** | Providers compose top-down; outer providers never import inner ones |
| **Lazy imports** | Heavy panels and data source drivers loaded on demand |
| **Message path DSL** | `/topic.field[0]` — uniform query syntax for all data-binding panels |
| **Pub/sub subscriptions** | Panels declare what they want; player delivers asynchronously |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18, TypeScript 5 |
| State management | Zustand |
| UI components | Material-UI v5, tss-react |
| Panel layout | react-mosaic-component |
| Drag and drop | react-dnd (HTML5 backend) |
| 3D rendering | Three.js (via gzweb) |
| Charts | Chart.js |
| Maps | Leaflet |
| Serialization | Protocol Buffers, MessagePack |
| File formats | MCAP, ROS bag |
| Internationalization | i18next |
| Build | Webpack 5, Babel |
| Testing | Jest, React Testing Library, Storybook |

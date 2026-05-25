# Plan: Extend Gazebo Panel — Incremental Commits

## Why This Structure Is Appropriate

| Question | Answer |
|----------|--------|
| Where to put the code? | `panels/Gazebo/` — already registered, `panelType = "Gazebo"` unchanged |
| Is `components/` subfolder OK? | Yes — `ThreeDeeRender` (most complex panel) uses 4 subdirs |
| Files outside `panels/Gazebo/` to edit? | **None** — already in catalog, already has i18n strings |
| Will `index.tsx` change? | **No** — 100% unchanged |
| Will existing saved layouts break? | **No** — `panelType = "Gazebo"` stays the same |

---

## Commit Breakdown (7 commits, each independently buildable)

### Commit 1 — Foundation: types + placeholder data + layout skeleton
**Files created/modified:**
- `panels/Gazebo/types.ts` ← NEW
- `panels/Gazebo/placeholder.ts` ← NEW
- `panels/Gazebo/GazeboPanel.tsx` ← REWRITE

**What it does:**
Replace `GazeboPanel.tsx` with a 3-zone CSS grid shell (colored placeholder zones — no real components yet). Types and stub data defined. The panel opens in Studio and shows 3 colored rectangles. Confirms the grid layout works inside the panel system.

```
┌────────────────────────────────────┐
│  [TOOLBAR placeholder]  56px       │
├──────────┬──────────────┬──────────┤
│[LEFT     │ [CENTER      │ [RIGHT   │
│ 260px]   │  1fr]        │  268px]  │
│          ├──────────────┤          │
│          │ [BOTTOM 230] │          │
├──────────┴──────────────┴──────────┤
│  [STATUSBAR 28px]                  │
└────────────────────────────────────┘
```

**Verify:** Panel opens, 3 zones visible with correct proportions, `yarn tsc --noEmit` passes.

---

### Commit 2 — Center viewport: move gzweb logic into CenterViewport
**Files created:**
- `panels/Gazebo/components/CenterViewport.tsx` ← NEW

**What it does:**
Extract all existing gzweb `SceneManager` code from old `GazeboPanel.tsx` into `CenterViewport.tsx`. Add HUD overlays (selection, view cube, axes widget, world control — all `position: absolute`). The CENTER zone in the skeleton now renders the real 3D viewport. Behavior identical to before the refactor.

**Verify:** 3D scene renders exactly as before. World stats still update. `yarn tsc --noEmit` passes.

---

### Commit 3 — Toolbar: GazeboToolbar with all tool groups and stats strip
**Files created:**
- `panels/Gazebo/components/GazeboToolbar.tsx` ← NEW

**What it does:**
Replace the TOOLBAR placeholder with the full toolbar component: 6 button groups (SIM | EDIT | INSERT | VIEW | VIZ | TOOLS) + STATS strip (renders from `STUB_STATS`) + focus mode toggle button (wired to a stub `onToggleFocus` prop, not functional yet). Styled with `makeStyles` + dark color scheme matching the mockup.

**Verify:** Toolbar renders all groups with correct spacing and icons. Stats strip shows stub data. `yarn tsc --noEmit` passes.

---

### Commit 4 — Focus mode: state + CSS grid animations + FAB
**Files modified:**
- `panels/Gazebo/GazeboPanel.tsx` ← add `focusMode` useState + keyboard handler
- `panels/Gazebo/components/CenterViewport.tsx` ← add FAB button + viewport glow
- `panels/Gazebo/components/GazeboToolbar.tsx` ← wire `onToggleFocus` prop

**What it does:**
Wire up the focus mode toggle end-to-end:
- `GazeboPanel.tsx` owns `focusMode: boolean` state
- `F` key toggles, `Escape` exits (ignores when an input is focused)
- CSS grid `gridTemplateRows` and `gridTemplateColumns` transition smoothly via `sx` prop
- `CenterViewport` shows/hides the spring-bounce FAB (`position: fixed`, `cubic-bezier(.34,1.56,.64,1)`)
- Viewport glow pulse on entry (`@keyframes focus-ring`)

**Verify:** Press F → panels collapse with smooth animation, FAB pops in. Press F/Esc → expands back. `yarn tsc --noEmit` passes.

---

### Commit 5 — Left panel: entity tree + resource spawner tabs
**Files created:**
- `panels/Gazebo/components/LeftPanel.tsx` ← NEW

**What it does:**
Replace LEFT placeholder with `LeftPanel`. Two tabs (ENTITY TREE / RESOURCES) using `useState<"tree" | "resources">`. Entity tree renders `STUB_ENTITY_TREE` recursively (x500 model with base_link, 4 sensors, rotor_0..3, 4 joints). Resources tab shows static model list. Tab switching works. Styled with `makeStyles`.

**Verify:** Left panel renders, tabs switch, entity tree shows x500 hierarchy. `yarn tsc --noEmit` passes.

---

### Commit 6 — Right panel: props / physics / light / joints tabs
**Files created:**
- `panels/Gazebo/components/RightPanel.tsx` ← NEW

**What it does:**
Replace RIGHT placeholder. Four tabs using `useState<"props" | "physics" | "light" | "joints">`:
- **PROPS**: pose vec3 grids from `STUB_POSE`, sensor list with Hz rates, material swatches
- **PHYSICS**: mass, inertia matrix, aero constants from `STUB_PHYSICS`
- **LIGHT**: static sun directional light data
- **JOINTS**: 4 MUI `Slider` (0–1000 rad/s), initialized from `STUB_ROTOR_SPEEDS`, local state updates on drag

**Verify:** Right panel renders, all 4 tabs switch, rotor sliders update value on drag. `yarn tsc --noEmit` passes.

---

### Commit 7 — Bottom panel + status bar: all 7 tabs + final polish
**Files created:**
- `panels/Gazebo/components/BottomPanel.tsx` ← NEW
- `panels/Gazebo/components/StatusBar.tsx` ← NEW

**What it does:**
Replace BOTTOM and STATUSBAR placeholders:
- **BottomPanel**: 7 tabs (Plotting / Image Viewer / Topic Echo / Topic Viewer / Log Playback / NavSat Map / Point Cloud). Content is static/stub matching the HTML mockup.
- **StatusBar**: green dot, "GAZEBO SIM 8.9.0", world name, selected entity, gzweb status, SELECT MODE badge.
- Log Playback timeline: MUI `Slider`, local state only.

**Verify:** All 7 bottom tabs switch correctly. Log playback slider draggable. Full UI matches mockup. `yarn tsc --noEmit` passes. Final visual review vs `gazebo_gui_panel_goal.html`.

---

## Final File Tree After All 7 Commits
```
packages/studio-base/src/panels/Gazebo/
├── index.tsx              (unchanged)
├── GazeboPanel.tsx        (rewritten — layout orchestrator)
├── types.ts               (new)
├── placeholder.ts         (new)
└── components/
    ├── GazeboToolbar.tsx  (new)
    ├── CenterViewport.tsx (new — gzweb SceneManager lives here)
    ├── LeftPanel.tsx      (new)
    ├── RightPanel.tsx     (new)
    ├── BottomPanel.tsx    (new)
    └── StatusBar.tsx      (new)
```

---

## Styling Convention
- `makeStyles` from `tss-react/mui` for component-level styles (same as existing `GazeboPanel.tsx`)
- MUI `Box` `sx` for layout (grid, flex, dimensions, transitions)
- Hardcoded dark palette from mockup: `#010409`, `#0d1117`, `#161b22`, `#1c2128`, `#f97316`, `#22d3ee`, `#22c55e`
- Font: `'JetBrains Mono', monospace`
- **All code and comments in English**

---

## Stub-to-API Map (for future commits)
| Stub | Future API |
|------|-----------|
| `STUB_STATS` in toolbar | Subscribe `/world/*/stats` gz-transport |
| `STUB_ENTITY_TREE` in left panel | Subscribe `/world/*/scene/info` |
| `STUB_POSE` in Props tab | Subscribe `/world/*/dynamic_pose/info` |
| `STUB_PHYSICS` in Physics tab | SDF parse / component inspector msgs |
| Rotor sliders local state | Publish `command/motor_speed` |
| Plotting static SVG | Topic subscription + rolling buffer |
| Topic echo/viewer static | gz-transport subscription |
| NavSat static coords | Subscribe `/world/*/navsat` |
| Log playback slider | mcap playback API |
| **3D viewport SceneManager** | **Already real — moved from old GazeboPanel** |

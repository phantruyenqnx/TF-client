# Dark Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSS-variable token system for the dark theme, wire `data-theme="dark"` to the HTML element, migrate all hardcoded hex colors in Gazebo panel components to semantic tokens, and create four reusable primitive components (Panel, StatusDot, Button, Input) that consume the tokens.

**Architecture:** The token layer lives in a new `theme.css` file (plain CSS, no library) imported via `CssBaseline.tsx`, which already loads global styles. `ThemeProvider.tsx` sets `data-theme="dark"` on `document.documentElement` so a future light theme can override `:root` values via `[data-theme="light"]`. The existing MUI palette is unchanged — the CSS tokens are a parallel design-system layer consumed by custom Gazebo components and new primitives. No Tailwind; no theming library.

**Tech Stack:** React 18, MUI 5, tss-react/mui, Webpack 5, CSS custom properties, TypeScript 5, yarn workspaces

---

## Color Mapping Reference

Use this table when migrating any hardcoded hex in Gazebo components. **Do not look up intent from the color value alone — look at which style property it's used in.**

| Hardcoded value | CSS token | Intent |
|---|---|---|
| `#030712`, `#0d1117` | `var(--color-bg-page)` | Deepest page/canvas bg |
| `#161b22` | `var(--color-bg-panel)` | Panel/sidebar bg |
| `#1c2128` | `var(--color-bg-elevated)` | Cards, dropdowns, elevated surfaces |
| `#21262d` | `var(--color-border-subtle)` | Hairline dividers |
| `#30363d` | `var(--color-border-default)` | Default borders |
| `#c9d1d9` | `var(--color-text-primary)` | Primary body text |
| `#8b949e` | `var(--color-text-secondary)` | Secondary/label text |
| `#6e7681` | `var(--color-text-tertiary)` | Placeholder, timestamps |
| `#f97316`, `#fb923c` | `var(--color-accent)` | Accent color (active states, links, CTAs) |
| `rgba(249,115,22,.10)` `rgba(249,115,22,.18)` `rgba(249,115,22,.12)` `rgba(249,115,22,.20)` | `var(--color-accent-muted)` | Tinted accent backgrounds |
| `rgba(10,15,25,.88)` `rgba(13,17,23,.92)` | `var(--color-bg-overlay)` | Translucent HUD overlay |
| `rgba(22,27,34,.9)` | `var(--color-bg-elevated)` | SVG/canvas fill with alpha (use literal) |
| `#22c55e` | `var(--color-success)` | Connected/armed/OK state |
| `rgba(34,197,94,.7)` | keep as-is | LED glow shadow — leave literal |
| `#22d3ee` | `var(--color-info)` | Telemetry values, info |
| `rgba(34,211,238,.08)` | `var(--color-info-muted)` | Badge info background |
| `#ef4444` | `var(--color-danger)` | Disconnected/error state |
| Font `'JetBrains Mono', monospace` | `typography.fontMonospace` | Monospace font |

**Semi-transparent accent in MUI `sx` props:** Use `color-mix(in srgb, var(--color-accent) 20%, transparent)` instead of hardcoded `rgba(249,115,22,.20)`.

**Keyframe animations:** Cannot use CSS variables inside `rgba()` in JS keyframe strings. Use literal `rgba(77,141,245,X)` — the RGB breakdown of `#4d8df5`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `packages/studio-base/src/styles/theme.css` |
| Modify | `packages/studio-base/src/components/CssBaseline.tsx` |
| Modify | `packages/studio-base/src/theme/ThemeProvider.tsx` |
| Modify | `packages/studio-web/src/webpackConfigs.ts` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/GazeboToolbar.tsx` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/BottomPanel.tsx` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx` |
| Modify | `packages/studio-base/src/panels/Gazebo/components/CenterViewport.tsx` |
| Create | `packages/studio-base/src/components/ui/Panel.tsx` |
| Create | `packages/studio-base/src/components/ui/StatusDot.tsx` |
| Create | `packages/studio-base/src/components/ui/Button.tsx` |
| Create | `packages/studio-base/src/components/ui/Input.tsx` |
| Create | `packages/studio-base/src/components/ui/index.ts` |

---

## Task 1: Create theme.css token file

**Files:**
- Create: `packages/studio-base/src/styles/theme.css`

- [ ] **Step 1.1: Create the file with the full token set**

Create `packages/studio-base/src/styles/theme.css` with this exact content:

```css
:root,
[data-theme="dark"] {
  /* Surfaces */
  --color-bg-page:     #0b0d10;
  --color-bg-panel:    #14171c;
  --color-bg-elevated: #1c2128;
  --color-bg-hover:    #262c34;
  --color-bg-active:   #2e353f;
  --color-bg-overlay:  rgba(11, 13, 16, 0.90);

  /* Borders */
  --color-border-subtle:  #1f242c;
  --color-border-default: #2a313a;
  --color-border-strong:  #3a4250;
  --color-border-focus:   #4d8df5;

  /* Text */
  --color-text-primary:   #e6e8eb;
  --color-text-secondary: #a4abb5;
  --color-text-tertiary:  #6b7280;
  --color-text-disabled:  #4b525c;
  --color-text-inverse:   #0b0d10;

  /* Accent */
  --color-accent:        #4d8df5;
  --color-accent-hover:  #6ba0ff;
  --color-accent-active: #3a7ae0;
  --color-accent-muted:  #1a2740;
  --color-accent-fg:     #ffffff;

  /* Semantic — success */
  --color-success:       #4ade80;
  --color-success-muted: #143524;
  --color-success-fg:    #052e16;

  /* Semantic — warning */
  --color-warning:       #f59e0b;
  --color-warning-muted: #3a2a07;
  --color-warning-fg:    #1a1203;

  /* Semantic — danger */
  --color-danger:        #ef4444;
  --color-danger-muted:  #3a1414;
  --color-danger-fg:     #ffffff;

  /* Semantic — info */
  --color-info:          #38bdf8;
  --color-info-muted:    #0e2e3d;
  --color-info-fg:       #032029;

  /* Data / telemetry */
  --color-data-good:    #4ade80;
  --color-data-warn:    #f59e0b;
  --color-data-bad:     #ef4444;
  --color-data-neutral: #94a3b8;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.5);
  --shadow-lg: 0 12px 24px rgba(0,0,0,0.6);

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Spacing (4px base) */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
}

html, body {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  color-scheme: dark;
}

/* Scrollbar */
* {
  scrollbar-color: var(--color-border-strong) var(--color-bg-page);
  scrollbar-width: thin;
}
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: var(--color-bg-page); }
*::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 4px;
}
*::-webkit-scrollbar-thumb:hover { background: var(--color-text-tertiary); }

/* Selection */
::selection {
  background: var(--color-accent-muted);
  color: var(--color-text-primary);
}

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 1.2: Verify the file exists**

```bash
ls -la /home/frank/tf-platform/TF-client/src/packages/studio-base/src/styles/
```

Expected: `globals.css` and `theme.css` both present.

---

## Task 2: Wire tokens — import, data-theme, FOUC fix

**Files:**
- Modify: `packages/studio-base/src/components/CssBaseline.tsx`
- Modify: `packages/studio-base/src/theme/ThemeProvider.tsx`
- Modify: `packages/studio-web/src/webpackConfigs.ts`

- [ ] **Step 2.1: Import theme.css in CssBaseline.tsx**

In `packages/studio-base/src/components/CssBaseline.tsx`, the current imports (lines 10–13) are:

```ts
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@tf/studio-base/styles/globals.css";
```

Add `theme.css` after `globals.css`:

```ts
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@tf/studio-base/styles/globals.css";
import "@tf/studio-base/styles/theme.css";
```

- [ ] **Step 2.2: Set data-theme in ThemeProvider.tsx**

In `packages/studio-base/src/theme/ThemeProvider.tsx`, the existing `useEffect` at lines 29–35 already sets `data-color-mode`. Add `data-theme` alongside it:

```ts
useEffect(() => {
  // Trick CodeEditor into sync with our theme
  document.documentElement.setAttribute("data-color-mode", isDark ? "dark" : "light");
  // Scope CSS design tokens to current theme
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  // remove styles set to prevent browser flash on init
  document.querySelector("#loading-styles")?.remove();
}, [isDark]);
```

- [ ] **Step 2.3: Fix FOUC in HTML template**

In `packages/studio-web/src/webpackConfigs.ts`, find the `templateContent` function (around line 151). Update two things:

**a)** Add `data-theme="dark"` to the `<html>` opening tag so the CSS tokens apply before any JS runs:

```ts
templateContent: ({ htmlWebpackPlugin }) => `
<!doctype html>
<html data-theme="dark">
  <head>
```

**b)** Update the `#loading-styles` block background to match the new token value. Find this section (around line 162–170):

```ts
      <style type="text/css" id="loading-styles">
        body {
          margin: 0;
        }
        #root {
          height: 100vh;
          background-color: ${palette.light.background?.default};
          color: ${palette.light.text?.primary};
        }
        @media (prefers-color-scheme: dark) {
          #root {
            background-color: ${palette.dark.background?.default}};
            color: ${palette.dark.text?.primary};
          }
        }
      </style>
```

Replace with:

```ts
      <style type="text/css" id="loading-styles">
        body {
          margin: 0;
          background: #0b0d10;
        }
        #root {
          height: 100vh;
          background-color: #0b0d10;
          color: #e6e8eb;
        }
      </style>
```

> **Why simplify to dark-only?** The spec says dark-only for now. The `@media (prefers-color-scheme: dark)` conditional is no longer needed since dark is the default and `data-theme` handles future switching.

- [ ] **Step 2.4: Verify build compiles**

```bash
cd /home/frank/tf-platform/TF-client/src && yarn web:build:dev 2>&1 | tail -20
```

Expected: `compiled successfully`.

---

## Task 3: Migrate GazeboToolbar.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/GazeboToolbar.tsx`

This file currently uses `makeStyles()(() => ({` (no theme arg) and has hardcoded fonts and hex colors. We fix both in one pass.

- [ ] **Step 3.1: Update makeStyles signature and replace all hardcoded values**

Replace the `makeStyles` call opening from:

```ts
const useStyles = makeStyles()(() => ({
```

to:

```ts
const useStyles = makeStyles()(({ typography }) => ({
```

Then replace every hardcoded value in the styles object. The complete updated styles block is:

```ts
const useStyles = makeStyles()(({ typography }) => ({
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "0 10px",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "var(--color-bg-panel)",
    borderBottom: "1px solid var(--color-border-subtle)",
    fontFamily: typography.fontMonospace,
    fontSize: 11,
  },
  sep: {
    width: 1,
    height: 28,
    backgroundColor: "var(--color-border-default)",
    flexShrink: 0,
    margin: "0 4px",
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  groupLabel: {
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".8px",
    marginRight: 1,
    whiteSpace: "nowrap" as const,
  },
  ib: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 4,
    background: "transparent",
    color: "var(--color-text-secondary)",
    fontSize: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: typography.fontMonospace,
    transition: "background 0.15s, color 0.15s",
    padding: 0,
    "&:hover": {
      background: "var(--color-bg-elevated)",
      color: "var(--color-text-primary)",
    },
  },
  ibActive: {
    background: "var(--color-accent-muted)",
    color: "var(--color-accent)",
    outline: "1px solid var(--color-accent)",
  },
  ibDanger: {
    "&:hover": {
      color: "var(--color-danger)",
    },
  },
}));
```

- [ ] **Step 3.2: Update inline JSX Box separators**

Inside the component JSX, find:

```tsx
<Box sx={{ width: 1, height: 20, bgcolor: "#30363d", mx: "2px" }} />
```

(appears twice)

Replace both with:

```tsx
<Box sx={{ width: 1, height: 20, bgcolor: "var(--color-border-default)", mx: "2px" }} />
```

- [ ] **Step 3.3: Verify no hardcoded hex remains**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/GazeboToolbar.tsx
```

Expected: no output.

---

## Task 4: Migrate StatusBar.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx`

Font was already fixed in the typography task. Only colors need updating.

- [ ] **Step 4.1: Replace all hardcoded colors in makeStyles**

The complete updated styles block (signature already has `({ typography })`):

```ts
const useStyles = makeStyles()(({ typography }) => ({
  root: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    paddingLeft: 10,
    paddingRight: 10,
    gap: 14,
    fontFamily: typography.fontMonospace,
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    letterSpacing: ".4px",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "var(--color-success)",
    flexShrink: 0,
    boxShadow: "0 0 4px rgba(34,197,94,.7)",
  },
  brand: {
    color: "var(--color-text-primary)",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: ".5px",
  },
  sep: {
    color: "var(--color-border-default)",
    fontSize: 10,
    lineHeight: 1,
    flexShrink: 0,
  },
  badge: {
    padding: "1px 6px",
    borderRadius: 3,
    border: "1px solid var(--color-border-default)",
    fontSize: 7,
    letterSpacing: ".6px",
    flexShrink: 0,
  },
  badgeOrange: {
    color: "var(--color-accent)",
    borderColor: "var(--color-accent)",
    backgroundColor: "var(--color-accent-muted)",
  },
  badgeCyan: {
    color: "var(--color-info)",
    borderColor: "var(--color-info)",
    backgroundColor: "var(--color-info-muted)",
  },
  entity: {
    color: "var(--color-accent)",
    fontWeight: 700,
  },
  spacer: { flex: 1 },
}));
```

- [ ] **Step 4.2: Replace inline styles in JSX**

Find line 85 in the component JSX:

```tsx
<span>WORLD: <span style={{ color: "#c9d1d9" }}>{worldName}</span></span>
```

Replace with:

```tsx
<span>WORLD: <span style={{ color: "var(--color-text-primary)" }}>{worldName}</span></span>
```

Find line 92:

```tsx
style={{ color: connected ? "#22c55e" : "#ef4444" }}
```

Replace with:

```tsx
style={{ color: connected ? "var(--color-success)" : "var(--color-danger)" }}
```

- [ ] **Step 4.3: Verify no hardcoded hex remains**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx
```

Expected: no output.

---

## Task 5: Migrate BottomPanel.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/BottomPanel.tsx`

This file still has hardcoded fonts AND colors. Fix both.

- [ ] **Step 5.1: Update makeStyles signature**

Change:

```ts
const useStyles = makeStyles()(() => ({
```

to:

```ts
const useStyles = makeStyles()(({ typography }) => ({
```

- [ ] **Step 5.2: Replace all hardcoded values — complete updated makeStyles block**

Replace the entire `useStyles` definition with:

```ts
const useStyles = makeStyles()(({ typography }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    fontFamily: typography.fontMonospace,
    fontSize: 11,
    color: "var(--color-text-primary)",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "var(--color-bg-panel)",
    borderBottom: "1px solid var(--color-border-subtle)",
    flexShrink: 0,
    overflowX: "auto" as const,
    "&::-webkit-scrollbar": { height: 0 },
  },
  tab: {
    flexShrink: 0,
    padding: "7px 10px",
    fontSize: 8,
    color: "var(--color-text-tertiary)",
    cursor: "pointer",
    letterSpacing: ".5px",
    whiteSpace: "nowrap" as const,
    transition: "color .15s, border-color .15s",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: typography.fontMonospace,
    "&:hover": { color: "var(--color-text-primary)" },
  },
  tabActive: {
    color: "var(--color-accent)",
    borderBottom: "2px solid var(--color-accent) !important",
    fontWeight: 700,
    backgroundColor: "var(--color-bg-page)",
  },
  body: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
  },
  scrollBody: {
    height: "100%",
    overflowY: "auto" as const,
    padding: "10px 12px",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-track": { background: "var(--color-bg-page)" },
    "&::-webkit-scrollbar-thumb": { background: "var(--color-border-default)", borderRadius: 3 },
  },
  plotHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  plotTitle: { fontSize: 8, color: "var(--color-text-tertiary)", letterSpacing: ".6px" },
  plotAddBtn: {
    fontSize: 7,
    color: "var(--color-accent)",
    cursor: "pointer",
    background: "none",
    border: "1px solid var(--color-accent)",
    borderRadius: 3,
    padding: "2px 6px",
    fontFamily: typography.fontMonospace,
  },
  plotCanvas: {
    width: "100%",
    height: 100,
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
    overflow: "hidden",
  },
  plotLegend: {
    display: "flex",
    gap: 12,
    marginTop: 6,
    flexWrap: "wrap" as const,
  },
  plotLegendItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 7,
    color: "var(--color-text-tertiary)",
  },
  plotDot: {
    width: 8,
    height: 2,
    borderRadius: 1,
    flexShrink: 0,
  },
  imageFrame: {
    width: "100%",
    height: 140,
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column" as const,
    gap: 6,
  },
  imageIcon: { fontSize: 28, color: "var(--color-border-default)" },
  imageLabel: { fontSize: 8, color: "var(--color-text-tertiary)", letterSpacing: ".5px" },
  topicSelector: {
    display: "flex",
    gap: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  topicSelect: {
    flex: 1,
    backgroundColor: "var(--color-bg-panel)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    padding: "4px 8px",
    color: "var(--color-text-primary)",
    fontFamily: typography.fontMonospace,
    fontSize: 8,
    outline: "none",
  },
  topicSubBtn: {
    fontSize: 7,
    color: "var(--color-info)",
    cursor: "pointer",
    background: "none",
    border: "1px solid var(--color-info)",
    borderRadius: 3,
    padding: "4px 8px",
    fontFamily: typography.fontMonospace,
    flexShrink: 0,
  },
  echoBlock: {
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 4,
    padding: "8px 10px",
    fontSize: 8,
    color: "var(--color-success)",
    lineHeight: 1.8,
    fontFamily: typography.fontMonospace,
  },
  playbackHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: "1px solid var(--color-border-default)",
    background: "var(--color-bg-panel)",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    flexShrink: 0,
  },
  playbackTime: { fontSize: 9, color: "var(--color-info)" },
  playbackDur: { fontSize: 9, color: "var(--color-text-tertiary)", marginLeft: "auto" },
  mapFrame: {
    width: "100%",
    height: 130,
    backgroundColor: "var(--color-bg-page)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 4,
    position: "relative" as const,
    overflow: "hidden",
  },
  // remainder of BottomPanel styles (mapGrid, etc.) — apply same pattern:
  // any background "#0d1117" or "#161b22" → bg-page / bg-panel
  // any color "#6e7681" → text-tertiary, "#c9d1d9" → text-primary
  // any border "#30363d" → border-default, "#21262d" → border-subtle
}));
```

> **Note on mapGrid and remaining styles:** The BottomPanel has additional styles below `mapFrame` (mapGrid, mapLine, mapDot, etc.). Apply the same color mapping pattern from the reference table at the top of the plan. The rules above cover 100% of the distinct color values used.

- [ ] **Step 5.3: Verify no hardcoded hex remains**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}\|'JetBrains Mono'" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/BottomPanel.tsx
```

Expected: no output.

---

## Task 6: Migrate LeftPanel.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx`

Font already fixed in typography task. Signature is already `(({ typography }) => ({`. Only colors need migration.

- [ ] **Step 6.1: Replace all hardcoded colors in makeStyles**

Apply using the color mapping table. The complete updated styles block:

```ts
const useStyles = makeStyles()(({ typography }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    fontFamily: typography.fontMonospace,
    fontSize: 11,
    color: "var(--color-text-primary)",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "var(--color-bg-panel)",
    borderBottom: "1px solid var(--color-border-subtle)",
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: "8px 4px",
    textAlign: "center" as const,
    fontSize: 9,
    color: "var(--color-text-tertiary)",
    cursor: "pointer",
    letterSpacing: ".6px",
    transition: "color .15s, border-color .15s",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: typography.fontMonospace,
    "&:hover": { color: "var(--color-text-primary)" },
  },
  tabActive: {
    color: "var(--color-accent)",
    borderBottom: "2px solid var(--color-accent) !important",
    fontWeight: 700,
    backgroundColor: "var(--color-bg-page)",
  },
  treeContainer: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "6px 4px",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-track": { background: "var(--color-bg-page)" },
    "&::-webkit-scrollbar-thumb": { background: "var(--color-border-default)", borderRadius: 3 },
  },
  treeRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 4px",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 9,
    color: "var(--color-text-primary)",
    "&:hover": { backgroundColor: "var(--color-bg-panel)" },
  },
  treeRowSelected: {
    backgroundColor: "var(--color-bg-panel)",
    color: "var(--color-accent)",
  },
  treeIcon: {
    fontSize: 9,
    color: "var(--color-text-tertiary)",
    width: 14,
    textAlign: "center" as const,
  },
  treeTag: {
    marginLeft: "auto",
    fontSize: 7,
    color: "var(--color-text-tertiary)",
    letterSpacing: ".3px",
    whiteSpace: "nowrap" as const,
  },
  resSearch: {
    width: "100%",
    backgroundColor: "var(--color-bg-panel)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 3,
    padding: "5px 8px",
    color: "var(--color-text-primary)",
    fontFamily: typography.fontMonospace,
    fontSize: 9,
    marginBottom: 8,
    outline: "none",
    "&::placeholder": { color: "var(--color-text-tertiary)" },
  },
  resTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 8,
  },
  resTab: {
    padding: "3px 10px",
    fontSize: 8,
    borderRadius: 3,
    cursor: "pointer",
    backgroundColor: "var(--color-bg-panel)",
    color: "var(--color-text-tertiary)",
    border: "1px solid var(--color-border-default)",
    fontFamily: typography.fontMonospace,
  },
  resTabActive: {
    backgroundColor: "var(--color-accent-muted)",
    color: "var(--color-accent)",
    borderColor: "var(--color-accent)",
  },
  resItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 6px",
    borderRadius: 3,
    cursor: "pointer",
    borderBottom: "1px solid var(--color-border-subtle)",
    "&:hover": { backgroundColor: "var(--color-bg-panel)" },
  },
  resIcon: {
    width: 28,
    height: 28,
    backgroundColor: "var(--color-bg-elevated)",
    borderRadius: 3,
    border: "1px solid var(--color-border-default)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  resName: { fontSize: 9, color: "var(--color-text-primary)" },
  resSub: { fontSize: 8, color: "var(--color-text-tertiary)" },
}));
```

- [ ] **Step 6.2: Replace hardcoded colors in JSX inline styles**

Find line 201 (inline style on the collapse indicator span):

```tsx
<span style={{ width: 10, flexShrink: 0, fontSize: 8, color: "#6e7681" }}>
```

Replace with:

```tsx
<span style={{ width: 10, flexShrink: 0, fontSize: 8, color: "var(--color-text-tertiary)" }}>
```

Find line 252 (spawn entity link):

```tsx
<span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700, fontSize: 9 }}>
```

Replace with:

```tsx
<span style={{ color: "var(--color-accent)", cursor: "pointer", fontWeight: 700, fontSize: 9 }}>
```

- [ ] **Step 6.3: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx
```

Expected: no output (TAG_COLORS object may contain hex values — those are 3D-entity semantic colors, intentional, leave them).

---

## Task 7: Migrate RightPanel.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx`

Font already fixed. Signature already `(({ typography }) => ({`.

- [ ] **Step 7.1: Replace all hardcoded colors in makeStyles**

Apply the color mapping to the full styles block. Key substitutions:

```ts
// root
color: "var(--color-text-primary)",
// tabBar
backgroundColor: "var(--color-bg-panel)",
borderBottom: "1px solid var(--color-border-subtle)",
// tab
color: "var(--color-text-tertiary)",
fontFamily: typography.fontMonospace,
"&:hover": { color: "var(--color-text-primary)" },
// tabActive
color: "var(--color-accent)",
borderBottom: "2px solid var(--color-accent) !important",
backgroundColor: "var(--color-bg-page)",
// body scrollbars
"&::-webkit-scrollbar-track": { background: "var(--color-bg-page)" },
"&::-webkit-scrollbar-thumb": { background: "var(--color-border-default)", borderRadius: 3 },
// sectionLabel
color: "var(--color-text-tertiary)",
// card
backgroundColor: "var(--color-bg-panel)",
border: "1px solid var(--color-border-default)",
// vec3Label, kvKey, vec3Header, sensorHz equivalents
color: "var(--color-text-tertiary)",    // labels
color: "var(--color-info)",             // values (vec3Cell, sensorHz, rotorValue, matrixCell)
// kvValue, sensorName, rotorLabel
color: "var(--color-text-primary)",
// kvRow border
borderBottom: "1px solid var(--color-border-subtle)",
// vec3Cell / matrixCell
backgroundColor: "var(--color-bg-page)",
border: "1px solid var(--color-border-default)",
color: "var(--color-info)",
// matrixDiag
color: "var(--color-accent)",
// sensorRow hover
"&:hover": { backgroundColor: "var(--color-bg-elevated)" },
// swatch
border: "1px solid var(--color-border-default)",
// swatchLabel
color: "var(--color-text-tertiary)",
// swatchValue
color: "var(--color-text-primary)",
// rotorDir
color: "var(--color-text-tertiary)",
```

- [ ] **Step 7.2: Update the MUI Slider sx prop (JointsTab)**

Find the `<Slider>` component `sx` prop (around line 398):

```tsx
sx={{
  color: "#f97316",
  padding: "6px 0",
  "& .MuiSlider-thumb": {
    width: 10,
    height: 10,
    "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 6px rgba(249,115,22,.2)" },
  },
  "& .MuiSlider-rail": { backgroundColor: "#30363d" },
}}
```

Replace with:

```tsx
sx={{
  color: "var(--color-accent)",
  padding: "6px 0",
  "& .MuiSlider-thumb": {
    width: 10,
    height: 10,
    "&:hover, &.Mui-focusVisible": {
      boxShadow: "0 0 0 6px color-mix(in srgb, var(--color-accent) 20%, transparent)",
    },
  },
  "& .MuiSlider-rail": { backgroundColor: "var(--color-border-default)" },
}}
```

- [ ] **Step 7.3: Update inline styles in LightTab JSX**

Find (around line 333):
```tsx
<div style={{ fontSize: 7, color: "#6e7681", textAlign: "center" }}>X</div>
```
(three occurrences for X, Y, Z column headers)

Replace each with:
```tsx
<div style={{ fontSize: 7, color: "var(--color-text-tertiary)", textAlign: "center" }}>X</div>
```

- [ ] **Step 7.4: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx
```

Expected: no output (material color swatches `#1a1a2e`, `#4a4a6a`, `#000000` in the stub data arrays are display values, not theme colors — leave them).

---

## Task 8: Migrate CenterViewport.tsx

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/CenterViewport.tsx`

This file uses inline `sx` objects and a module-level `hudSx` constant. No makeStyles.

- [ ] **Step 8.1: Update the hudSx constant (lines 59–70)**

Find:

```ts
const hudSx = {
  position: "absolute" as const,
  padding: "8px 11px",
  background: "rgba(10,15,25,.88)",
  border: "1px solid #30363d",
  borderRadius: "5px",
  fontSize: 9,
  backdropFilter: "blur(4px)",
  fontFamily: "'JetBrains Mono', monospace",
  color: "#c9d1d9",
  lineHeight: 1.6,
};
```

Replace with:

```ts
const hudSx = {
  position: "absolute" as const,
  padding: "8px 11px",
  background: "var(--color-bg-overlay)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "5px",
  fontSize: 9,
  backdropFilter: "blur(4px)",
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-primary)",
  lineHeight: 1.6,
};
```

- [ ] **Step 8.2: Update the main Box bgcolor (line ~272)**

Find:

```tsx
bgcolor: "#030712",
```

Replace with:

```tsx
bgcolor: "var(--color-bg-page)",
```

- [ ] **Step 8.3: Update the focus-ring keyframe animation (lines ~295–297)**

The orange color `rgba(249,115,22,X)` needs to become the accent blue. Since CSS variables cannot be used inside `rgba()` in JS strings, use the literal RGB breakdown of `#4d8df5`:

```tsx
"@keyframes focusRing": {
  "0%":   { boxShadow: "inset 0 0 0 2px rgba(77,141,245,0)" },
  "35%":  { boxShadow: "inset 0 0 0 2px rgba(77,141,245,.65)" },
  "100%": { boxShadow: "inset 0 0 0 2px rgba(77,141,245,0)" },
},
```

- [ ] **Step 8.4: Update the exit FAB button sx prop (lines ~313–342)**

Replace all hardcoded colors in the FAB `sx` prop:

```tsx
sx={{
  position: "absolute",
  top: 14,
  right: 14,
  zIndex: 500,
  width: 34,
  height: 34,
  borderRadius: "8px",
  border: "1px solid var(--color-border-default)",
  bgcolor: "var(--color-bg-overlay)",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-mono)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,.6)",
  opacity: focusMode ? 1 : 0,
  pointerEvents: focusMode ? "auto" : "none",
  transform: focusMode ? "scale(1) rotate(0deg)" : "scale(.5) rotate(90deg)",
  transition:
    "opacity .28s ease .15s, transform .28s cubic-bezier(.34,1.56,.64,1) .15s, color .15s ease, border-color .15s ease",
  "&:hover": {
    color: "var(--color-accent)",
    borderColor: "var(--color-accent)",
    bgcolor: "var(--color-accent-muted)",
  },
}}
```

- [ ] **Step 8.5: Update entity HUD Box colors (lines ~354–367)**

```tsx
<Box
  sx={{
    width: 7,
    height: 7,
    borderRadius: "50%",
    bgcolor: selectedEntity ? "var(--color-accent)" : "var(--color-border-default)",
    flexShrink: 0,
  }}
/>
<Box>
  <Box sx={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 10 }}>
    {selectedEntity?.name ?? "—"}
  </Box>
  <Box sx={{ color: "var(--color-text-tertiary)", fontSize: 8 }}>
    {selectedEntity
      ? `model · ${selectedEntity.linkCount} links`
      : "click model to select"}
  </Box>
</Box>
```

- [ ] **Step 8.6: Update view cube SVG colors**

Find the SVG polygon and line elements (around line 374–387):

```tsx
fill="rgba(22,27,34,.9)"
stroke="#30363d"
```
→
```tsx
fill="var(--color-bg-elevated)"
stroke="var(--color-border-default)"
```

```tsx
stroke="#30363d"
```
(three `<line>` elements)
→
```tsx
stroke="var(--color-border-default)"
```

```tsx
fill="#6e7681"
```
(three `<text>` elements)
→
```tsx
fill="var(--color-text-tertiary)"
```

- [ ] **Step 8.7: Update view preset button colors**

For all `Box component="button"` sx props in the view preset rows, replace:
- `color: "#8b949e"` → `color: "var(--color-text-secondary)"`
- `"&:hover": { background: "rgba(255,255,255,.07)", color: "#c9d1d9" }` → `"&:hover": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" }`
- `fontFamily: "'JetBrains Mono', monospace"` → `fontFamily: "var(--font-mono)"`

For the ortho toggle button (the one using `isOrtho` state):
```tsx
background: isOrtho ? "var(--color-accent-muted)" : "transparent",
color: isOrtho ? "var(--color-accent)" : "var(--color-text-secondary)",
```

- [ ] **Step 8.8: Verify**

```bash
grep -n "'JetBrains Mono'\|#[0-9a-fA-F]\{3,6\}\|rgba(249\|rgba(34,197\|rgba(13,17\|rgba(10,15\|rgba(22,27" \
  /home/frank/tf-platform/TF-client/src/packages/studio-base/src/panels/Gazebo/components/CenterViewport.tsx
```

Expected: only `rgba(77,141,245` (the keyframe accent) and `rgba(0,0,0,.6)` (drop shadow) and `rgba(255,255,255,.07)` if any remain after step 8.7 — all acceptable.

---

## Task 9: Create primitive UI components

**Files:**
- Create: `packages/studio-base/src/components/ui/Panel.tsx`
- Create: `packages/studio-base/src/components/ui/StatusDot.tsx`
- Create: `packages/studio-base/src/components/ui/Button.tsx`
- Create: `packages/studio-base/src/components/ui/Input.tsx`
- Create: `packages/studio-base/src/components/ui/index.ts`

These are CSS-token-based primitives for use in new components. They do NOT replace MUI components or the existing Gazebo code.

- [ ] **Step 9.1: Create Panel.tsx**

```tsx
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  elevated?: boolean;
  style?: CSSProperties;
  className?: string;
}>;

const panelStyle: CSSProperties = {
  background: "var(--color-bg-panel)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3)",
};

const elevatedStyle: CSSProperties = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3)",
  boxShadow: "var(--shadow-sm)",
};

export function Panel({ elevated = false, style, className, children }: PanelProps): JSX.Element {
  return (
    <div
      className={className}
      style={{ ...(elevated ? elevatedStyle : panelStyle), ...style }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 9.2: Create StatusDot.tsx**

```tsx
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties } from "react";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

type StatusDotProps = {
  variant?: StatusVariant;
  size?: number;
  pulse?: boolean;
};

const variantColor: Record<StatusVariant, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
  info:    "var(--color-info)",
  neutral: "var(--color-text-tertiary)",
};

export function StatusDot({ variant = "neutral", size = 8, pulse = false }: StatusDotProps): JSX.Element {
  const color = variantColor[variant];

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    backgroundColor: color,
    flexShrink: 0,
    ...(pulse && { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }),
  };

  return <span style={style} aria-hidden="true" />;
}
```

- [ ] **Step 9.3: Create Button.tsx**

Uses `makeStyles` from tss-react/mui (already in the project) so hover states work via CSS classes.

```tsx
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ButtonHTMLAttributes } from "react";
import { makeStyles } from "tss-react/mui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const useStyles = makeStyles<{ variant: ButtonVariant; size: ButtonSize }>()(
  (_theme, { variant, size }) => ({
    root: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-1)",
      border: "1px solid transparent",
      borderRadius: "var(--radius-sm)",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontWeight: 500,
      lineHeight: 1,
      transition: "background 0.15s, color 0.15s, border-color 0.15s",
      ...(size === "sm"
        ? { fontSize: "var(--text-xs)", padding: "3px 8px", height: 24 }
        : { fontSize: "var(--text-sm)", padding: "5px 12px", height: 28 }),
      ...(variant === "primary" && {
        background: "var(--color-accent)",
        color: "var(--color-accent-fg)",
        borderColor: "var(--color-accent)",
        "&:hover:not(:disabled)": { background: "var(--color-accent-hover)" },
      }),
      ...(variant === "secondary" && {
        background: "var(--color-bg-elevated)",
        color: "var(--color-text-primary)",
        borderColor: "var(--color-border-default)",
        "&:hover:not(:disabled)": { background: "var(--color-bg-hover)", borderColor: "var(--color-border-strong)" },
      }),
      ...(variant === "ghost" && {
        background: "transparent",
        color: "var(--color-text-secondary)",
        borderColor: "transparent",
        "&:hover:not(:disabled)": { background: "var(--color-bg-hover)", color: "var(--color-text-primary)" },
      }),
      ...(variant === "danger" && {
        background: "var(--color-danger-muted)",
        color: "var(--color-danger)",
        borderColor: "var(--color-danger)",
        "&:hover:not(:disabled)": { background: "var(--color-danger-muted)", filter: "brightness(1.15)" },
      }),
      "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
    },
  }),
);

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonProps): JSX.Element {
  const { classes, cx } = useStyles({ variant, size });
  return <button type="button" className={cx(classes.root, className)} {...rest} />;
}
```

- [ ] **Step 9.4: Create Input.tsx**

```tsx
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { InputHTMLAttributes, CSSProperties } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  size?: "sm" | "md";
};

const base: CSSProperties = {
  display: "block",
  width: "100%",
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  transition: "border-color 0.15s",
};

const sizeStyles: Record<"sm" | "md", CSSProperties> = {
  sm: { fontSize: "var(--text-xs)", padding: "3px 8px", height: 24 },
  md: { fontSize: "var(--text-sm)", padding: "5px 10px", height: 30 },
};

export function Input({ size = "md", style, ...rest }: InputProps): JSX.Element {
  return (
    <input
      style={{ ...base, ...sizeStyles[size], ...style }}
      {...rest}
    />
  );
}
```

- [ ] **Step 9.5: Create index.ts barrel**

```ts
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export { Panel } from "./Panel";
export { StatusDot } from "./StatusDot";
export { Button } from "./Button";
export { Input } from "./Input";
```

---

## Task 10: Final build check

**Files:** none (verification only)

- [ ] **Step 10.1: Clean compiled artifacts (prevent ts-node conflict)**

```bash
find /home/frank/tf-platform/TF-client/src/packages/theme/src \
  \( -name "*.js" -o -name "*.d.ts" \) \
  -not -path "*/node_modules/*" -delete && echo "Cleaned"
```

- [ ] **Step 10.2: Run dev build**

```bash
cd /home/frank/tf-platform/TF-client/src && yarn web:build:dev 2>&1 | tail -30
```

Expected: `compiled successfully` with no missing module errors.

- [ ] **Step 10.3: Run dev server**

```bash
cd /home/frank/tf-platform/TF-client/src && yarn web:serve
```

Open `http://localhost:8080`.

- [ ] **Step 10.4: Verify in browser DevTools**

Check the following:

1. **No FOUC**: Page loads with dark background immediately (not white flash). The `#loading-styles` block sets `body { background: #0b0d10 }` before any JS runs.

2. **`data-theme` attribute**: Open DevTools → Elements → `<html>` tag. Confirm `data-theme="dark"` is present.

3. **Tokens resolve**: In DevTools → Elements → select `<html>` → Computed. Search for `--color-bg-page`. Confirm it shows `#0b0d10`.

4. **Gazebo panel tokens**: In DevTools → Elements → find any Gazebo component div. Computed tab → `background-color` should resolve from a CSS variable (not a hardcoded hex).

5. **Scrollbar**: Page scrollbars should be thin and dark.

6. **Selection**: Select any text. Highlight should be dark blue (accent-muted), not the browser default.

7. **Focus rings**: Tab through the UI. Interactive elements should show a blue `2px` outline.

---

## Semantic Mapping Notes

| Situation | Token used | Rationale |
|---|---|---|
| Orange active tab border (`#f97316`) → blue | `--color-accent` | Active state = primary accent |
| Orange "spawn entity" link (`#fb923c`) → blue | `--color-accent` | CTA/interactive = accent |
| Orange toolbar ibActive (`#f97316`) → blue | `--color-accent` | Active button = accent |
| Cyan telemetry values (`#22d3ee`) | `--color-info` | Sensor/telemetry data = info |
| Green connected dot (`#22c55e`) | `--color-success` | Connection status = success |
| Red disconnected (`#ef4444`) | `--color-danger` | Connection error = danger |
| Orange diagonal matrix cells (`#f97316`) | `--color-accent` | Highlighted data cells = accent |
| Material color swatches in RightPanel | left as-is | These display 3D object colors, not UI theme |
| TAG_COLORS in LeftPanel (`#22d3ee`, `#22c55e`) | left as-is | These are entity-type semantic colors in the 3D world, not UI theme |
| FOUC bg updated from `#15151a` → `#0b0d10` | — | New token value replaces old MUI palette default |

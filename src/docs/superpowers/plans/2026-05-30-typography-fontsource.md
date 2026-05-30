# Typography Migration: Self-hosted Fontsource Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manually bundled Inter + IBM Plex Mono woff2 files with self-hosted @fontsource packages (Inter Variable + JetBrains Mono), add CSS variables for the type scale, and wire hardcoded font strings in Gazebo components to the MUI theme.

**Architecture:** The project is a Webpack monorepo (`yarn workspaces`). Fonts are loaded in `CssBaseline.tsx` via CSS `@font-face` imports; Webpack's `asset/inline` rule base64-inlines woff2 files. Two chart Web Workers load the monospace font programmatically via the `FontFace` API. The MUI theme in `packages/theme` exposes `fontSansSerif` / `fontMonospace` constants used across the codebase. No Tailwind — skipping that step.

**Tech Stack:** React 18, MUI 5, tss-react/mui, Webpack 5, TypeScript 5, yarn workspaces

---

## File Map

| Action  | Path |
|---------|------|
| Modify  | `packages/studio-base/package.json` |
| Create  | `packages/studio-base/src/styles/globals.css` |
| Modify  | `packages/studio-base/src/components/CssBaseline.tsx` |
| Modify  | `packages/theme/src/typography.ts` |
| Modify  | `packages/studio-base/src/panels/Plot/ChartRenderer.worker.ts` |
| Modify  | `packages/studio-base/src/components/Chart/worker/ChartJsMux.ts` |
| Modify  | `packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx` |
| Modify  | `packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx` |
| Modify  | `packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx` |
| Delete  | `packages/studio-base/src/styles/assets/inter.css` |
| Delete  | `packages/studio-base/src/styles/assets/plex-mono.css` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-Regular.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-Medium.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-SemiBold.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-Italic.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-MediumItalic.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/Inter-SemiBoldItalic.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/PlexMono.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/PlexMono-Bold.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/PlexMono-Italic.woff2` |
| Delete  | `packages/studio-base/src/styles/assets/PlexMono-BoldItalic.woff2` |

---

## Task 1: Install @fontsource packages

**Files:**
- Modify: `packages/studio-base/package.json`

- [ ] **Step 1.1: Add fontsource packages to studio-base dependencies**

Open `packages/studio-base/package.json`. In the `"dependencies"` object, add the two fontsource packages:

```json
{
  "dependencies": {
    "@fontsource-variable/inter": "^5.0.0",
    "@fontsource/jetbrains-mono": "^5.0.0",
    "@tf/sql.js": "npm:@foxglove/sql.js@0.0.4",
    "gzweb": "file:../../../lib",
    "three-nebula": "10.0.3"
  }
}
```

- [ ] **Step 1.2: Install packages from the workspace root**

Run from `/home/frank/tf-platform/TF-client/src/`:

```bash
yarn install
```

Expected: Yarn resolves and downloads `@fontsource-variable/inter` and `@fontsource/jetbrains-mono` into `node_modules/`.

- [ ] **Step 1.3: Confirm woff2 files exist in the installed packages**

```bash
ls node_modules/@fontsource-variable/inter/files/ | head -5
ls node_modules/@fontsource/jetbrains-mono/files/ | grep "400-normal\|500-normal" | head -5
```

Expected output (names will vary slightly by package version, but you need to see woff2 entries):

```
inter-latin-wght-normal.woff2
...
jetbrains-mono-latin-400-normal.woff2
jetbrains-mono-latin-500-normal.woff2
```

> **NOTE:** Record the exact filenames. They are needed in Task 5 for the worker FontFace imports. The pattern is always `{font-name}-{subset}-{weight}-{style}.woff2`.

---

## Task 2: Create global CSS file

**Files:**
- Create: `packages/studio-base/src/styles/globals.css`

- [ ] **Step 2.1: Create `globals.css`**

Create the file `packages/studio-base/src/styles/globals.css` with this exact content:

```css
:root {
  --font-sans: 'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', Consolas, monospace;

  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;
}

html, body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, pre, kbd, samp, .mono {
  font-family: var(--font-mono);
  font-feature-settings: 'calt' 0;
}

.tabular,
.numeric,
td.num,
.telemetry-value {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2.2: Commit**

```bash
git add packages/studio-base/src/styles/globals.css
git commit -m "feat(typography): add globals.css with CSS variables and utility classes"
```

---

## Task 3: Update font imports in CssBaseline.tsx

**Files:**
- Modify: `packages/studio-base/src/components/CssBaseline.tsx`

**Context:** `CssBaseline.tsx` currently imports two hand-rolled font CSS files. We replace them with the fontsource equivalents and add `globals.css`.

- [ ] **Step 3.1: Replace font imports in `CssBaseline.tsx`**

Find this block (lines 10–11):

```ts
import "@tf/studio-base/styles/assets/inter.css";
import "@tf/studio-base/styles/assets/plex-mono.css";
```

Replace it with:

```ts
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@tf/studio-base/styles/globals.css";
```

The rest of the file is unchanged.

- [ ] **Step 3.2: Verify the build compiles**

Run from `/home/frank/tf-platform/TF-client/src/`:

```bash
yarn web:build:dev 2>&1 | tail -20
```

Expected: Build completes without errors. Warnings about unused modules are OK; errors about missing files are not.

- [ ] **Step 3.3: Commit**

```bash
git add packages/studio-base/src/components/CssBaseline.tsx
git commit -m "feat(typography): switch to @fontsource Inter Variable and JetBrains Mono"
```

---

## Task 4: Update font name constants in theme typography

**Files:**
- Modify: `packages/theme/src/typography.ts`

**Context:** Two exported constants drive every font reference in the MUI theme and all components that import from `@tf/theme`. The existing comment explains why fallback fonts are avoided in the monospace stack (Chrome/Chromium worker crash bug). We keep that constraint for `fontMonospace` but can use a descriptive name; for `fontSansSerif` the variable-font name changes.

- [ ] **Step 4.1: Update `fontSansSerif` and `fontMonospace`**

Current lines 26–27:

```ts
export const fontSansSerif = "'Inter'";
export const fontMonospace = "'IBM Plex Mono'";
```

Replace with:

```ts
export const fontSansSerif = "'Inter Variable', 'Inter'";
export const fontMonospace = "'JetBrains Mono'";
```

> **Why keep `'Inter'` fallback in fontSansSerif?** Fontsource loads `Inter Variable` under that name; `Inter` is the original static-weight name used in this project. If the variable font somehow fails, `Inter` is the next in line and is already a known quantity. The sans-serif stack does NOT flow through workers (only fontMonospace does), so the fallback does not trigger the Chrome crash.
>
> **Why keep fontMonospace without fallbacks?** The comment at line 22 in the original file explains a real Chrome/Chromium crash on Windows caused by workers accessing fallback fonts before they load. Keep just the single name.

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
yarn build:packages 2>&1 | tail -20
```

Expected: No TS errors related to typography.

- [ ] **Step 4.3: Commit**

```bash
git add packages/theme/src/typography.ts
git commit -m "feat(typography): rename fontMonospace to JetBrains Mono, fontSansSerif to Inter Variable"
```

---

## Task 5: Update chart worker font loading

**Files:**
- Modify: `packages/studio-base/src/panels/Plot/ChartRenderer.worker.ts`
- Modify: `packages/studio-base/src/components/Chart/worker/ChartJsMux.ts`

**Context:** Both workers load the monospace font at runtime using the `FontFace` API so that chart labels render correctly in an off-screen canvas context. They currently import `PlexMono.woff2` from the assets folder and create a `FontFace("IBM Plex Mono", ...)`. We update them to import from `@fontsource/jetbrains-mono`.

> **Before this step:** Confirm the exact path from Task 1.3. It should be `@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`. If the filename is different, adjust accordingly.

- [ ] **Step 5.1: Update `ChartRenderer.worker.ts`**

File: `packages/studio-base/src/panels/Plot/ChartRenderer.worker.ts`

Find line 21:

```ts
import PlexMono from "@tf/studio-base/styles/assets/PlexMono.woff2";
```

Replace with:

```ts
import JetBrainsMono from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
```

Find line 45 (the FontFace constructor):

```ts
  const fontFace = new FontFace("IBM Plex Mono", await (await fetch(PlexMono)).arrayBuffer());
```

Replace with:

```ts
  const fontFace = new FontFace("JetBrains Mono", await (await fetch(JetBrainsMono)).arrayBuffer());
```

- [ ] **Step 5.2: Update `ChartJsMux.ts`**

File: `packages/studio-base/src/components/Chart/worker/ChartJsMux.ts`

Find line 34:

```ts
import PlexMono from "@tf/studio-base/styles/assets/PlexMono.woff2";
```

Replace with:

```ts
import JetBrainsMono from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
```

Find line 65 (the FontFace constructor):

```ts
  const fontFace = new FontFace("IBM Plex Mono", await (await fetch(PlexMono)).arrayBuffer());
```

Replace with:

```ts
  const fontFace = new FontFace("JetBrains Mono", await (await fetch(JetBrainsMono)).arrayBuffer());
```

- [ ] **Step 5.3: Verify TypeScript compiles**

```bash
yarn build:packages 2>&1 | tail -20
```

Expected: No TS errors.

- [ ] **Step 5.4: Commit**

```bash
git add \
  packages/studio-base/src/panels/Plot/ChartRenderer.worker.ts \
  packages/studio-base/src/components/Chart/worker/ChartJsMux.ts
git commit -m "feat(typography): update chart workers to load JetBrains Mono font"
```

---

## Task 6: Fix hardcoded font-family in Gazebo components

**Files:**
- Modify: `packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx`
- Modify: `packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx`
- Modify: `packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx`

**Context:** These three components already hardcode `'JetBrains Mono', monospace` — they were authored for the target font but the font was never properly installed. Now that the font is installed via fontsource, they will work as-is. However, the hardcoded string bypasses the MUI theme, making future font changes fragile. Update each to receive `typography` from the theme.

The `makeStyles` callbacks in these files currently ignore the theme argument: `makeStyles()(() => ({`. Change to `makeStyles()(({ typography }) => ({` and replace each hardcoded occurrence.

- [ ] **Step 6.1: Update `LeftPanel.tsx`**

**Change 1** — `makeStyles` callback signature (line 14):

```ts
// Before:
const useStyles = makeStyles()(() => ({
// After:
const useStyles = makeStyles()(({ typography }) => ({
```

**Change 2** — Replace all four `fontFamily: "'JetBrains Mono', monospace"` occurrences in the styles object. There are four instances: `root`, `tab`, `resSearch`, `resTab`. Replace each with:

```ts
fontFamily: typography.fontMonospace,
```

- [ ] **Step 6.2: Update `RightPanel.tsx`**

Same pattern as LeftPanel. There are two occurrences.

**Change 1** — `makeStyles` callback signature:

```ts
// Before:
const useStyles = makeStyles()(() => ({
// After:
const useStyles = makeStyles()(({ typography }) => ({
```

**Change 2** — Replace both `fontFamily: "'JetBrains Mono', monospace"` occurrences with:

```ts
fontFamily: typography.fontMonospace,
```

- [ ] **Step 6.3: Update `StatusBar.tsx`**

Same pattern. One occurrence.

**Change 1** — `makeStyles` callback signature:

```ts
// Before:
const useStyles = makeStyles()(() => ({
// After:
const useStyles = makeStyles()(({ typography }) => ({
```

**Change 2** — Replace the one `fontFamily: "'JetBrains Mono', monospace"` with:

```ts
fontFamily: typography.fontMonospace,
```

- [ ] **Step 6.4: Verify TypeScript compiles**

```bash
yarn build:packages 2>&1 | tail -20
```

Expected: No errors.

- [ ] **Step 6.5: Commit**

```bash
git add \
  packages/studio-base/src/panels/Gazebo/components/LeftPanel.tsx \
  packages/studio-base/src/panels/Gazebo/components/RightPanel.tsx \
  packages/studio-base/src/panels/Gazebo/components/StatusBar.tsx
git commit -m "refactor(gazebo): wire font-family to theme.typography.fontMonospace"
```

---

## Task 7: Delete orphaned font assets

**Files:**
- Delete: everything in `packages/studio-base/src/styles/assets/`

**Context:** Now that all imports have been redirected to the fontsource packages, the hand-rolled CSS and woff2 files are dead code. Remove them to avoid confusion.

- [ ] **Step 7.1: Confirm no remaining imports**

```bash
grep -r "styles/assets/inter\|styles/assets/plex-mono\|styles/assets/PlexMono\|styles/assets/Inter" \
  packages/ --include="*.ts" --include="*.tsx" --include="*.css" | grep -v node_modules
```

Expected: No output. If any file still references these assets, fix it before deleting.

- [ ] **Step 7.2: Delete the old CSS and woff2 files**

```bash
rm packages/studio-base/src/styles/assets/inter.css
rm packages/studio-base/src/styles/assets/plex-mono.css
rm packages/studio-base/src/styles/assets/Inter-Regular.woff2
rm packages/studio-base/src/styles/assets/Inter-Medium.woff2
rm packages/studio-base/src/styles/assets/Inter-SemiBold.woff2
rm packages/studio-base/src/styles/assets/Inter-Italic.woff2
rm packages/studio-base/src/styles/assets/Inter-MediumItalic.woff2
rm packages/studio-base/src/styles/assets/Inter-SemiBoldItalic.woff2
rm packages/studio-base/src/styles/assets/PlexMono.woff2
rm packages/studio-base/src/styles/assets/PlexMono-Bold.woff2
rm packages/studio-base/src/styles/assets/PlexMono-Italic.woff2
rm packages/studio-base/src/styles/assets/PlexMono-BoldItalic.woff2
```

Check if the directory is now empty:

```bash
ls packages/studio-base/src/styles/assets/
```

Expected: `ls: cannot access '...': No such file or directory` or an empty listing. If there are other files (not related to fonts), leave them.

- [ ] **Step 7.3: Final build check**

```bash
yarn web:build:dev 2>&1 | tail -30
```

Expected: Clean build, no errors.

- [ ] **Step 7.4: Commit**

```bash
git add -A packages/studio-base/src/styles/assets/
git commit -m "chore(typography): remove hand-rolled Inter and IBM Plex Mono font assets"
```

---

## Task 8: Verify in browser

- [ ] **Step 8.1: Start the dev server**

```bash
yarn web:serve
```

Open `http://localhost:8080` in Chromium/Chrome.

- [ ] **Step 8.2: Verify Inter Variable is rendering**

Open DevTools → select any text element (e.g., a panel title) → Computed tab → scroll to `font-family`. Expected value contains `Inter Variable`.

- [ ] **Step 8.3: Verify JetBrains Mono is rendering**

Open a panel that renders monospace content (Log panel, Raw Messages, or any JSON display). In DevTools → Computed → `font-family` should show `JetBrains Mono`.

- [ ] **Step 8.4: Verify no FOUT (Flash of Unstyled Text)**

Reload the page. The `waitForFonts()` call in `packages/studio-web/src/index.tsx` blocks rendering until all fonts resolve. There should be no visible font-swap flash after the app renders.

- [ ] **Step 8.5: Verify numeric tables don't jitter**

Open the Plot panel or a telemetry view with rapidly updating values. Numbers should not shift width when digits change (tabular numerals are set in `fontFeatureSettings` via `'tnum'` in `packages/theme/src/typography.ts`).

---

## Summary of hardcoded font issues found

| Location | Issue | Resolution |
|----------|-------|------------|
| `Gazebo/LeftPanel.tsx` (4×) | `'JetBrains Mono', monospace` hardcoded | Wired to `typography.fontMonospace` in Task 6 |
| `Gazebo/RightPanel.tsx` (2×) | `'JetBrains Mono', monospace` hardcoded | Wired to `typography.fontMonospace` in Task 6 |
| `Gazebo/StatusBar.tsx` (1×) | `'JetBrains Mono', monospace` hardcoded | Wired to `typography.fontMonospace` in Task 6 |
| `ChartRenderer.worker.ts` | `FontFace("IBM Plex Mono", ...)` | Updated to JetBrains Mono in Task 5 |
| `ChartJsMux.ts` | `FontFace("IBM Plex Mono", ...)` | Updated to JetBrains Mono in Task 5 |
| `panels/TopicGraph/index.tsx` | `font-size: 16px` (×4) | **Not migrated** — these are cytoscape graph node sizes, not body copy. The value is intentional (graph readability), not a legacy default. Leave as-is. |

> All other `fontMonospace` / `fontSansSerif` usages in the codebase go through `theme.typography.*` and will automatically pick up the new names after Task 4.

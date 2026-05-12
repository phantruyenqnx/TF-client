// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Screen-level entry points for TF Studio (web).
//
// Per phase1.md §11.6 and locked decision M0-DECISIONS #4, screens that
// run *before* the cockpit (Welcome / Project Picker, Create Project,
// Import Project, Session Config, Starting Services) live here under
// packages/studio-web/src/screens/.
//
// Phase 1 milestones add real implementations:
//   - M3-FE-1   Welcome / Project Picker
//   - M3-FE-1b  Import Project dialog
//   - M3-FE-2   Create Project
//   - M3-FE-3   Session Config
//   - M3-FE-4   Starting Services
//
// This barrel re-exports placeholder skeletons only; nothing is wired
// into WebRoot.tsx yet.

export { Welcome } from "./Welcome";
export { CreateProject } from "./CreateProject";
export { SessionConfig } from "./SessionConfig";

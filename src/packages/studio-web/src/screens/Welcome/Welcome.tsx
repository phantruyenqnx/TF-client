// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Welcome / Project Picker — placeholder skeleton.
//
// The real implementation lands in M3-FE-1 (see tasks.md) and is specified
// in phase1.md §11.6: lists registered projects with status badges
// (`ok` / `path_missing`), exposes Open / Create / Import actions, and
// inline Re-point / Remove for missing paths.
//
// This file exists now so future PRs have a stable target path. It is NOT
// wired into WebRoot.tsx yet.

export function Welcome(): JSX.Element {
  return <div data-testid="tf-welcome-placeholder">TF Studio — Welcome (placeholder)</div>;
}

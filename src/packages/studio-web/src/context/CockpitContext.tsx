// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// CockpitContext exposes the active project + session ids and the
// route-back callbacks (Stop / Restart) to anything rendered inside
// the cockpit subtree — in particular the TF top bar embedded in the
// Foxglove AppBar slot.
//
// The context is intentionally optional: TFShell reads it with a
// plain useContext and renders gracefully when the value is
// undefined (e.g. in unit tests or storybook stories that mount
// AppBarComponent in isolation).

import { createContext, useContext } from "react";

export type CockpitContextValue = {
  /** Registry id of the project owning the active session. */
  projectId: string;
  /** Active session id (from POST /sessions response). */
  sessionId: string;
  /** Stops the active session and returns to Welcome. */
  onStop: () => void;
  /** Called once POST /sessions/{id}/restart returns 201 with the
   * new session id. The parent (WebRoot) routes to the Starting
   * Services screen so the user can watch the new services come up. */
  onRestart: (newSessionId: string) => void;
};

const CockpitContext = createContext<CockpitContextValue | undefined>(undefined);
CockpitContext.displayName = "CockpitContext";

export function useCockpit(): CockpitContextValue | undefined {
  return useContext(CockpitContext);
}

export default CockpitContext;

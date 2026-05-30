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

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

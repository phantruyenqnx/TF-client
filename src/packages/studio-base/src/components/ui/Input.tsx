// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { InputHTMLAttributes, CSSProperties } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  inputSize?: "sm" | "md";
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

export function Input({ inputSize = "md", style, ...rest }: InputProps): JSX.Element {
  return (
    <input
      style={{ ...base, ...sizeStyles[inputSize], ...style }}
      {...rest}
    />
  );
}

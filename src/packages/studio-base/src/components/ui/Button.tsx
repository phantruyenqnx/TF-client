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

// status-badge (DESIGN.md): píldora pequeña (11 px) sobre una miniatura.
// Neutra ("En cola", "Recortando"): blanca con borde hairline. Error: negra con texto blanco.
import type { ReactNode } from "react";
import { cx } from "./cx";

export type StatusBadgeProps = {
  tone?: "neutral" | "error";
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-block max-w-full truncate rounded-pill px-xs py-[3px] text-[11px] leading-[1.2]",
        tone === "neutral" ? "border border-hairline bg-canvas text-ink" : "bg-ink text-on-dark",
        className,
      )}
    >
      {children}
    </span>
  );
}

// transparency-checker (DESIGN.md): fondo que delata la transparencia.
// - `checker`: damero de 16 px (#ececec / blanco) para recortes con transparencia.
// - `photo`: fondo liso photo-backdrop (#d9d4cc) para fotos que conservan su fondo.
import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export type TransparencyCheckerProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "checker" | "photo";
};

// Cuadros de 8 px en una tesela de 16 px, con los colores de tokens.css.
const checkerStyle = {
  backgroundColor: "var(--color-canvas)",
  backgroundImage:
    "conic-gradient(var(--color-checker) 25%, var(--color-canvas) 0 50%, var(--color-checker) 0 75%, var(--color-canvas) 0)",
  backgroundSize: "16px 16px",
};

export function TransparencyChecker({
  variant = "checker",
  className,
  style,
  ...props
}: TransparencyCheckerProps) {
  return (
    <div
      className={cx(variant === "photo" && "bg-photo-backdrop", className)}
      style={variant === "checker" ? { ...checkerStyle, ...style } : style}
      {...props}
    />
  );
}

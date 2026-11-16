// Botón base (DESIGN.md › Buttons). El estado activo (scale 0.95) y el foco
// (contorno negro de 2 px) son globales, en globals.css.
import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant =
  "primary" | "secondary" | "dark-utility" | "destructive" | "icon-circular" | "text-link";

/** Fondo del botón circular: translúcido sobre foto o gris claro sobre blanco. */
export type IconSurface = "photo" | "plain";

const base =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-xs select-none " +
  "disabled:cursor-not-allowed disabled:opacity-40";

// Todas las variantes llegan a 44 px de alto como mínimo (Touch Targets).
const variants: Record<ButtonVariant, string> = {
  // Rosa solo como fondo, texto negro.
  primary: "min-h-11 rounded-pill bg-primary px-[22px] text-body text-on-primary",
  secondary: "min-h-11 rounded-pill border border-ink bg-transparent px-[21px] text-body text-ink",
  "dark-utility": "min-h-11 rounded-sm bg-ink px-[15px] text-button-utility text-on-dark",
  // Acción destructiva de los diálogos: píldora negra.
  destructive: "min-h-11 rounded-pill bg-ink px-[22px] text-body text-on-dark",
  "icon-circular": "size-11 rounded-full text-ink",
  "text-link": "min-h-11 text-body text-ink underline underline-offset-2",
};

const iconSurfaces: Record<IconSurface, string> = {
  photo: "bg-surface-chip-translucent/64",
  plain: "bg-canvas-parchment",
};

/** Clases de un botón, para reutilizarlas en enlaces (<Link>) con aspecto de botón. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  options: { fullWidth?: boolean; iconSurface?: IconSurface; className?: string } = {},
): string {
  return cx(
    base,
    variants[variant],
    variant === "icon-circular" && iconSurfaces[options.iconSurface ?? "photo"],
    options.fullWidth && "w-full",
    options.className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** Solo para `icon-circular`. */
  iconSurface?: IconSurface;
};

/**
 * `icon-circular` no tiene texto visible: pasa siempre `aria-label`.
 */
export function Button({
  variant = "primary",
  fullWidth,
  iconSurface,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, { fullWidth, iconSurface, className })}
      {...props}
    />
  );
}

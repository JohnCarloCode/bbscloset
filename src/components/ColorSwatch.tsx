// Circulito de color de una familia (filtro del catálogo, chips activos y,
// más adelante, el selector de color de la prenda). El fondo es un dato del
// dominio (COLOR_SWATCHES / multicolorGradient), no un token: va inline.
// Decorativo: el nombre de la familia va siempre en texto al lado.
import { colorSwatchBackground, type ColorFamilyId } from "@/lib/domain/colors";
import { cx } from "./cx";

export type ColorSwatchProps = {
  family: ColorFamilyId;
  /** Diámetro en px (14 por defecto). */
  size?: number;
  className?: string;
};

export function ColorSwatch({ family, size = 14, className }: ColorSwatchProps) {
  return (
    <span
      aria-hidden
      // Borde fino para que el blanco se distinga del fondo.
      className={cx("inline-block shrink-0 rounded-full border border-hairline", className)}
      style={{ width: size, height: size, background: colorSwatchBackground(family) }}
    />
  );
}

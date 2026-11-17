// Familias de color: lista cerrada (spec 2.3, database.md 3). Igual que la
// restricción de garments.color_family (supabase/migrations/0002). Nombres
// visibles en src/messages (clave `colors.<id>`). La familia de un hex la
// calcula src/lib/imaging/colorFamily.ts; "multicolor" solo se elige a mano.

export const COLOR_FAMILY_IDS = [
  "black",
  "white",
  "gray",
  "beige",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "multicolor",
] as const;

export type ColorFamilyId = (typeof COLOR_FAMILY_IDS)[number];

/** Familias que se pueden deducir de un hex (todas menos multicolor). */
export type SolidColorFamilyId = Exclude<ColorFamilyId, "multicolor">;

// Muestra de cada familia (el circulito de color del filtro y del selector).
// Son DATOS del dominio, no estilos de la interfaz: representan el color de la
// prenda, no cambian con el tema y no deben salir de tokens.css. Por eso viven
// aquí y son la excepción a la regla de "ningún hex suelto fuera de tokens.css"
// (plan 7.5): el grep de esa comprobación debe excluir este archivo.
// Multicolor no tiene un hex: la UI la pinta con un degradado de las demás
// muestras (ver multicolorGradient).
export const COLOR_SWATCHES: Record<SolidColorFamilyId, string> = {
  black: "#111111",
  white: "#ffffff",
  gray: "#9a9a9a",
  beige: "#e3d3b4",
  brown: "#8b5a2b",
  red: "#d32f2f",
  orange: "#f57c00",
  yellow: "#fbc02d",
  green: "#388e3c",
  blue: "#1e63c4",
  purple: "#7b3fa0",
  pink: "#f48fb1",
};

/** Degradado cónico para la muestra de "multicolor", hecho con las muestras cromáticas. */
export function multicolorGradient(): string {
  const hues: SolidColorFamilyId[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];
  return `conic-gradient(${[...hues, "red" as const].map((f) => COLOR_SWATCHES[f]).join(", ")})`;
}

/** Fondo CSS de la muestra de una familia: su hex o, en multicolor, el degradado. */
export function colorSwatchBackground(family: ColorFamilyId): string {
  return family === "multicolor" ? multicolorGradient() : COLOR_SWATCHES[family];
}

export function isColorFamilyId(value: unknown): value is ColorFamilyId {
  return typeof value === "string" && (COLOR_FAMILY_IDS as readonly string[]).includes(value);
}

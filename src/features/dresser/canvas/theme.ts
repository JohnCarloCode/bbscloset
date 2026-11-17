// Colores y sombra del lienzo leídos de los tokens CSS (src/styles/tokens.css)
// en tiempo de ejecución: Konva pinta en <canvas> y necesita strings, pero los
// valores siguen viviendo solo en los tokens. Para que Tailwind emita estas
// variables, OutfitCanvas usa las clases que las referencian
// (bg-canvas-parchment, text-ink, bg-primary, drop-shadow-product).

export type ProductShadow = { color: string; blur: number; offsetX: number; offsetY: number };

export type CanvasTheme = {
  background: string;
  ink: string;
  primary: string;
  shadow: ProductShadow | null;
};

/** Radio de las esquinas del lienzo: {rounded.lg} de DESIGN.md (18 px). */
export const CANVAS_RADIUS_VAR = "--radius-lg";

/**
 * Interpreta un drop-shadow CSS ("3px 5px 30px rgba(0,0,0,.22)", con el color
 * delante o detrás, o envuelto en drop-shadow(...)). null si no se entiende.
 */
export function parseDropShadow(value: string): ProductShadow | null {
  let v = value.trim();
  const wrapped = /^drop-shadow\(([\s\S]*)\)$/.exec(v);
  if (wrapped) v = wrapped[1].trim();
  if (!v || v === "none") return null;

  // Separa por espacios fuera de paréntesis.
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of v) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) parts.push(cur);

  const lengths: number[] = [];
  let color: string | null = null;
  for (const p of parts) {
    const m = /^(-?\d*\.?\d+)(px)?$/.exec(p);
    if (m) lengths.push(parseFloat(m[1]));
    else if (color === null) color = p;
    else return null;
  }
  if (color === null || lengths.length < 2 || lengths.length > 3) return null;
  return { color, offsetX: lengths[0], offsetY: lengths[1], blur: lengths[2] ?? 0 };
}

function cssVar(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/** Lee el tema del documento (solo en el navegador). */
export function readCanvasTheme(root: Element = document.documentElement): CanvasTheme {
  const style = getComputedStyle(root);
  return {
    background: cssVar(style, "--color-canvas-parchment"),
    ink: cssVar(style, "--color-ink"),
    primary: cssVar(style, "--color-primary"),
    shadow: parseDropShadow(cssVar(style, "--drop-shadow-product")),
  };
}

/** Radio de las esquinas en px (18 si la variable no se puede leer). */
export function readCanvasRadius(root: Element = document.documentElement): number {
  const n = parseFloat(getComputedStyle(root).getPropertyValue(CANVAS_RADIUS_VAR));
  return Number.isFinite(n) ? n : 18;
}

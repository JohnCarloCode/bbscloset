// Hex → familia de color más cercana (spec 2.3, plan 3.1).
// Se trabaja en OKLab, un espacio perceptual: las distancias se parecen a lo
// que el ojo ve como "parecido". Primero se separan los acromáticos (poca
// croma → negro, gris o blanco según la luminosidad); el resto va a la familia
// con la referencia más cercana. "multicolor" nunca sale de aquí: se elige a
// mano en el selector (decisión 2 del plan).
import type { SolidColorFamilyId } from "@/lib/domain/colors";

type ChromaticFamily = Exclude<SolidColorFamilyId, "black" | "white" | "gray">;

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/**
 * Normaliza un hex al formato de la BD (`#aabbcc`, minúsculas). Acepta
 * `#abc`, `ABCDEF`… Devuelve null si no es un hex válido.
 */
export function normalizeHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${digits.toLowerCase()}`;
}

type Oklab = { L: number; a: number; b: number };

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** sRGB (`#aabbcc` ya normalizado) → OKLab (Björn Ottosson, 2020). */
function hexToOklab(hex: string): Oklab {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363015827 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995567 * g + 0.1073969054 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

// Por debajo de esta croma (√(a²+b²)) el color se considera acromático. En
// tonos oscuros el tinte se ve menos, así que el umbral es algo mayor
// (un gris marengo azulado sigue siendo gris).
const ACHROMATIC_CHROMA_LIGHT = 0.02;
const ACHROMATIC_CHROMA_DARK = 0.03;
const DARK_L = 0.5;
// Umbrales de luminosidad OKLab para negro / blanco entre los acromáticos.
const BLACK_MAX_L = 0.3;
const WHITE_MIN_L = 0.93;
// Muy oscuro: negro aunque tenga algo de tinte (un azul marino casi negro sí es azul).
const ALWAYS_BLACK_L = 0.25;
const ALWAYS_BLACK_CHROMA = 0.05;
// Peso de la luminosidad en la distancia: menor que el del tono para que un
// color oscuro no caiga en marrón solo por ser oscuro.
const L_WEIGHT = 0.5;

// Referencias de cada familia cromática (varias por familia para cubrir
// tonos claros, oscuros y apagados). Son datos de cálculo, no estilos.
const REFERENCES: Record<ChromaticFamily, string[]> = {
  beige: ["#f5f5dc", "#f5deb3", "#e8d8c4", "#d2b48c", "#c8b28e", "#efe6d2"],
  brown: ["#8b4513", "#a0522d", "#5c4033", "#6f4e37", "#d2691e", "#3e2723", "#a67b5b"],
  red: ["#ff0000", "#d32f2f", "#b22222", "#8b0000", "#800020", "#dc143c"],
  orange: ["#ff8c00", "#ffa500", "#f57c00", "#cc5500", "#ff7f50", "#ffb27a"],
  yellow: ["#ffff00", "#ffd700", "#fbc02d", "#fff59d", "#e1ad01", "#f0e68c"],
  green: [
    "#008000",
    "#00ff00",
    "#388e3c",
    "#556b2f",
    "#98fb98",
    "#2e8b57",
    "#006400",
    "#808000",
    "#1b4d3e",
  ],
  blue: [
    "#0000ff",
    "#1e3a8a",
    "#000080",
    "#4169e1",
    "#87ceeb",
    "#add8e6",
    "#4682b4",
    "#008b8b",
    "#004953",
  ],
  purple: ["#800080", "#8a2be2", "#4b0082", "#9370db", "#e6e6fa", "#dda0dd", "#5b2a6e"],
  pink: ["#ffc0cb", "#ffb6c1", "#ff69b4", "#f0d7d7", "#c71585", "#ff1493", "#e8a0b0"],
};

const REFERENCE_LABS = Object.entries(REFERENCES).flatMap(([family, hexes]) =>
  hexes.map((hex) => ({ family: family as ChromaticFamily, lab: hexToOklab(hex) })),
);

/**
 * Familia de color más cercana a un hex. Nunca devuelve "multicolor".
 * Devuelve null si el hex no es válido.
 */
export function colorFamily(input: string): SolidColorFamilyId | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  const { L, a, b } = hexToOklab(hex);
  const chroma = Math.hypot(a, b);

  if (L < ALWAYS_BLACK_L && chroma < ALWAYS_BLACK_CHROMA) return "black";
  if (chroma < (L < DARK_L ? ACHROMATIC_CHROMA_DARK : ACHROMATIC_CHROMA_LIGHT)) {
    if (L < BLACK_MAX_L) return "black";
    if (L > WHITE_MIN_L) return "white";
    return "gray";
  }

  let best: ChromaticFamily = "beige";
  let bestDist = Infinity;
  for (const ref of REFERENCE_LABS) {
    const d = (L_WEIGHT * (ref.lab.L - L)) ** 2 + (ref.lab.a - a) ** 2 + (ref.lab.b - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = ref.family;
    }
  }
  return best;
}

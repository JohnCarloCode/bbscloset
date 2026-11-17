// Detección de "ya recortada" (architecture.md 4.1 paso 1; screens.md 5.2):
// se muestrea el canal alfa en los bordes y en una rejilla interior.
import { context2d, createCanvas, decodeImage } from "./canvas";
import { fitWithin } from "./shrink";

/** Lo mínimo de ImageData que hace falta (así se prueba sin DOM). */
export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number };

/** Alfa por debajo de esto cuenta como transparente. */
const ALPHA_TRANSPARENT = 250;
/** Puntos por borde y lado de la rejilla interior. */
const SAMPLES_PER_EDGE = 32;
const GRID = 16;
/** Una prenda recortada deja casi todo el borde transparente; basta con la mitad. */
const MIN_BORDER_RATIO = 0.5;
/** Por si la prenda toca los bordes: huecos transparentes en el interior. */
const MIN_GRID_RATIO = 0.1;
/** Lado al que se reduce la imagen para muestrear (rápido y suficiente). */
const SAMPLE_SIDE = 256;

export type AlphaStats = { borderRatio: number; gridRatio: number };

/** Proporción de muestras transparentes en el borde y en la rejilla (pura). */
export function sampleAlpha({ data, width, height }: RgbaImage): AlphaStats {
  const transparent = (x: number, y: number) => data[(y * width + x) * 4 + 3] < ALPHA_TRANSPARENT;
  const at = (i: number, n: number, size: number) =>
    Math.min(size - 1, Math.floor(((i + 0.5) * size) / n));

  let border = 0;
  let borderTotal = 0;
  for (let i = 0; i < SAMPLES_PER_EDGE; i++) {
    const x = at(i, SAMPLES_PER_EDGE, width);
    const y = at(i, SAMPLES_PER_EDGE, height);
    for (const [px, py] of [
      [x, 0],
      [x, height - 1],
      [0, y],
      [width - 1, y],
    ]) {
      borderTotal++;
      if (transparent(px, py)) border++;
    }
  }

  let grid = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (transparent(at(gx, GRID, width), at(gy, GRID, height))) grid++;
    }
  }

  return { borderRatio: border / borderTotal, gridRatio: grid / (GRID * GRID) };
}

/** ¿Las muestras indican una imagen con fondo transparente? (pura) */
export function looksTransparent({ borderRatio, gridRatio }: AlphaStats): boolean {
  return borderRatio >= MIN_BORDER_RATIO || gridRatio >= MIN_GRID_RATIO;
}

// Formatos que nunca tienen alfa: no hace falta decodificar.
const OPAQUE_TYPES = new Set(["image/jpeg", "image/jpg", "image/heic", "image/heif", "image/bmp"]);

/**
 * Propone "ya recortada" si la imagen tiene fondo transparente. Si no se
 * puede decodificar, devuelve false (la validación ya avisa aparte).
 */
export async function hasTransparency(blob: Blob): Promise<boolean> {
  if (OPAQUE_TYPES.has(blob.type)) return false;
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(blob);
  } catch {
    return false;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, SAMPLE_SIDE);
    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas, true);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return looksTransparent(sampleAlpha(ctx.getImageData(0, 0, width, height)));
  } finally {
    bitmap.close();
  }
}

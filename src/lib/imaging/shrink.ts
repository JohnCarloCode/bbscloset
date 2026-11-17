// Reducción de la foto antes de recortar (architecture.md 4.1 paso 2): lado
// máximo ~1200 px, orientación EXIF aplicada y un único formato (PNG, que
// conserva la transparencia de las fotos "ya recortadas").
import { canvasToBlob, context2d, createCanvas, decodeImage } from "./canvas";
import { ImagingError } from "./errors";

/** Lado máximo de la foto que entra en la cola y del recorte final. */
export const MAX_SIDE = 1200;

/**
 * Dimensiones que caben en `maxSide` sin deformar y sin ampliar (pura).
 * Siempre ≥ 1 px.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const k = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  };
}

/**
 * Reduce la foto a `maxSide` px de lado máximo y la devuelve como PNG.
 * Se reescribe siempre (aunque ya sea pequeña) para hornear la orientación
 * EXIF y unificar el formato (HEIC, JPEG… → PNG).
 */
export async function shrink(file: Blob, maxSide = MAX_SIDE): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch (cause) {
    throw new ImagingError("decode_failed", { cause });
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await canvasToBlob(canvas, "image/png");
  } finally {
    bitmap.close();
  }
}

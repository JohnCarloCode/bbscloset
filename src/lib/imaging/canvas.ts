// Utilidades de lienzo compartidas por shrink, transparency y encode.
// OffscreenCanvas cuando existe (Chrome, Firefox, Safari ≥ 16.4); si no,
// un <canvas> normal (Safari viejo). Solo para el navegador.
import { ImagingError } from "./errors";

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const c = new OffscreenCanvas(width, height);
      // Safari 16.0–16.3 tiene OffscreenCanvas sin contexto 2d.
      if (c.getContext("2d")) return new OffscreenCanvas(width, height);
    } catch {
      // seguimos con <canvas>
    }
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function context2d(canvas: AnyCanvas, willReadFrequently = false): Ctx2D {
  const ctx = canvas.getContext("2d", { willReadFrequently }) as Ctx2D | null;
  if (!ctx) throw new ImagingError("encode_failed");
  return ctx;
}

/**
 * Codifica el lienzo. El navegador puede devolver otro formato si no sabe
 * codificar el pedido (Safari y WebP → PNG): mira siempre `blob.type`.
 */
export async function canvasToBlob(
  canvas: AnyCanvas,
  type: string,
  quality?: number,
): Promise<Blob> {
  try {
    if ("convertToBlob" in canvas) return await canvas.convertToBlob({ type, quality });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob) return blob;
  } catch (cause) {
    throw new ImagingError("encode_failed", { cause });
  }
  throw new ImagingError("encode_failed");
}

/**
 * Decodifica respetando la orientación EXIF. Si el navegador rechaza las
 * opciones (Safari viejo), reintenta sin ellas: la orientación ya es la de
 * la imagen por defecto en los navegadores actuales.
 */
export async function decodeImage(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch (err) {
    if (err instanceof TypeError) return await createImageBitmap(source);
    throw err;
  }
}

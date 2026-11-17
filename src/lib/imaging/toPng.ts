// Recodifica una imagen a PNG conservando la transparencia (recorte en lote,
// paso 3.13: el `cutout` de la cola puede ser WebP). Si ya es PNG, tal cual.
import { canvasToBlob, context2d, createCanvas, decodeImage } from "./canvas";
import { ImagingError } from "./errors";

export async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(blob);
  } catch (cause) {
    throw new ImagingError("encode_failed", { cause });
  }
  try {
    const canvas = createCanvas(bitmap.width, bitmap.height);
    context2d(canvas).drawImage(bitmap, 0, 0);
    const png = await canvasToBlob(canvas, "image/png");
    if (png.type !== "image/png") throw new ImagingError("encode_failed");
    return png;
  } finally {
    bitmap.close();
  }
}

// Recorte final y miniatura (architecture.md 4.1 paso 5).
// - Se quita el alfa vacío alrededor de la prenda (bounding box, sin contar el
//   ruido del recorte), para que el collage escale cada prenda por lo que
//   ocupa de verdad.
// - cutout: lado máx. 1200 px, con alfa; thumb: lado máx. 320 px.
// - WebP si el navegador sabe codificarlo. Safari no codifica WebP en canvas
//   (toBlob/convertToBlob devuelven PNG): entonces se usa PNG. Las rutas de
//   Storage siguen siendo cutout.webp / thumb.webp (database.md 6); al subir
//   hay que mandar `Content-Type: blob.type` (image/webp o image/png) y el
//   navegador lo muestra igual. El bucket no restringe tipos MIME.
import { canvasToBlob, context2d, createCanvas, decodeImage } from "./canvas";
import { ImagingError } from "./errors";
import { fitWithin, MAX_SIDE } from "./shrink";
import type { RgbaImage } from "./transparency";

export const THUMB_SIDE = 320;
const WEBP_QUALITY = 0.9;
/** Alfa por encima de esto cuenta como prenda (ignora el halo casi invisible). */
const ALPHA_VISIBLE = 8;

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Caja mínima con alfa > `threshold` dentro de `region` (pura). null si todo
 * es transparente.
 */
export function alphaBoundingBox(
  { data, width, height }: RgbaImage,
  threshold = ALPHA_VISIBLE,
  region: Box = { x: 0, y: 0, width, height },
): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = region.y; y < region.y + region.height; y++) {
    const row = y * width * 4;
    for (let x = region.x; x < region.x + region.width; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Celdas por lado (aprox.) para buscar la prenda. */
const CELLS_PER_SIDE = 64;
/** Una celda es "prenda" si al menos la mitad de sus píxeles son casi opacos. */
const SOLID_ALPHA = 128;
const SOLID_RATIO = 0.5;
/** Trozos sólidos menores que esto (frente al mayor) se tratan como ruido. */
const MIN_PART_RATIO = 0.1;

/**
 * Caja de la prenda ignorando el ruido (pura). El recorte de @imgly deja
 * motas sueltas y halos semitransparentes por todo el fondo (prueba del
 * 17-11 con pruebas-fotos/streetwear), así que la caja exacta del alfa casi
 * siempre es la imagen entera. Se buscan las zonas sólidas (celdas casi
 * opacas conectadas), se descartan las pequeñas, se amplía una celda y se
 * ajusta al alfa visible dentro de esa zona. Si no hay zonas sólidas (prenda
 * fina o semitransparente), cae a la caja exacta del alfa visible.
 */
export function garmentBoundingBox(img: RgbaImage): Box | null {
  const { data, width, height } = img;
  const cell = Math.max(4, Math.round(Math.max(width, height) / CELLS_PER_SIDE));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const solid = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x1 = Math.min(width, (cx + 1) * cell);
      const y1 = Math.min(height, (cy + 1) * cell);
      let opaque = 0;
      for (let y = cy * cell; y < y1; y++)
        for (let x = cx * cell; x < x1; x++)
          if (data[(y * width + x) * 4 + 3] > SOLID_ALPHA) opaque++;
      if (opaque >= SOLID_RATIO * (x1 - cx * cell) * (y1 - cy * cell)) solid[cy * cols + cx] = 1;
    }
  }

  // Trozos sólidos conectados (8 vecinos), con su caja en celdas.
  const parts: { size: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const seen = new Uint8Array(cols * rows);
  for (let start = 0; start < solid.length; start++) {
    if (!solid[start] || seen[start]) continue;
    const part = { size: 0, x0: cols, y0: rows, x1: -1, y1: -1 };
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const cx = i % cols;
      const cy = (i - cx) / cols;
      part.size++;
      part.x0 = Math.min(part.x0, cx);
      part.x1 = Math.max(part.x1, cx);
      part.y0 = Math.min(part.y0, cy);
      part.y1 = Math.max(part.y1, cy);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (solid[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
    }
    parts.push(part);
  }
  if (!parts.length) return alphaBoundingBox(img);

  const largest = Math.max(...parts.map((p) => p.size));
  const kept = parts.filter((p) => p.size >= MIN_PART_RATIO * largest);
  const x0 = Math.max(0, (Math.min(...kept.map((p) => p.x0)) - 1) * cell);
  const y0 = Math.max(0, (Math.min(...kept.map((p) => p.y0)) - 1) * cell);
  const x1 = Math.min(width, (Math.max(...kept.map((p) => p.x1)) + 2) * cell);
  const y1 = Math.min(height, (Math.max(...kept.map((p) => p.y1)) + 2) * cell);
  return alphaBoundingBox(img, ALPHA_VISIBLE, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}

export type EncodedImage = { blob: Blob; width: number; height: number };

export type CutoutAndThumb = {
  /** cutout.webp (o PNG en Safari: mira `blob.type`). */
  cutout: EncodedImage;
  thumb: EncodedImage;
  /** Dimensiones del cutout (las que se guardan en la prenda). */
  width: number;
  height: number;
};

async function encodeRegion(source: CanvasImageSource, box: Box, maxSide: number) {
  const { width, height } = fitWithin(box.width, box.height, maxSide);
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, width, height);
  let blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/png");
  return { blob, width, height };
}

/**
 * A partir del PNG recortado (o de la foto "ya recortada"), genera el
 * recorte y la miniatura sin márgenes transparentes.
 * Errores: decode_failed, empty_cutout (no queda nada visible), encode_failed.
 */
export async function toCutoutAndThumb(pngBlob: Blob): Promise<CutoutAndThumb> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(pngBlob);
  } catch (cause) {
    throw new ImagingError("decode_failed", { cause });
  }
  try {
    const full = createCanvas(bitmap.width, bitmap.height);
    const ctx = context2d(full, true);
    ctx.drawImage(bitmap, 0, 0);
    const box = garmentBoundingBox(ctx.getImageData(0, 0, bitmap.width, bitmap.height));
    if (!box) throw new ImagingError("empty_cutout");
    const cutout = await encodeRegion(full, box, MAX_SIDE);
    const thumb = await encodeRegion(full, box, THUMB_SIDE);
    return { cutout, thumb, width: cutout.width, height: cutout.height };
  } finally {
    bitmap.close();
  }
}

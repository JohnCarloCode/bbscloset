// Máscara de clic de un recorte: Konva detecta el clic con un "hit canvas"
// donde cada figura se pinta con su color clave. Por defecto una imagen es un
// rectángulo, así que una prenda tapaba las de debajo con su fondo
// transparente. Aquí se pinta solo la silueta (alfa > umbral) con el color
// clave del nodo, reducida para que sea barata (spec 6.1: clic sobre PNG con
// transparencia).

const MASK_MAX_SIDE = 256;
const ALPHA_THRESHOLD = 32;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Devuelve la máscara o null si no se puede leer la imagen (p. ej. sin CORS). */
export function buildAlphaMask(
  image: HTMLImageElement,
  colorKey: string,
): HTMLCanvasElement | null {
  const rgb = hexToRgb(colorKey);
  const w0 = image.naturalWidth;
  const h0 = image.naturalHeight;
  if (!rgb || !w0 || !h0) return null;
  const k = Math.min(1, MASK_MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return null; // canvas contaminado: se queda el rectángulo por defecto
  }
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const on = px[i + 3] > ALPHA_THRESHOLD;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

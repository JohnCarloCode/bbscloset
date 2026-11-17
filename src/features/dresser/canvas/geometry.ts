// Conversión entre las unidades del modelo (model.ts: x, y normalizados;
// scale = lado mayor / lado corto del lienzo) y los atributos en píxeles del
// nodo Konva. Funciones puras, con tests.
//
// El nodo se pinta con su tamaño real (width/height en px) y el origen en el
// centro (offset = mitad), así que x/y del nodo son el centro de la prenda y
// rota sobre sí misma. Durante un gesto Konva cambia scaleX/scaleY; al
// terminar se pasa al modelo y el nodo vuelve a escala 1.
import type { Transform } from "../model";

export type Size = { width: number; height: number };

export type NodeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

/** Límites de tamaño de una prenda (fracción del lado corto del lienzo). */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 2.5;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/** Ancho y alto en px de una prenda con `scale` y aspecto ancho/alto. */
export function garmentPixelSize(scale: number, aspect: number, size: Size) {
  const long = scale * Math.min(size.width, size.height);
  const a = safeAspect(aspect);
  return a >= 1 ? { width: long, height: long / a } : { width: long * a, height: long };
}

/** Atributos del nodo Konva para un item. */
export function nodeBox(t: Transform, aspect: number, size: Size): NodeBox {
  const { width, height } = garmentPixelSize(t.scale, aspect, size);
  return {
    x: t.x * size.width,
    y: t.y * size.height,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation: t.rotation,
  };
}

/** Normaliza grados a (-180, 180]. */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let r = deg % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r === 0 ? 0 : r; // sin -0
}

/**
 * Transformación del modelo a partir del nodo tras un gesto: posición en
 * px → normalizada; escala del nodo × escala anterior del item.
 */
export function transformFromNode(
  node: { x: number; y: number; scaleX: number; rotation: number },
  prevScale: number,
  size: Size,
): Transform {
  return {
    x: size.width > 0 ? node.x / size.width : 0.5,
    y: size.height > 0 ? node.y / size.height : 0.5,
    scale: clampScale(prevScale * Math.abs(node.scaleX)),
    rotation: normalizeRotation(node.rotation),
  };
}

/** Caja alineada con los ejes (px) de un item girado: para colocar el candado. */
export function rotatedBounds(t: Transform, aspect: number, size: Size) {
  const { width, height } = garmentPixelSize(t.scale, aspect, size);
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = width * cos + height * sin;
  const h = width * sin + height * cos;
  const cx = t.x * size.width;
  const cy = t.y * size.height;
  return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
}

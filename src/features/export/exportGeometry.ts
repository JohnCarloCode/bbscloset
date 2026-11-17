// Geometría de la exportación a imagen (spec 3.5, plan 6.1). Pura, con tests.
//
// 1. Cada item pasa a píxeles del lienzo de origen con las mismas funciones
//    que la pantalla (canvas/geometry.ts: nodeBox).
// 2. Se calcula la caja que envuelve todas las prendas, con las 4 esquinas
//    giradas de cada una.
// 3. Todo se reescala con un único factor `k`, sin recolocar, para que esa
//    caja quepa en el destino con un margen del 8 % del lado corto, y se
//    centra. Las posiciones relativas, la rotación y el orden no cambian.
import { paintOrder, type CanvasItem } from "@/features/dresser/model";
import { nodeBox, type NodeBox, type Size } from "@/features/dresser/canvas/geometry";

export type ExportRatio = "1:1" | "4:5" | "9:16";

/** Tamaños de salida (decisión 11, screens.md 9). */
export const EXPORT_SIZES: Record<ExportRatio, Size> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

/** Margen alrededor del conjunto, como fracción del lado corto del destino. */
export const EXPORT_MARGIN = 0.08;

export type Bounds = { left: number; top: number; right: number; bottom: number };

export type ExportNode = { garmentId: string; box: NodeBox };

export type ExportLayout = {
  width: number;
  height: number;
  /** Factor de escala origen → destino (también para la sombra). */
  scale: number;
  /** En orden de pintado (de atrás hacia delante). */
  nodes: ExportNode[];
};

export class EmptyCanvasError extends Error {
  constructor() {
    super("empty_canvas");
    this.name = "EmptyCanvasError";
  }
}

/** Caja alineada con los ejes de un nodo girado sobre su centro (4 esquinas). */
export function rotatedBox(box: NodeBox): Bounds {
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = box.width / 2;
  const hh = box.height / 2;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [dx, dy] of [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ]) {
    const x = box.x + dx * cos - dy * sin;
    const y = box.y + dx * sin + dy * cos;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

export function unionBounds(list: Bounds[]): Bounds {
  return list.reduce((a, b) => ({
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  }));
}

/**
 * Composición de exportación. `items` ya resueltos (colocación automática
 * aplicada); `aspectOf` da el ancho/alto del recorte (1 si no se sabe);
 * `source` es el tamaño del lienzo en pantalla. Lanza EmptyCanvasError sin
 * prendas o sin tamaño de origen.
 */
export function exportGeometry(
  items: CanvasItem[],
  aspectOf: (garmentId: string) => number | undefined,
  source: Size,
  ratio: ExportRatio,
): ExportLayout {
  if (items.length === 0 || !(source.width > 0) || !(source.height > 0))
    throw new EmptyCanvasError();

  const target = EXPORT_SIZES[ratio];
  const ordered = paintOrder({ items });
  const src = ordered.map((i) => ({
    garmentId: i.garmentId,
    box: nodeBox(i, aspectOf(i.garmentId) ?? 1, source),
  }));

  const b = unionBounds(src.map((n) => rotatedBox(n.box)));
  const bw = Math.max(b.right - b.left, 1e-6);
  const bh = Math.max(b.bottom - b.top, 1e-6);
  const margin = EXPORT_MARGIN * Math.min(target.width, target.height);
  const k = Math.min((target.width - 2 * margin) / bw, (target.height - 2 * margin) / bh);
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;

  const nodes = src.map(({ garmentId, box }) => {
    const width = box.width * k;
    const height = box.height * k;
    return {
      garmentId,
      box: {
        x: (box.x - cx) * k + target.width / 2,
        y: (box.y - cy) * k + target.height / 2,
        width,
        height,
        offsetX: width / 2,
        offsetY: height / 2,
        rotation: box.rotation,
      },
    };
  });

  return { width: target.width, height: target.height, scale: k, nodes };
}

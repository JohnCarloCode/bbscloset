// Colocación automática del collage (spec 3.3, plan 4.2). Función pura.
//
// Idea: se monta la composición en "unidades de peso" (U = 1) y al final se
// escala entera para que quepa en el lienzo con margen. Así cualquier
// combinación de huecos sale equilibrada sin plantillas por caso:
// - Columna central (cuerpo): grupo superior arriba (exterior/media/base o
//   cuerpo entero, solapadas en abanico como en el prototipo), parte
//   inferior debajo (la de arriba tapa un poco la cintura) y calzado abajo.
//   Lo que falta no deja hueco: las filas se apilan con lo que haya.
// - Columnas laterales: accesorios a la izquierda (a la altura de la
//   cabeza); joyería (rejilla) arriba a la derecha y bolso a la altura de la
//   cadera (o más abajo si ahí queda más pegado). Cada pieza se pega al
//   perfil del cuerpo a su altura, no a su caja entera.
// - Sin cuerpo (solo joyas, bolso, accesorios): todo en fila, centrado.
// - Tamaño: el lado mayor de cada prenda mide `sizeWeight` U; con su aspecto
//   real (ancho/alto) sale el otro lado. U se limita para que una prenda
//   sola no llene el lienzo.
// - Variantes: en lienzos estrechos se prueba a subir accesorios y joyas a
//   una fila sobre el cuerpo; en apaisados (pantalla partida), a llevar el
//   calzado a la columna derecha. Gana la que deja las prendas claramente
//   más grandes.
// - El cuerpo queda centrado salvo un pequeño desplazamiento hacia el lado
//   sin piezas, para no desperdiciar ancho (BODY_CENTERING).
// - Datos de los huecos: por defecto SLOTS de src/lib/domain/slots.ts, que
//   es copia de la semilla de 0001 (comprobado por slots.test.ts).
//
// Unidades de salida: las de src/features/dresser/model.ts (x, y centro
// normalizado 0..1; scale = lado mayor / min(ancho, alto) del lienzo).
import { SLOTS, type SlotId } from "@/lib/domain/slots";

export type LayoutInput = {
  garmentId: string;
  slotId: SlotId;
  /** Ancho / alto del recorte; 1 si aún no se conoce. */
  aspect: number;
  placedAt: number;
};

export type LayoutResult = { garmentId: string; x: number; y: number; scale: number; z: number };

export type CanvasSize = { width: number; height: number };

export type SlotLayoutData = Record<SlotId, { sizeWeight: number; defaultZ: number }>;

// Ajustes de composición (en U salvo que se diga otra cosa).
const PADDING = 0.06; // margen, fracción del lado corto del lienzo
const MAX_UNIT = 0.72; // U máximo, fracción del alto útil (que una prenda sola no lo llene todo)
const LAYER_STEP = 0.4; // desplazamiento entre capas superiores, fracción del ancho medio
const WAIST_TUCK = 0.1; // cuánto tapa la parte de arriba a la de abajo, fracción de su alto
const ROW_GAP = 0.05; // entre filas del cuerpo (antes del calzado)
const SIDE_GAP = 0.12; // entre el cuerpo y las columnas laterales
const ITEM_GAP = 0.06; // entre piezas de una columna lateral
const BODY_CENTERING = 0.5; // 1 = cuerpo en el centro exacto; 0 = se centra la composición entera
const JEWELRY_COLS = 2; // en la columna lateral (en la fila de arriba, 3)
const WIDE_MIN_RATIO = 1.5; // ancho/alto del lienzo a partir del cual se prueba la variante apaisada
const VARIANT_PREFERENCE = 1.12; // una variante alternativa debe ganar al menos un 12 % de tamaño

// Orden de las capas en el abanico, de izquierda a derecha.
const LAYER_ORDER: SlotId[] = ["outer_layer", "mid_layer", "base_layer", "full_body"];

type Box = { id: string; cx: number; cy: number; w: number; h: number; long: number };

function safeAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(5, Math.max(0.2, aspect));
}

/** Ancho y alto (en U) de una prenda con lado mayor `long`. */
function dims(long: number, aspect: number): { w: number; h: number } {
  return aspect >= 1 ? { w: long, h: long / aspect } : { w: long * aspect, h: long };
}

type Sized = LayoutInput & { long: number; w: number; h: number };

function bounds(boxes: Box[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.cx - b.w / 2);
    x1 = Math.max(x1, b.cx + b.w / 2);
    y0 = Math.min(y0, b.cy - b.h / 2);
    y1 = Math.max(y1, b.cy + b.h / 2);
  }
  return { x0, y0, x1, y1 };
}

function box(it: Sized, cx: number, top: number): Box {
  return { id: it.garmentId, cx, cy: top + it.h / 2, w: it.w, h: it.h, long: it.long };
}

type Variant = {
  /** El calzado va a la columna derecha en vez de bajo el cuerpo (lienzo apaisado). */
  shoesAside: boolean;
  /** Accesorios y joyas en una fila sobre el cuerpo en vez de a los lados (lienzo estrecho). */
  sidesOnTop: boolean;
};

/** Rejilla de joyas (de la más antigua a la más nueva), con la esquina superior izquierda en 0,0. */
function jewelryGrid(jewels: Sized[], cols: number): Box[] {
  if (jewels.length === 0) return [];
  const c = Math.min(cols, jewels.length);
  const cellW = Math.max(...jewels.map((j) => j.w)) + ITEM_GAP;
  const cellH = Math.max(...jewels.map((j) => j.h)) + ITEM_GAP;
  const lastRow = Math.floor((jewels.length - 1) / c);
  const inLast = jewels.length - lastRow * c;
  return jewels.map((j, k) => {
    const row = Math.floor(k / c);
    // La última fila, si está incompleta, va centrada.
    const indent = row === lastRow ? ((c - inLast) * cellW) / 2 : 0;
    return box(
      j,
      indent + (k % c) * cellW + (cellW - ITEM_GAP) / 2,
      row * cellH + (cellH - ITEM_GAP - j.h) / 2,
    );
  });
}

function moved(boxes: Box[], dx: number, dy: number): Box[] {
  return boxes.map((b) => ({ ...b, cx: b.cx + dx, cy: b.cy + dy }));
}

/**
 * Composición en U. El cuerpo va centrado en x = 0 y empieza en y = 0.
 * Las piezas laterales se pegan al perfil del cuerpo a su altura (el bolso,
 * junto a la parte inferior, queda más cerca que las joyas junto al abanico).
 */
function compose(items: Sized[], v: Variant): { boxes: Box[]; hasBody: boolean } {
  const bySlot = (slot: SlotId) => items.filter((i) => i.slotId === slot);
  const one = (slot: SlotId) => bySlot(slot)[0];
  const body: Box[] = [];

  // Grupo superior en abanico: centros separados LAYER_STEP × ancho medio.
  const layers = LAYER_ORDER.map(one).filter((i): i is Sized => i !== undefined);
  const bottom = one("bottom");
  let y = 0;
  if (layers.length > 0) {
    const centers: number[] = [0];
    for (let k = 1; k < layers.length; k++) {
      const step = LAYER_STEP * ((layers[k - 1].w + layers[k].w) / 2);
      centers.push(centers[k - 1] + step);
    }
    // Centra el abanico (por su caja) sobre el eje del cuerpo.
    const left = Math.min(...layers.map((l, k) => centers[k] - l.w / 2));
    const right = Math.max(...layers.map((l, k) => centers[k] + l.w / 2));
    const shift = (left + right) / 2;
    layers.forEach((l, k) => body.push(box(l, centers[k] - shift, 0)));
    // La cintura: bajo la capa más corta (la que deja ver la parte inferior).
    y = bottom
      ? Math.min(...layers.map((l) => l.h)) * (1 - WAIST_TUCK)
      : Math.max(...layers.map((l) => l.h)) + ROW_GAP;
  }
  // Altura de la cadera, para colgar el bolso: la cintura o, sin parte
  // inferior (vestido, solo capas), algo menos de la mitad de la más larga.
  const hipY = bottom || layers.length === 0 ? y : 0.45 * Math.max(...layers.map((l) => l.h));
  if (bottom) {
    body.push(box(bottom, 0, y));
    y += bottom.h + ROW_GAP;
  }
  const shoes = one("footwear");
  if (shoes && !v.shoesAside) body.push(box(shoes, 0, y));

  const hasBody = body.length > 0;
  const bodyBottom = hasBody ? Math.max(...body.map((b) => b.cy + b.h / 2)) : 0;
  // Borde del cuerpo (derecho o izquierdo) entre dos alturas.
  const edge = (y0: number, y1: number, side: 1 | -1) => {
    const near = body.filter((b) => b.cy - b.h / 2 < y1 && b.cy + b.h / 2 > y0);
    return near.reduce((m, b) => Math.max(m, side * b.cx + b.w / 2), 0);
  };

  const acc = one("accessories");
  const jewels = [...bySlot("jewelry")].sort(
    (a, b) => a.placedAt - b.placedAt || a.garmentId.localeCompare(b.garmentId),
  );
  const bag = one("bag");
  const boxes = [...body];

  if (!hasBody) {
    // Sin cuerpo: accesorio, joyas y bolso en fila, centrados.
    let x = 0;
    for (const group of [
      acc ? [box(acc, acc.w / 2, 0)] : [],
      jewelryGrid(jewels, Math.max(JEWELRY_COLS, Math.ceil(Math.sqrt(jewels.length)))),
      bag ? [box(bag, bag.w / 2, 0)] : [],
      shoes ? [box(shoes, shoes.w / 2, 0)] : [],
    ]) {
      if (group.length === 0) continue;
      const g = bounds(group);
      boxes.push(...moved(group, x - g.x0, 0));
      x += g.x1 - g.x0 + SIDE_GAP;
    }
    return { boxes, hasBody };
  }

  let ry = 0; // siguiente altura libre de la columna derecha
  if (v.sidesOnTop) {
    // Fila sobre el cuerpo: accesorio y joyas, centrados en el eje.
    const row: Box[] = [];
    let x = 0;
    for (const group of [acc ? [box(acc, acc.w / 2, 0)] : [], jewelryGrid(jewels, 3)]) {
      if (group.length === 0) continue;
      const g = bounds(group);
      row.push(...moved(group, x - g.x0, 0));
      x += g.x1 - g.x0 + SIDE_GAP;
    }
    if (row.length > 0) {
      const r = bounds(row);
      boxes.push(...moved(row, -(r.x0 + r.x1) / 2, -(r.y1 - r.y0) - ROW_GAP));
    }
  } else {
    // Columna izquierda: accesorio a la altura de la cabeza.
    if (acc) boxes.push(box(acc, -(edge(0, acc.h, -1) + SIDE_GAP + acc.w / 2), 0));
    // Columna derecha arriba: rejilla de joyas.
    const grid = jewelryGrid(jewels, JEWELRY_COLS);
    if (grid.length > 0) {
      const g = bounds(grid);
      boxes.push(...moved(grid, edge(g.y0, g.y1, 1) + SIDE_GAP, 0));
      ry = g.y1 + ITEM_GAP;
    }
  }
  if (bag) {
    // Cuelga a la altura de la cadera o, si ahí lo aparta el abanico de capas,
    // justo bajo las capas (junto a la parte inferior, más estrecha) o, si no,
    // abajo junto al calzado; nunca por debajo del bajo del cuerpo. Gana la
    // altura que lo deja más cerca del eje (a igualdad, la primera).
    const clampTop = (t: number) => Math.max(ry, Math.min(t, Math.max(0, bodyBottom - bag.h)));
    const layersBottom = layers.length > 0 ? Math.max(...layers.map((l) => l.h)) : 0;
    const tops = [clampTop(hipY), clampTop(layersBottom), clampTop(bodyBottom)];
    const top = tops.reduce((a, t) =>
      edge(t, t + bag.h, 1) < edge(a, a + bag.h, 1) - 1e-9 ? t : a,
    );
    boxes.push(box(bag, edge(top, top + bag.h, 1) + SIDE_GAP + bag.w / 2, top));
    ry = top + bag.h + ITEM_GAP;
  }
  if (shoes && v.shoesAside) {
    const top = Math.max(ry, bodyBottom - shoes.h);
    boxes.push(box(shoes, edge(top, top + shoes.h, 1) + SIDE_GAP + shoes.w / 2, top));
  }
  return { boxes, hasBody };
}

/** Escala la composición al lienzo; devuelve U en píxeles y la transformación. */
function fit(boxes: Box[], hasBody: boolean, canvas: CanvasSize) {
  const short = Math.min(canvas.width, canvas.height);
  const pad = PADDING * short;
  const aw = canvas.width - 2 * pad;
  const ah = canvas.height - 2 * pad;
  const b = bounds(boxes);
  // El centro del lienzo va a medio camino entre el eje del cuerpo (x = 0) y
  // el centro de la composición: el cuerpo queda casi centrado aunque solo
  // haya piezas a un lado, sin desperdiciar medio lienzo en lienzos estrechos.
  const mid = (b.x0 + b.x1) / 2;
  const cxU = hasBody ? mid * (1 - BODY_CENTERING) : mid;
  const halfW = Math.max(cxU - b.x0, b.x1 - cxU);
  const unit = Math.min(aw / (2 * halfW), ah / (b.y1 - b.y0), MAX_UNIT * ah);
  return { unit, cxU, cyU: (b.y0 + b.y1) / 2 };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Coloca los items (no manuales) en el lienzo. Devuelve uno por item, en el
 * mismo orden. z = default_z de su hueco (las joyas empatan; el lienzo
 * desempata por placedAt).
 */
export function autoLayout(
  items: LayoutInput[],
  canvas: CanvasSize,
  slots: SlotLayoutData = SLOTS,
): LayoutResult[] {
  if (items.length === 0 || !(canvas.width > 0) || !(canvas.height > 0)) {
    return items.map((i) => ({
      garmentId: i.garmentId,
      x: 0.5,
      y: 0.5,
      scale: 0.4,
      z: slots[i.slotId].defaultZ,
    }));
  }
  const sized: Sized[] = items.map((i) => {
    const long = slots[i.slotId].sizeWeight;
    return { ...i, long, ...dims(long, safeAspect(i.aspect)) };
  });

  // Variante normal y alternativas (calzado al lado en lienzos apaisados;
  // accesorios y joyas encima en lienzos estrechos). Una alternativa solo
  // gana si deja las prendas claramente más grandes.
  const has = (slot: SlotId) => sized.some((i) => i.slotId === slot);
  const wide = canvas.width / canvas.height >= WIDE_MIN_RATIO;
  const variants: Variant[] = [{ shoesAside: false, sidesOnTop: false }];
  const canTop = has("accessories") || has("jewelry");
  if (canTop) variants.push({ shoesAside: false, sidesOnTop: true });
  if (wide && has("footwear")) {
    variants.push({ shoesAside: true, sidesOnTop: false });
    if (canTop) variants.push({ shoesAside: true, sidesOnTop: true });
  }
  let best = compose(sized, variants[0]);
  let bestFit = fit(best.boxes, best.hasBody, canvas);
  for (const v of variants.slice(1)) {
    const alt = compose(sized, v);
    if (!alt.hasBody) continue;
    const altFit = fit(alt.boxes, alt.hasBody, canvas);
    if (altFit.unit > bestFit.unit * VARIANT_PREFERENCE) {
      best = alt;
      bestFit = altFit;
    }
  }

  const { unit, cxU, cyU } = bestFit;
  const short = Math.min(canvas.width, canvas.height);
  const byId = new Map(best.boxes.map((b) => [b.id, b]));
  return items.map((i) => {
    const b = byId.get(i.garmentId);
    // Solo pasa con datos incoherentes (dos prendas en un hueco simple).
    if (!b)
      return { garmentId: i.garmentId, x: 0.5, y: 0.5, scale: 0.4, z: slots[i.slotId].defaultZ };
    return {
      garmentId: i.garmentId,
      x: round((canvas.width / 2 + (b.cx - cxU) * unit) / canvas.width),
      y: round((canvas.height / 2 + (b.cy - cyU) * unit) / canvas.height),
      scale: round((b.long * unit) / short),
      z: slots[i.slotId].defaultZ,
    };
  });
}

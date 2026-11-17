// Modelo del lienzo del vestidor y regla de huecos (spec 2.1, 3.2, 3.3).
// Solo funciones puras: sin React, sin Konva, sin red. Cada reductor recibe
// un estado y devuelve otro nuevo (o el mismo si no cambia nada).
//
// Unidades (son las mismas que se guardarán en favorite_items, paso 5.1;
// database.md no las fija, así que se deciden aquí):
// - x, y: centro de la prenda en coordenadas normalizadas del lienzo, 0..1
//   (0,0 = esquina superior izquierda; 1,1 = inferior derecha). Así
//   sobreviven a cambios de tamaño del lienzo (pantalla partida, exportación).
// - scale: lado mayor del recorte como fracción del lado corto del lienzo
//   (min(ancho, alto)). 0.5 = la prenda mide la mitad del lado corto.
// - rotation: grados, sentido horario (como Konva).
// - z: orden de superposición; mayor = delante. Empates: placedAt.
// - manual: el usuario ha movido/redimensionado/rotado la prenda; la
//   colocación automática (4.2) no toca x, y, scale ni rotation de estos
//   items. En favoritos, un item no manual se guarda con x/y/scale/rotation
//   a NULL ("colócalo tú, app").
import { SLOTS, type SlotId } from "@/lib/domain/slots";
import { slotOfType, type GarmentTypeId } from "@/lib/domain/types";

export type CanvasItem = {
  garmentId: string;
  slotId: SlotId;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
  locked: boolean;
  manual: boolean;
  /** Orden de llegada al lienzo (creciente); decide "la joya más antigua". */
  placedAt: number;
};

export type CanvasState = { items: CanvasItem[] };

export type Transform = Pick<CanvasItem, "x" | "y" | "scale" | "rotation">;

/** Lo mínimo de una prenda para ponerla en el lienzo. */
export type PlaceableGarment = { id: string; typeId: GarmentTypeId };

/** Qué ha quitado una colocación, para los toasts de la UI (screens 7.2). */
export type PlaceEvents = {
  /** Prenda del mismo hueco que se ha sustituido (0 o 1). */
  replaced: CanvasItem[];
  /** Quitadas por la exclusión de cuerpo entero, en los dos sentidos. */
  removedByFullBody: CanvasItem[];
  /** Joya más antigua quitada al pasar del máximo. */
  jewelryDropped: CanvasItem | null;
};

export type PlaceResult = { state: CanvasState; events: PlaceEvents };

export const EMPTY_CANVAS: CanvasState = { items: [] };

/** Joyería: 3 por defecto, hasta 10 (spec 2.1). */
export const JEWELRY_MAX_DEFAULT = 3;
export const JEWELRY_MAX_LIMIT = 10;

/** Transformación provisional de una prenda nueva hasta que la recoloque 4.2. */
export const DEFAULT_TRANSFORM: Transform = { x: 0.5, y: 0.5, scale: 0.4, rotation: 0 };

const NO_EVENTS: PlaceEvents = { replaced: [], removedByFullBody: [], jewelryDropped: null };

/** Huecos que no pueden convivir con un hueco dado (cuerpo entero, spec 2.1). */
function excludedBy(slot: SlotId): SlotId[] {
  if (slot === "full_body") return ["base_layer", "bottom"];
  if (slot === "base_layer" || slot === "bottom") return ["full_body"];
  return [];
}

function clampJewelryMax(max: number): number {
  if (!Number.isFinite(max)) return JEWELRY_MAX_DEFAULT;
  return Math.min(JEWELRY_MAX_LIMIT, Math.max(1, Math.floor(max)));
}

function nextPlacedAt(items: CanvasItem[], now: number): number {
  const last = items.reduce((m, i) => Math.max(m, i.placedAt), -Infinity);
  return Math.max(now, last + 1);
}

function byPlacedAt(a: CanvasItem, b: CanvasItem): number {
  return a.placedAt - b.placedAt;
}

/** Orden de pintado: de atrás hacia delante (z, y a igualdad, placedAt). */
export function paintOrder(state: CanvasState): CanvasItem[] {
  return [...state.items].sort(
    (a, b) => a.z - b.z || a.placedAt - b.placedAt || a.garmentId.localeCompare(b.garmentId),
  );
}

export function hasItem(state: CanvasState, garmentId: string): boolean {
  return state.items.some((i) => i.garmentId === garmentId);
}

export function hasManual(state: CanvasState): boolean {
  return state.items.some((i) => i.manual);
}

/**
 * Pone una prenda en el lienzo aplicando la regla de huecos (spec 2.1):
 * - mismo hueco sustituye (joyería: hasta `jewelryMax`, luego cae la más antigua);
 * - cuerpo entero quita capa base y parte inferior, y viceversa;
 * - el candado no protege de `place`: solo afecta a "Sustituir" (spec 3.2).
 * Si la sustituida (mismo hueco) tenía ajustes manuales, la nueva hereda
 * x, y, scale y rotation (plan 4.5). Si la prenda ya está, no hace nada
 * (para "tocar otra vez la quita" usa `toggle`).
 * `now` solo sirve para `placedAt`; se pasa en los tests para que sea determinista.
 */
export function place(
  state: CanvasState,
  garment: PlaceableGarment,
  jewelryMax: number = JEWELRY_MAX_DEFAULT,
  now: number = Date.now(),
): PlaceResult {
  if (hasItem(state, garment.id)) return { state, events: NO_EVENTS };

  const slotId = slotOfType(garment.typeId);
  const slot = SLOTS[slotId];
  const excluded = excludedBy(slotId);

  const removedByFullBody = state.items.filter((i) => excluded.includes(i.slotId));
  let replaced: CanvasItem[] = [];
  let jewelryDropped: CanvasItem | null = null;

  if (slot.multi) {
    const same = state.items.filter((i) => i.slotId === slotId).sort(byPlacedAt);
    const max = clampJewelryMax(jewelryMax);
    // Se quitan las más antiguas hasta dejar sitio para la nueva.
    const overflow = same.slice(0, Math.max(0, same.length - max + 1));
    if (overflow.length > 0) jewelryDropped = overflow[0];
    // Si jewelryMax bajó en ajustes, puede sobrar más de una: van como sustituidas.
    replaced = overflow.slice(1);
  } else {
    replaced = state.items.filter((i) => i.slotId === slotId);
  }

  const gone = new Set(
    [...removedByFullBody, ...replaced, ...(jewelryDropped ? [jewelryDropped] : [])].map(
      (i) => i.garmentId,
    ),
  );

  // Herencia de la transformación manual: solo al sustituir en el mismo hueco
  // (no en la exclusión de cuerpo entero ni en joyería, que no tiene "heredera").
  const heir = !slot.multi ? replaced.find((i) => i.manual) : undefined;
  const sameSlotPrev = !slot.multi ? replaced[0] : undefined;

  const item: CanvasItem = {
    garmentId: garment.id,
    slotId,
    ...(heir
      ? { x: heir.x, y: heir.y, scale: heir.scale, rotation: heir.rotation }
      : DEFAULT_TRANSFORM),
    // Mantiene el orden de capa si se había cambiado a mano en ese hueco.
    z: sameSlotPrev ? sameSlotPrev.z : slot.defaultZ,
    locked: false,
    manual: heir !== undefined,
    placedAt: nextPlacedAt(state.items, now),
  };

  return {
    state: { items: [...state.items.filter((i) => !gone.has(i.garmentId)), item] },
    events: { replaced, removedByFullBody, jewelryDropped },
  };
}

/**
 * Tocar una prenda del panel: si ya está en el lienzo la quita; si no, la
 * pone con `place` (screens 7.3: "tocarla otra vez la quita").
 */
export function toggle(
  state: CanvasState,
  garment: PlaceableGarment,
  jewelryMax: number = JEWELRY_MAX_DEFAULT,
  now: number = Date.now(),
): PlaceResult & { removed: CanvasItem | null } {
  const current = state.items.find((i) => i.garmentId === garment.id);
  if (current) return { state: remove(state, garment.id), events: NO_EVENTS, removed: current };
  return { ...place(state, garment, jewelryMax, now), removed: null };
}

/**
 * Prendas del lienzo a las que se les ha cambiado el tipo (y con él quizá el
 * hueco) en el catálogo (7.6). Cada item cuyo hueco ya no corresponde a su
 * tipo se quita y se vuelve a poner con `place`, que aplica la regla de huecos
 * (la que sobra en el hueco nuevo, o por cuerpo entero, se va). Lo propio del
 * item se conserva: si era manual, su posición, tamaño y giro; y el candado.
 * `typeOf` da el tipo actual (undefined = no se sabe: se deja como está).
 * Devuelve el mismo estado si no cambia nada.
 */
export function reslot(
  state: CanvasState,
  typeOf: (garmentId: string) => GarmentTypeId | undefined,
  jewelryMax: number = JEWELRY_MAX_DEFAULT,
): CanvasState {
  const moved = state.items.filter((i) => {
    const type = typeOf(i.garmentId);
    return type !== undefined && slotOfType(type) !== i.slotId;
  });
  if (moved.length === 0) return state;

  let next = state;
  for (const old of [...moved].sort(byPlacedAt)) {
    // Puede haberla quitado ya una anterior (p. ej. otra pasada a cuerpo entero).
    if (!hasItem(next, old.garmentId)) continue;
    const placed = place(
      remove(next, old.garmentId),
      { id: old.garmentId, typeId: typeOf(old.garmentId)! },
      jewelryMax,
      old.placedAt,
    ).state;
    next = mapItem(placed, old.garmentId, (i) => ({
      ...i,
      ...(old.manual
        ? { x: old.x, y: old.y, scale: old.scale, rotation: old.rotation, manual: true }
        : {}),
      locked: old.locked,
    }));
  }
  return next;
}

export function remove(state: CanvasState, garmentId: string): CanvasState {
  if (!hasItem(state, garmentId)) return state;
  return { items: state.items.filter((i) => i.garmentId !== garmentId) };
}

function mapItem(
  state: CanvasState,
  garmentId: string,
  fn: (item: CanvasItem) => CanvasItem,
): CanvasState {
  if (!hasItem(state, garmentId)) return state;
  return { items: state.items.map((i) => (i.garmentId === garmentId ? fn(i) : i)) };
}

export function toggleLock(state: CanvasState, garmentId: string): CanvasState {
  return mapItem(state, garmentId, (i) => ({ ...i, locked: !i.locked }));
}

/** Mover, redimensionar o rotar a mano: marca el item como manual. */
export function updateTransform(
  state: CanvasState,
  garmentId: string,
  transform: Partial<Transform>,
): CanvasState {
  return mapItem(state, garmentId, (i) => ({ ...i, ...transform, manual: true }));
}

/**
 * Mueve una prenda un puesto en el orden de pintado y reajusta las z para que
 * el orden sea estrictamente creciente, tocando lo mínimo (las z de los huecos
 * conservan su valor por defecto mientras no haga falta subirlas).
 * Cambiar el orden no marca `manual` (no es una posición); `resetManual` lo deshace.
 */
function shift(state: CanvasState, garmentId: string, delta: 1 | -1): CanvasState {
  const order = paintOrder(state);
  const from = order.findIndex((i) => i.garmentId === garmentId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return state;
  [order[from], order[to]] = [order[to], order[from]];

  const newZ = new Map<string, number>();
  let prev = -Infinity;
  for (const item of order) {
    const z = Math.max(item.z, prev + 1);
    newZ.set(item.garmentId, z);
    prev = z;
  }
  return { items: state.items.map((i) => ({ ...i, z: newZ.get(i.garmentId)! })) };
}

export function bringForward(state: CanvasState, garmentId: string): CanvasState {
  return shift(state, garmentId, 1);
}

export function sendBackward(state: CanvasState, garmentId: string): CanvasState {
  return shift(state, garmentId, -1);
}

/**
 * "Colocación automática" (spec 3.3): descarta todos los ajustes manuales.
 * Todos a automático, sin rotación y con la z por defecto de su hueco; x, y
 * y scale los vuelve a calcular la colocación automática (4.2), que ya no
 * respeta los items al no ser manuales. Los candados se mantienen (no son
 * un ajuste de colocación).
 */
export function resetManual(state: CanvasState): CanvasState {
  return {
    items: state.items.map((i) => ({
      ...i,
      rotation: 0,
      z: SLOTS[i.slotId].defaultZ,
      manual: false,
    })),
  };
}

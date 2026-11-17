// Botones de aleatorio del vestidor (spec 3.2, screens 7.2; paso 4.5).
// Funciones puras: el azar (`rng`, como Math.random) y el reloj (`now`) se
// inyectan para que los tests sean deterministas.
//
// - `substitute` ("Sustituir"): cada prenda no bloqueada cambia por otra de
//   su mismo hueco, nunca la misma que había; si no hay otra, se queda. La
//   estructura del outfit se mantiene: no cruza huecos (un vestido cambia por
//   otro vestido o mono) y conserva z, placedAt y, si tenía ajustes manuales,
//   x, y, scale y rotation (los demás los recoloca autoLayout).
// - `randomOutfit` ("Outfit aleatorio"): vacía el lienzo, candados incluidos
//   (el candado solo protege de "Sustituir", spec 3.2), y pone una prenda al
//   azar de cada categoría predeterminada. Vestidos: decisión 9 del plan.
import { SLOT_IDS, SLOTS, type SlotId } from "@/lib/domain/slots";
import { DEFAULT_TRANSFORM, type CanvasItem, type CanvasState } from "./model";

/** Prendas en uso (ids) de cada hueco. Un hueco ausente se trata como vacío. */
export type GarmentPool = Partial<Record<SlotId, readonly string[]>>;

/** Número al azar en [0, 1), como Math.random. */
export type Rng = () => number;

function pick<T>(list: readonly T[], rng: Rng): T {
  const i = Math.min(list.length - 1, Math.floor(rng() * list.length));
  return list[Math.max(0, i)];
}

export type SubstituteResult = {
  state: CanvasState;
  /** Cuántas prendas han cambiado (0 = no había nada que sustituir). */
  changed: number;
};

/** Hay algo que "Sustituir" pueda tocar: alguna prenda sin candado. */
export function canSubstitute(state: CanvasState): boolean {
  return state.items.some((i) => !i.locked);
}

export function substitute(state: CanvasState, pool: GarmentPool, rng: Rng): SubstituteResult {
  // Ids ya en el lienzo: en joyería (varias a la vez) no se puede repetir una puesta.
  const used = new Set(state.items.map((i) => i.garmentId));
  let changed = 0;
  const items = state.items.map((item): CanvasItem => {
    if (item.locked) return item;
    const candidates = (pool[item.slotId] ?? []).filter((id) => !used.has(id));
    if (candidates.length === 0) return item;
    const garmentId = pick(candidates, rng);
    used.add(garmentId);
    changed++;
    // El resto (posición manual, z, placedAt, hueco) se hereda tal cual.
    return { ...item, garmentId };
  });
  return changed === 0 ? { state, changed } : { state: { items }, changed };
}

export type RandomOutfitResult = {
  state: CanvasState;
  /** Categorías predeterminadas sin ninguna prenda en uso (para el aviso). */
  empty: SlotId[];
};

/**
 * Una prenda al azar de cada categoría predeterminada, en el orden de los
 * huecos. Joyería también pone una sola pieza ("una prenda de cada", spec
 * 3.2), siempre dentro del máximo del usuario.
 * Cuerpo entero (decisión 9): si está entre las predeterminadas junto a capa
 * base o parte inferior, al 50 % sale el vestido (sin base ni inferior) o
 * base + inferior (sin vestido). Si una de las dos opciones no tiene prendas,
 * sale la otra.
 */
export function randomOutfit(
  pool: GarmentPool,
  randomSlots: readonly SlotId[],
  jewelryMax: number,
  rng: Rng,
  now: number = Date.now(),
): RandomOutfitResult {
  const wanted = SLOT_IDS.filter((s) => randomSlots.includes(s));
  const has = (s: SlotId) => (pool[s]?.length ?? 0) > 0;
  const empty = wanted.filter((s) => !has(s));
  let slots = wanted.filter(has);

  const pair: SlotId[] = slots.filter((s) => s === "base_layer" || s === "bottom");
  if (slots.includes("full_body") && pair.length > 0) {
    const dress = rng() < 0.5;
    slots = dress ? slots.filter((s) => !pair.includes(s)) : slots.filter((s) => s !== "full_body");
  }

  const pieces = Math.min(1, Math.max(0, Math.floor(jewelryMax)));
  const items: CanvasItem[] = [];
  for (const slotId of slots) {
    if (slotId === "jewelry" && pieces === 0) continue;
    items.push({
      garmentId: pick(pool[slotId]!, rng),
      slotId,
      ...DEFAULT_TRANSFORM,
      z: SLOTS[slotId].defaultZ,
      locked: false,
      manual: false,
      placedAt: now + items.length,
    });
  }
  return { state: { items }, empty };
}

/** Huecos cuya lista de prendas necesita "Sustituir" (los de prendas sin candado). */
export function substituteSlots(state: CanvasState): SlotId[] {
  const set = new Set(state.items.filter((i) => !i.locked).map((i) => i.slotId));
  return SLOT_IDS.filter((s) => set.has(s));
}

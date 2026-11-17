// Tipos de prenda: lista cerrada del software (spec 2.2). Cada tipo pertenece
// a un único hueco. Copia de la semilla de public.garment_types
// (supabase/migrations/0001); types.test.ts comprueba que no se desvían.
// Los nombres visibles están en src/messages (clave `types.<id>`).
import type { SlotId } from "./slots";

export const GARMENT_TYPE_SLOT = {
  // capa base
  tshirt: "base_layer",
  shirt: "base_layer",
  top: "base_layer",
  bodysuit: "base_layer",
  // capa media
  sweater: "mid_layer",
  sweatshirt: "mid_layer",
  cardigan: "mid_layer",
  vest: "mid_layer",
  // capa exterior
  jacket: "outer_layer",
  coat: "outer_layer",
  bomber: "outer_layer",
  trench: "outer_layer",
  // parte inferior
  trousers: "bottom",
  jeans: "bottom",
  skirt: "bottom",
  shorts: "bottom",
  // cuerpo entero
  dress: "full_body",
  jumpsuit: "full_body",
  // calzado
  sneakers: "footwear",
  boots: "footwear",
  sandals: "footwear",
  heels: "footwear",
  // bolso
  handbag: "bag",
  backpack: "bag",
  crossbody: "bag",
  // joyería
  necklace: "jewelry",
  earrings: "jewelry",
  ring: "jewelry",
  bracelet: "jewelry",
  // accesorios
  hat: "accessories",
  glasses: "accessories",
  belt: "accessories",
  scarf: "accessories",
} as const satisfies Record<string, SlotId>;

export type GarmentTypeId = keyof typeof GARMENT_TYPE_SLOT;

/** Ids de tipo en el orden de spec 2.1 (agrupados por hueco). */
export const GARMENT_TYPE_IDS = Object.keys(GARMENT_TYPE_SLOT) as GarmentTypeId[];

export function isGarmentTypeId(value: unknown): value is GarmentTypeId {
  return typeof value === "string" && Object.hasOwn(GARMENT_TYPE_SLOT, value);
}

/** Hueco al que va un tipo de prenda. */
export function slotOfType(type: GarmentTypeId): SlotId {
  return GARMENT_TYPE_SLOT[type];
}

/** Tipos que caben en un hueco, en orden. */
export function typesOfSlot(slot: SlotId): GarmentTypeId[] {
  return GARMENT_TYPE_IDS.filter((t) => GARMENT_TYPE_SLOT[t] === slot);
}

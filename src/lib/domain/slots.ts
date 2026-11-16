// Huecos (slots) del cuerpo: lista cerrada del software, en el orden de
// spec 2.1 (igual que public.slots en supabase/migrations/0001). Los nombres
// visibles están en src/messages (clave `slots.<id>`).
// Mínima por ahora: solo ids y orden; el paso 3.1 la completa.

export const SLOT_IDS = [
  "base_layer",
  "mid_layer",
  "outer_layer",
  "bottom",
  "full_body",
  "footwear",
  "bag",
  "jewelry",
  "accessories",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === "string" && (SLOT_IDS as readonly string[]).includes(value);
}

// Huecos (slots) del cuerpo: lista cerrada del software, en el orden de
// spec 2.1. Copia de la semilla de public.slots (supabase/migrations/0001);
// slots.test.ts comprueba que no se desvían. Los nombres visibles están en
// src/messages (clave `slots.<id>`).

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

export type Slot = {
  id: SlotId;
  /** Orden de presentación (1..9). */
  sortOrder: number;
  /** Orden de superposición por defecto en el lienzo. */
  defaultZ: number;
  /** Peso de tamaño para la colocación automática. */
  sizeWeight: number;
  /** Admite varias prendas a la vez (solo joyería). */
  multi: boolean;
};

// default_z y size_weight son la propuesta inicial de 0001; se ajustan en el paso 4.2.
export const SLOTS: Record<SlotId, Slot> = {
  base_layer: { id: "base_layer", sortOrder: 1, defaultZ: 40, sizeWeight: 0.8, multi: false },
  mid_layer: { id: "mid_layer", sortOrder: 2, defaultZ: 50, sizeWeight: 0.85, multi: false },
  outer_layer: { id: "outer_layer", sortOrder: 3, defaultZ: 60, sizeWeight: 0.9, multi: false },
  bottom: { id: "bottom", sortOrder: 4, defaultZ: 30, sizeWeight: 1.0, multi: false },
  full_body: { id: "full_body", sortOrder: 5, defaultZ: 40, sizeWeight: 1.1, multi: false },
  footwear: { id: "footwear", sortOrder: 6, defaultZ: 20, sizeWeight: 0.45, multi: false },
  bag: { id: "bag", sortOrder: 7, defaultZ: 70, sizeWeight: 0.4, multi: false },
  jewelry: { id: "jewelry", sortOrder: 8, defaultZ: 80, sizeWeight: 0.25, multi: true },
  accessories: { id: "accessories", sortOrder: 9, defaultZ: 90, sizeWeight: 0.35, multi: false },
};

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === "string" && Object.hasOwn(SLOTS, value);
}

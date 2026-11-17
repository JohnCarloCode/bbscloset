// Borrador del vestidor en localStorage (paso 4.6; spec 3.2): el outfit en
// curso sobrevive a recargas y a cerrar el navegador, solo en este
// dispositivo. Funciones puras para serializar y leer (con versión y
// validación zod) y un par de accesos a localStorage a prueba de fallos.
//
// - Clave por usuario (`bbscloset:draft:{user_id}`): dos cuentas en el mismo
//   dispositivo no se pisan.
// - Sin imágenes: ids, hueco, posiciones y, si se conocen, tipo y aspecto
//   del recorte (para recolocar y nombrar la prenda antes de que llegue la red).
// - El historial no se guarda.
// - Un item roto se descarta y el resto se conserva; un borrador ilegible o
//   de otra versión se ignora entero.
import { reportStorageUnavailable } from "@/lib/storageNotice";
import { z } from "zod";
import { SLOT_IDS } from "@/lib/domain/slots";
import { GARMENT_TYPE_IDS, slotOfType, type GarmentTypeId } from "@/lib/domain/types";
import type { CanvasItem, CanvasState } from "./model";

export const DRAFT_VERSION = 1;

export function draftKey(userId: string): string {
  return `bbscloset:draft:${userId}`;
}

// En zod 4, z.number() ya rechaza NaN e Infinity.
const finite = z.number();

const draftItemSchema = z.object({
  garmentId: z.uuid(),
  slotId: z.enum(SLOT_IDS),
  typeId: z.enum(GARMENT_TYPE_IDS).optional(),
  aspect: finite.positive().optional(),
  x: finite,
  y: finite,
  scale: finite.positive(),
  rotation: finite,
  z: z.int(),
  locked: z.boolean(),
  manual: z.boolean(),
  placedAt: finite,
});

const draftSchema = z.object({
  v: z.literal(DRAFT_VERSION),
  items: z.array(z.unknown()),
});

export type DraftItem = z.output<typeof draftItemSchema>;

/** Lo que el borrador sabe de cada prenda, además de su item del lienzo. */
export type DraftGarmentInfo = { typeId?: GarmentTypeId; aspect?: number };

export type Draft = {
  canvas: CanvasState;
  /** Tipo y aspecto conocidos por id (para pintar y recolocar sin red). */
  garments: Record<string, DraftGarmentInfo>;
};

/** Convierte el lienzo en el texto que se guarda. */
export function serializeDraft(
  state: CanvasState,
  infoOf: (garmentId: string) => DraftGarmentInfo | undefined,
): string {
  const items: DraftItem[] = state.items.map((i) => {
    const info = infoOf(i.garmentId);
    return {
      garmentId: i.garmentId,
      slotId: i.slotId,
      ...(info?.typeId ? { typeId: info.typeId } : {}),
      ...(info?.aspect && info.aspect > 0 ? { aspect: info.aspect } : {}),
      x: i.x,
      y: i.y,
      scale: i.scale,
      rotation: i.rotation,
      z: i.z,
      locked: i.locked,
      manual: i.manual,
      placedAt: i.placedAt,
    };
  });
  return JSON.stringify({ v: DRAFT_VERSION, items });
}

/** Lee un borrador guardado; null si no hay o no se entiende. */
export function parseDraft(raw: string | null | undefined): Draft | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) return null;

  const items: CanvasItem[] = [];
  const garments: Record<string, DraftGarmentInfo> = {};
  for (const raw of parsed.data.items) {
    const res = draftItemSchema.safeParse(raw);
    if (!res.success) continue;
    const { typeId, aspect, ...item } = res.data;
    // Un tipo que no encaja con el hueco es un borrador manipulado: fuera.
    if (typeId && slotOfType(typeId) !== item.slotId) continue;
    if (garments[item.garmentId]) continue;
    items.push(item);
    garments[item.garmentId] = {
      ...(typeId ? { typeId } : {}),
      ...(aspect ? { aspect } : {}),
    };
  }
  return { canvas: { items }, garments };
}

// ---------------------------------------------------------------------------
// localStorage (modo privado, almacenamiento lleno o bloqueado: no pasa nada)

export function readDraft(userId: string): Draft | null {
  try {
    return parseDraft(window.localStorage.getItem(draftKey(userId)));
  } catch {
    reportStorageUnavailable();
    return null;
  }
}

export function writeDraft(userId: string, value: string): void {
  try {
    window.localStorage.setItem(draftKey(userId), value);
  } catch {
    // Sin almacenamiento el vestidor sigue funcionando; solo no persiste (con aviso).
    reportStorageUnavailable();
  }
}

// Prendas pendientes en el catálogo (paso 3.9, screens.md 4 y 6): lógica pura
// para fusionar los items locales de la cola con las filas del servidor.
//
// - Solo entran los items `kind: "garment"` con `garmentData` (tipo elegido)
//   que aún no se han subido. Los de la subida masiva sin tipo (`needsReview`
//   sin datos) van a la franja "por revisar" (3.12); los cambios de foto
//   (`replace`) y el recorte en lote (`batch`) no son prendas nuevas.
// - Respetan la vista y los filtros activos, comprobados en el cliente con
//   `garmentData` igual que los haría la API: una pendiente es una prenda "en
//   uso", así que en Archivadas no sale ninguna; hueco y tipos por `type_id`;
//   marcas y familias de color con O; etiquetas con Y (las del filtro son ids:
//   se comparan por nombre con las opciones cargadas; sin ellas, no encaja).
// - Van al principio, la más nueva primero (como `created_at desc`).
import type { Garment, TagRef } from "@/lib/api/types";
import { slotOfType } from "@/lib/domain/types";
import type { ColorFamilyId } from "@/lib/domain/colors";
import { colorFamily, normalizeHex } from "@/lib/imaging/colorFamily";
import type { GarmentData, QueueItem } from "@/features/queue/types";
import type { CatalogQuery } from "./store";

/** ¿Este item de la cola se enseña como prenda pendiente en la cuadrícula? */
export function isPendingGarment(item: QueueItem): boolean {
  return item.kind === "garment" && !!item.garmentData?.type_id && !item.uploaded;
}

/** Familia de color de los datos del formulario (como la calcula la API). */
export function pendingColorFamily(data: GarmentData): ColorFamilyId | null {
  if (data.color_family === "multicolor") return "multicolor";
  const hex = data.color_hex ? normalizeHex(data.color_hex) : null;
  return hex ? colorFamily(hex) : null;
}

const lower = (s: string) => s.toLocaleLowerCase();

/**
 * ¿Los datos de una prenda pendiente encajan con la vista y los filtros?
 * `tags`: las etiquetas conocidas (id → nombre) para traducir el filtro.
 */
export function pendingMatches(
  data: GarmentData,
  query: CatalogQuery,
  tags: readonly TagRef[] | null,
): boolean {
  if (query.view === "archived") return false;
  if (query.slot !== "all" && slotOfType(data.type_id) !== query.slot) return false;
  const f = query.filters;
  if (f.types.length > 0 && !f.types.includes(data.type_id)) return false;
  if (f.brands.length > 0) {
    const brand = data.brand ? lower(data.brand) : null;
    if (!brand || !f.brands.some((b) => lower(b) === brand)) return false;
  }
  if (f.colors.length > 0) {
    const family = pendingColorFamily(data);
    if (!family || !f.colors.includes(family)) return false;
  }
  if (f.tags.length > 0) {
    const own = new Set(data.tags.map(lower));
    const names = new Map((tags ?? []).map((t) => [t.id, lower(t.name)]));
    if (!f.tags.every((id) => own.has(names.get(id) ?? "\u0000"))) return false;
  }
  return true;
}

/**
 * Prendas pendientes que se ven en la cuadrícula, la más nueva primero.
 * `handoff`: items ya subidos cuya fila real aún no está en la lista; siguen
 * a la vista hasta que la sustituye (sin hueco ni salto).
 */
export function pendingForGrid(
  items: readonly QueueItem[],
  query: CatalogQuery,
  tags: readonly TagRef[] | null,
  handoff: readonly QueueItem[] = [],
): QueueItem[] {
  const seen = new Set<string>();
  const out: QueueItem[] = [];
  for (const item of [...handoff, ...items]) {
    if (seen.has(item.localId)) continue;
    const show = handoff.includes(item) ? !!item.garmentData : isPendingGarment(item);
    if (!show || !pendingMatches(item.garmentData!, query, tags)) continue;
    seen.add(item.localId);
    out.push(item);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Estado que enseña la tarjeta pendiente (subtítulo y etiqueta). */
export type PendingPhase = "cutting" | "uploading" | "cutError" | "uploadError";

export function pendingPhase(item: QueueItem): PendingPhase {
  if (item.status === "error") return "cutError";
  if (item.uploadError) return "uploadError";
  if (item.status === "ready") return "uploading";
  return "cutting";
}

/** ¿Encaja una fila del servidor con la vista y los filtros? (como la API) */
export function garmentMatches(g: Garment, query: CatalogQuery): boolean {
  if (g.archived !== (query.view === "archived")) return false;
  if (query.slot !== "all" && g.slot !== query.slot) return false;
  const f = query.filters;
  if (f.types.length > 0 && !f.types.includes(g.type_id)) return false;
  if (f.brands.length > 0 && (!g.brand || !f.brands.includes(g.brand))) return false;
  if (f.colors.length > 0 && (!g.color_family || !f.colors.includes(g.color_family))) return false;
  if (f.tags.length > 0) {
    const own = new Set(g.tags.map((t) => t.id));
    if (!f.tags.every((id) => own.has(id))) return false;
  }
  return true;
}

/** Orden de la API: `created_at desc, id desc`. */
function before(a: Garment, b: Garment): boolean {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  return ta !== tb ? ta > tb : a.id > b.id;
}

/**
 * Inserta (o sustituye) una prenda en su sitio de la lista. Si la lista no
 * está completa (`complete` false) y cae detrás de la última cargada, no se
 * mete: ya llegará con su página. Devuelve la lista nueva, o la misma si no cambia.
 */
export function insertGarment(items: readonly Garment[], g: Garment, complete: boolean): Garment[] {
  const rest = items.filter((x) => x.id !== g.id);
  const at = rest.findIndex((x) => before(g, x));
  if (at === -1) {
    if (!complete) return rest.length === items.length ? (items as Garment[]) : rest;
    return [...rest, g];
  }
  return [...rest.slice(0, at), g, ...rest.slice(at)];
}

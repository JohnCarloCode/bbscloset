// Aviso global de que una prenda ha cambiado en el catálogo (paso 5.5): lo
// emite el store del catálogo (editar, archivar, desarchivar, eliminar) y lo
// escuchan las pantallas que guardan datos en memoria (panel del vestidor,
// listado de favoritos) para no enseñar prendas que ya no valen al volver.
// Las prendas recién subidas siguen yendo por GARMENT_SAVED_EVENT (cola).
export const GARMENT_CHANGED_EVENT = "bbs:garment-changed";

export type GarmentChange = "archived" | "unarchived" | "deleted" | "updated";
/** Una o varias prendas (archivar en lote manda todas en un solo aviso). */
export type GarmentChangedDetail = { ids: string[]; change: GarmentChange };

/** Avisa del cambio (no hace nada fuera del navegador). */
export function emitGarmentChanged(ids: string[], change: GarmentChange): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<GarmentChangedDetail>(GARMENT_CHANGED_EVENT, { detail: { ids, change } }),
  );
}

/** Escucha los cambios; devuelve la función para dejar de escuchar. */
export function onGarmentChanged(handler: (detail: GarmentChangedDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<GarmentChangedDetail>).detail);
  window.addEventListener(GARMENT_CHANGED_EVENT, listener);
  return () => window.removeEventListener(GARMENT_CHANGED_EVENT, listener);
}

/**
 * Tipo de cambio al recibir la prenda actualizada: `prevArchived` es lo que
 * se sabía antes (undefined si no estaba en la lista). Una prenda archivada
 * cuenta siempre como "archived" (no debe estar en el vestidor).
 */
export function changeOf(garment: { archived: boolean }, prevArchived?: boolean): GarmentChange {
  if (garment.archived) return "archived";
  return prevArchived ? "unarchived" : "updated";
}

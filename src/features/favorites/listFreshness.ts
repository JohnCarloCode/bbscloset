// ¿Hay que volver a pedir el listado de favoritos? (paso 5.5)
// Con cacheComponents, Next oculta la página al salir (Activity) en vez de
// desmontarla: al volver se conserva el listado y vuelven a correr los
// efectos. Solo se recarga si nunca se cargó, si las URLs firmadas están a
// punto de caducar o si algo lo ha cambiado desde la última carga:
// - un favorito guardado (vestidor) o recolocado (detalle): markFavoritesChanged;
// - una prenda eliminada (el favorito pierde la prenda o desaparece) o
//   editada (otra foto, otro tipo): GARMENT_CHANGED_EVENT. Archivar o
//   desarchivar no cambia los favoritos (spec 2.5).
import { onGarmentChanged } from "@/features/catalog/garmentChanged";

/** Las URLs firmadas de las miniaturas duran 1 h. */
export const LIST_TTL_MS = 50 * 60 * 1000;

let version = 0;

/** Versión actual de "lo que ve el listado" (sube con cada cambio). */
export function favoritesVersion(): number {
  return version;
}

/** Algo ha cambiado los favoritos: el listado se recargará al volver. */
export function markFavoritesChanged(): void {
  version++;
}

onGarmentChanged(({ change }) => {
  if (change === "deleted" || change === "updated") markFavoritesChanged();
});

export type ListSnapshot = {
  /** ms de la última carga correcta (0 = nunca). */
  loadedAt: number;
  /** Versión con la que se hizo esa carga. */
  loadedVersion: number;
  status: "loading" | "ready" | "error";
};

export function needsReload(s: ListSnapshot, currentVersion: number, now: number): boolean {
  if (s.status !== "ready" || s.loadedAt === 0) return true;
  if (s.loadedVersion !== currentVersion) return true;
  return now - s.loadedAt > LIST_TTL_MS;
}

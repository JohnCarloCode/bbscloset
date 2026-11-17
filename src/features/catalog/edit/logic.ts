// Lógica pura de la ficha de prenda (paso 3.10), para probarla con Vitest.
import type { GarmentUsageResponse } from "@/lib/api/types";
import type { QueueItem } from "@/features/queue/types";

/** Cambio de foto pendiente (sin subir) de una prenda: el más reciente. */
export function pendingReplaceOf(
  items: readonly QueueItem[],
  garmentId: string,
): QueueItem | undefined {
  let last: QueueItem | undefined;
  for (const i of items) {
    if (i.kind !== "replace" || i.garmentId !== garmentId || i.uploaded) continue;
    if (!last || i.createdAt > last.createdAt) last = i;
  }
  return last;
}

/**
 * Frases del aviso antes de eliminar (screens.md 4.3, spec 3.4), en orden:
 * - usage: "Aparece en N favoritos." (si aparece en alguno);
 * - kept: que se quitará de ellos y el collage se recolocará (si ninguno se
 *   queda vacío);
 * - empty: "Esto eliminará también M favoritos que quedarían vacíos." (si alguno);
 * - irreversible: siempre.
 */
export type DeleteNotice =
  { key: "usage" | "kept" | "empty"; count: number } | { key: "irreversible" };

export function deleteNotices(usage: GarmentUsageResponse): DeleteNotice[] {
  const out: DeleteNotice[] = [];
  const favorites = Math.max(0, usage.favorites);
  const empty = Math.min(favorites, Math.max(0, usage.wouldEmpty));
  if (favorites > 0) {
    out.push({ key: "usage", count: favorites });
    out.push(empty > 0 ? { key: "empty", count: empty } : { key: "kept", count: favorites });
  }
  out.push({ key: "irreversible" });
  return out;
}

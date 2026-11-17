// Límite de 500 prendas en el cliente (decisión 3): al elegir fotos se
// cuenta lo del servidor (en uso + archivadas) más lo pendiente en la cola
// del dispositivo. La API lo vuelve a comprobar al subir.
import { apiFetch } from "@/lib/api/client";
import { GARMENT_LIMIT, type GarmentCountsResponse } from "@/lib/api/types";
import type { QueueItem } from "@/features/queue/types";

/**
 * Prendas nuevas de la cola que aún no están en el servidor (pendientes de
 * recorte, por revisar o por subir). Las ya subidas cuentan en el servidor;
 * los cambios de foto y el recorte en lote no crean prendas.
 */
export function localPendingGarments(items: readonly QueueItem[]): number {
  return items.filter((i) => i.kind === "garment" && !i.uploaded).length;
}

/** Cuántas prendas caben todavía. */
export function roomLeft(serverTotal: number, localPending: number, limit = GARMENT_LIMIT) {
  return Math.max(0, limit - serverTotal - localPending);
}

/**
 * Sitio libre ahora mismo. Si no se puede preguntar al servidor (sin red…)
 * devuelve null y no se bloquea: la API comprueba otra vez al subir.
 */
export async function fetchRoomLeft(items: readonly QueueItem[]): Promise<number | null> {
  try {
    const counts = await apiFetch<GarmentCountsResponse>("/api/garments/counts");
    return roomLeft(counts.inUse + counts.archived, localPendingGarments(items));
  } catch (err) {
    console.warn("[add-garment] no se pudo comprobar el límite", err);
    return null;
  }
}

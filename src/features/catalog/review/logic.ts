// "Por revisar" (screens.md 4.4, paso 3.12): lógica pura de la franja del
// catálogo y del orden de la hoja de revisión.
import { byArrival } from "@/features/queue/logic";
import type { QueueItem } from "@/features/queue/types";

/** ¿Item de la subida masiva aún sin tipo? (lo que cuenta la franja) */
export function isToReview(item: QueueItem): boolean {
  return item.kind === "garment" && !!item.needsReview && !item.garmentData && !item.uploaded;
}

/** Por revisar, por orden de llegada (el orden de la hoja). */
export function toReview(items: readonly QueueItem[]): QueueItem[] {
  return items.filter(isToReview).sort(byArrival);
}

/** Número de la franja "12 prendas por revisar". */
export function reviewCount(items: readonly QueueItem[]): number {
  return items.reduce((n, i) => (isToReview(i) ? n + 1 : n), 0);
}

/**
 * Una pasada de revisión, de una en una: el orden se fija al abrir la hoja
 * ("3 de 12"). Lo saltado sigue en la franja pero no vuelve a salir en esta
 * pasada; cuando no queda nada sin ver, la pasada acaba.
 */
export type ReviewSession = {
  order: string[];
  /** Posición en `order` de la que se revisa; -1 = acabó. */
  index: number;
  skipped: string[];
  /** Guardadas en esta pasada (para "12 prendas añadidas."). */
  added: number;
};

/** Empieza una pasada con lo que hay por revisar; null si no hay nada. */
export function startSession(items: readonly QueueItem[]): ReviewSession | null {
  const order = toReview(items).map((i) => i.localId);
  return order.length ? { order, index: 0, skipped: [], added: 0 } : null;
}

export function currentId(session: ReviewSession): string | null {
  return session.index >= 0 ? (session.order[session.index] ?? null) : null;
}

/**
 * Siguiente posición después de la actual (dando la vuelta): la primera que
 * sigue por revisar (`pending`) y no se ha saltado; -1 si no queda ninguna.
 */
export function nextIndex(
  session: Pick<ReviewSession, "order" | "index" | "skipped">,
  pending: ReadonlySet<string>,
): number {
  const { order, index, skipped } = session;
  for (let step = 1; step <= order.length; step++) {
    const i = (index + step) % order.length;
    const id = order[i];
    if (i !== index && pending.has(id) && !skipped.includes(id)) return i;
  }
  return -1;
}

/**
 * Pasa a la siguiente tras guardar, saltar, descartar o porque la actual
 * ya no está por revisar ("gone": quitada desde la hoja de la cola, p. ej.).
 */
export function advance(
  session: ReviewSession,
  pending: ReadonlySet<string>,
  action: "save" | "skip" | "discard" | "gone",
): ReviewSession {
  const id = currentId(session);
  const skipped = action === "skip" && id ? [...session.skipped, id] : session.skipped;
  const added = session.added + (action === "save" ? 1 : 0);
  return { ...session, skipped, added, index: nextIndex({ ...session, skipped }, pending) };
}

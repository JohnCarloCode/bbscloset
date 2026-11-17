// Lógica pura del recorte en lote (screens.md 13), para la página y Vitest.
import { byArrival } from "@/features/queue/logic";
import type { QueueItem } from "@/features/queue/types";

/** Los items del recorte en lote, por orden de llegada. */
export function batchItems(items: readonly QueueItem[]): QueueItem[] {
  return items.filter((i) => i.kind === "batch").sort(byArrival);
}

export type BatchSummary = {
  total: number;
  ready: number;
  failed: number;
  /** Queda alguna en cola o recortándose (estado 13.2). */
  busy: boolean;
  /**
   * Se perdería algo al salir: recortes listos sin descargar o fotos aún
   * por recortar (al salir se quitan de la cola). Las de error no cuentan.
   */
  unsaved: boolean;
};

/** Resumen de la tanda; `downloaded` = localIds ya descargados o compartidos. */
export function summarize(
  batch: readonly QueueItem[],
  downloaded: ReadonlySet<string>,
): BatchSummary {
  const ready = batch.filter((i) => i.status === "ready");
  const busy = batch.some((i) => i.status === "queued" || i.status === "cutting");
  return {
    total: batch.length,
    ready: ready.length,
    failed: batch.filter((i) => i.status === "error").length,
    busy,
    unsaved: busy || ready.some((i) => !downloaded.has(i.localId)),
  };
}

/**
 * ¿Este clic en un enlace sale de la página? (aviso de salida, 13.3). Solo
 * clics normales en enlaces internos a otra ruta: no los de teclas
 * modificadoras (pestaña nueva), `target` ajeno, `download` u otro origen.
 */
export function isLeavingClick(
  e: Pick<
    MouseEvent,
    "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented"
  >,
  anchor: { href: string; target: string; hasDownload: boolean },
  location: { origin: string; pathname: string },
): boolean {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (anchor.hasDownload || (anchor.target && anchor.target !== "_self")) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, location.origin);
  } catch {
    return false;
  }
  return url.origin === location.origin && url.pathname !== location.pathname;
}

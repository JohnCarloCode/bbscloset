// Subida masiva (screens.md 5.5, paso 3.12): lógica pura de la pantalla
// resumen. Tope de 30 fotos por tanda, reparto según el límite de 500
// (decisión 3) y el modo de recorte de cada foto.
import type { QueueMode } from "@/features/queue/types";
import type { ImagingErrorCode } from "@/lib/imaging/errors";

/** Fotos por tanda (spec.md 3.1). */
export const BULK_MAX = 30;

/** Una foto de la pantalla resumen. */
export type BulkEntry = {
  id: string;
  file: File;
  /** pending: aún se comprueba; ok: válida; invalid: falla `validate` (no se añade). */
  check: "pending" | "ok" | "invalid";
  /** Lo detectado: fondo transparente. */
  hasAlpha: boolean;
  mode: QueueMode;
  error?: ImagingErrorCode;
};

/** Se queda con las `max` primeras; `dropped` = las que sobran (para avisar). */
export function capBatch<T>(files: readonly T[], max = BULK_MAX): { files: T[]; dropped: number } {
  return { files: files.slice(0, max), dropped: Math.max(0, files.length - max) };
}

/** Modo propuesto según lo detectado (como el paso 2). */
export const detectedMode = (hasAlpha: boolean): QueueMode => (hasAlpha ? "as-is" : "cut");

/**
 * Ids de las fotos que se añadirán: las válidas, en orden, hasta el sitio
 * libre (`room`; null = no se sabe, entran todas y la API vuelve a comprobar).
 */
export function fittingIds(entries: readonly BulkEntry[], room: number | null): Set<string> {
  const valid = entries.filter((e) => e.check === "ok");
  const n = room === null ? valid.length : Math.min(valid.length, Math.max(0, room));
  return new Set(valid.slice(0, n).map((e) => e.id));
}

/** Válidas que no caben por el límite de 500. */
export function overLimit(entries: readonly BulkEntry[], room: number | null): number {
  if (room === null) return 0;
  const valid = entries.filter((e) => e.check === "ok").length;
  return Math.max(0, valid - Math.max(0, room));
}

/** Modo común de las fotos que se pueden usar, o null si hay de los dos. */
export function commonMode(entries: readonly BulkEntry[]): QueueMode | null {
  const usable = entries.filter((e) => e.check !== "invalid");
  if (usable.length === 0) return null;
  const first = usable[0].mode;
  return usable.every((e) => e.mode === first) ? first : null;
}

/** Fotos con fondo que se usarán "tal cual" (aviso de 5.2 en plural). */
export function asIsWithBackground(entries: readonly BulkEntry[], fitting: Set<string>): number {
  return entries.filter((e) => fitting.has(e.id) && e.mode === "as-is" && !e.hasAlpha).length;
}

// Lógica pura de la cola de recorte (sin IndexedDB, DOM ni red), para que
// el runner, la subida y la UI la compartan y se pueda probar con Vitest.
import type { ApiClientErrorCode } from "@/lib/api/client";
import type { QueueItem, QueueKind } from "./types";

/** Orden de llegada: createdAt y, a igualdad, localId. */
export function byArrival(a: QueueItem, b: QueueItem): number {
  return a.createdAt - b.createdAt || (a.localId < b.localId ? -1 : a.localId > b.localId ? 1 : 0);
}

/** garment y replace son prendas (cuentan en la píldora); batch no. */
export function isGarmentKind(kind: QueueKind): boolean {
  return kind === "garment" || kind === "replace";
}

const isActive = (item: QueueItem) => item.status === "queued" || item.status === "cutting";

/** Siguiente item que recortar: el primer `queued` por orden de llegada, de cualquier tipo. */
export function nextToCut(items: readonly QueueItem[]): QueueItem | undefined {
  return items.filter((i) => i.status === "queued").sort(byArrival)[0];
}

/**
 * Al arrancar la app: un recorte que se quedó a medias (`cutting`) vuelve a
 * `queued` y se repite desde cero. Devuelve los items (los recuperados, nuevos).
 */
export function recoverInterrupted(items: readonly QueueItem[]): QueueItem[] {
  return items.map((i) =>
    i.status === "cutting" ? { ...i, status: "queued", progress: 0, stage: undefined } : i,
  );
}

/** Posición en la cola (1 = el que se recorta ahora) entre los pendientes; 0 si no está. */
export function queuePosition(items: readonly QueueItem[], localId: string): number {
  return (
    items
      .filter(isActive)
      .sort(byArrival)
      .findIndex((i) => i.localId === localId) + 1
  );
}

/** Items de prendas de la tanda actual (lo que lista la hoja), por orden de llegada. */
export function garmentItems(items: readonly QueueItem[]): QueueItem[] {
  return items.filter((i) => isGarmentKind(i.kind)).sort(byArrival);
}

export type PillState = {
  visible: boolean;
  /** "Recortando {current} de {total}". */
  current: number;
  total: number;
  /** Listas (recortadas, subidas o no): "{ready} de {total} listas". */
  ready: number;
  /** 0–1 del recorte de prenda en marcha (anillo). */
  progress: number;
};

/**
 * Estado de la píldora (screens.md 6): solo cuenta prendas (garment y
 * replace), nunca el recorte en lote. Se ve mientras quede alguna en cola o
 * recortándose. `current` = las ya procesadas (listas o con error) + 1.
 */
export function pillState(items: readonly QueueItem[]): PillState {
  const garments = items.filter((i) => isGarmentKind(i.kind));
  const ready = garments.filter((i) => i.status === "ready").length;
  const failed = garments.filter((i) => i.status === "error").length;
  const total = garments.length;
  const running = garments.find((i) => i.status === "cutting");
  return {
    visible: garments.some(isActive),
    current: Math.min(total, ready + failed + 1),
    total,
    ready,
    progress: running?.progress ?? 0,
  };
}

/** ¿Hay que subir este item ya? (recortado, con lo necesario y sin error fijo). */
export function shouldUpload(item: QueueItem): boolean {
  if (item.status !== "ready" || item.uploaded || item.uploadError) return false;
  if (!item.cutout || !item.thumb) return false;
  if (item.kind === "garment") return !!item.garmentData?.type_id;
  if (item.kind === "replace") return !!item.garmentId;
  return false; // batch: nunca se sube
}

/** Siguiente item que subir (uno cada vez, por orden de llegada). */
export function nextToUpload(items: readonly QueueItem[]): QueueItem | undefined {
  return items.filter(shouldUpload).sort(byArrival)[0];
}

/**
 * ¿Acabó la tanda? Sin prendas en cola ni recortándose y sin subidas
 * pendientes. Devuelve las prendas nuevas subidas en la tanda (para el aviso
 * "5 prendas listas para el vestidor") o null si aún no ha acabado.
 */
export function finishedRound(items: readonly QueueItem[]): QueueItem[] | null {
  const garments = items.filter((i) => isGarmentKind(i.kind));
  if (garments.some((i) => isActive(i) || shouldUpload(i))) return null;
  return garments.filter((i) => i.uploaded);
}

/**
 * Cuántas prendas anunciar en "N prendas listas para el vestidor" al acabar
 * la tanda (screens.md 6): solo prendas nuevas (un cambio de foto no cuenta)
 * y no las que ya se anunciaron al guardar con el recorte hecho ("Añadida a
 * Capa base.", screens.md 5.3), para no dar dos avisos de la misma prenda.
 * Las guardadas mientras se recortaban ("Guardada. … estará lista…") sí
 * cuentan: ese segundo aviso es el que dice que ya están listas.
 */
export function readyAnnouncementCount(uploaded: readonly QueueItem[]): number {
  return uploaded.filter((i) => i.kind === "garment" && !i.announced).length;
}

/** Espera antes del reintento n.º `attempt` (1, 2…): 2 s, 4 s, 8 s… hasta 1 min. */
export function backoffDelay(attempt: number, baseMs = 2_000, maxMs = 60_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

/**
 * Qué hacer cuando falla una subida:
 * - retry: fallo pasajero (sin red, 5xx, Storage): esperar y repetir.
 * - reupload: faltan los archivos en Storage: volver a subirlos ya.
 * - done: la prenda ya existe (respuesta perdida en un intento anterior).
 * - fatal: no se arregla solo (límite de 500, datos no válidos, prenda borrada).
 * - stop: sesión caducada (apiFetch ya navega al login).
 */
export type UploadFailureAction = "retry" | "reupload" | "done" | "fatal" | "stop";

export function classifyUploadError(
  code: ApiClientErrorCode | "storage",
  status: number,
): UploadFailureAction {
  switch (code) {
    case "unauthorized":
      return "stop";
    case "upload_missing":
      return "reupload";
    case "conflict":
      return "done";
    case "network":
    case "storage":
    case "rate_limited":
    case "internal":
      return "retry";
    default:
      return status === 0 || status >= 500 ? "retry" : "fatal";
  }
}

/**
 * Señal para los bucles de recorte y subida: `wait()` queda pendiente hasta
 * el siguiente `wake()` (cambio en la lista, visibilidad, red o parada). Un
 * `wake()` sin nadie esperando se pierde: el bucle siempre vuelve a mirar el
 * estado antes de esperar, sin `await` entre medias.
 */
export function createWaker() {
  let resolve: (() => void) | null = null;
  return {
    wait: () => new Promise<void>((r) => (resolve = r)),
    wake: () => {
      const r = resolve;
      resolve = null;
      r?.();
    },
  };
}

// Línea de estado bajo la vista previa del recorte (screens.md 5.3). Pura:
// devuelve la clave de messages y sus valores.
import type { QueueItem } from "@/features/queue/types";
import { IMAGING_ERROR_MESSAGE } from "@/lib/imaging/errors";

type StatusKey =
  | `queue.status.${"position" | "preparing" | "cutting" | "done" | "asIsPhoto" | "asIsCutout" | "error"}`
  | (typeof IMAGING_ERROR_MESSAGE)[keyof typeof IMAGING_ERROR_MESSAGE];

export type PreviewStatus = {
  key: StatusKey;
  values?: Record<string, number>;
  /** Mostrar la barra rosa de progreso (en cola o recortando). */
  progress: number | null;
  /** Error: se ofrece "Cambiar foto". */
  failed: boolean;
};

/**
 * @param position posición en la cola (queuePosition), 1 = el que se recorta.
 * @param hasAlpha la foto original tenía transparencia (si se sabe).
 */
export function previewStatus(
  item: Pick<QueueItem, "status" | "stage" | "progress" | "mode" | "error">,
  position: number,
  hasAlpha?: boolean,
): PreviewStatus {
  switch (item.status) {
    case "queued":
      return {
        key: "queue.status.position",
        values: { position: Math.max(1, position) },
        progress: 0,
        failed: false,
      };
    case "cutting":
      return item.stage === "preparing"
        ? { key: "queue.status.preparing", progress: 0, failed: false }
        : {
            key: "queue.status.cutting",
            values: { percent: Math.round(item.progress * 100) },
            progress: item.progress * 100,
            failed: false,
          };
    case "error":
      return {
        key: item.error ? IMAGING_ERROR_MESSAGE[item.error] : "queue.status.error",
        progress: null,
        failed: true,
      };
    case "ready":
      return {
        key:
          item.mode === "cut"
            ? "queue.status.done"
            : hasAlpha === false
              ? "queue.status.asIsPhoto"
              : "queue.status.asIsCutout",
        progress: null,
        failed: false,
      };
  }
}

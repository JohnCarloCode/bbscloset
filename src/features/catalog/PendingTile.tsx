"use client";

// Tarjeta de una prenda pendiente de la cola (paso 3.9; DESIGN.md
// `garment-tile`: "Pending cut-out: thumbnail at 40% opacity plus
// status-badge"). Misma caja que GarmentTile: miniatura local (el recorte si
// ya existe; si no, la foto reducida) atenuada al 40 %, etiqueta "Recortando"
// con reloj (o la de error) y, debajo, el nombre y el estado: "Recortando…",
// "Subiendo…" o el error de la cola (screens.md 4 y 6). Tocarla abre la hoja
// de la cola. En modo selección (3.11) no se puede marcar: queda desactivada.
import { memo } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { ClockIcon } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { BlobImage } from "@/features/queue/BlobImage";
import { useQueueStore } from "@/features/queue/store";
import type { QueueItem } from "@/features/queue/types";
import { IMAGING_ERROR_MESSAGE } from "@/lib/imaging/errors";
import { displayName } from "./form/logic";
import { pendingPhase } from "./pending";

export type PendingTileProps = {
  item: QueueItem;
  /** Modo selección (3.11): las pendientes no se pueden seleccionar. */
  disabled?: boolean;
};

export const PendingTile = memo(function PendingTile({ item, disabled = false }: PendingTileProps) {
  const t = useTranslations();
  const openSheet = useQueueStore((s) => s.openSheet);
  const data = item.garmentData!;
  const title = displayName(data.name, t(`types.${data.type_id}`));
  const phase = pendingPhase(item);

  let status: string;
  if (phase === "cutError") {
    status = item.error ? t(IMAGING_ERROR_MESSAGE[item.error]) : t("queue.status.error");
  } else if (phase === "uploadError") {
    status =
      item.uploadError === "limit_reached"
        ? t("queue.uploadErrors.limit_reached")
        : t("queue.uploadErrors.other");
  } else {
    status = t(phase === "uploading" ? "catalog.pending.uploading" : "catalog.pending.cutting");
  }
  const failed = phase === "cutError" || phase === "uploadError";

  return (
    <button
      type="button"
      onClick={openSheet}
      disabled={disabled}
      aria-haspopup={disabled ? undefined : "dialog"}
      aria-label={t("catalog.pending.label", { name: title, status })}
      className={cx(
        "flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-hairline",
        "bg-canvas text-left active:scale-[0.98] disabled:cursor-not-allowed",
      )}
    >
      <span className="relative flex aspect-square items-center justify-center bg-canvas-parchment">
        <BlobImage
          blob={item.thumb ?? item.source}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-contain p-[19%] opacity-40"
        />
        <StatusBadge
          tone={failed ? "error" : "neutral"}
          className="absolute top-xs left-xs z-[1] inline-flex items-center gap-[4px] pl-[6px]"
        >
          {!failed && <ClockIcon />}
          {failed
            ? t(phase === "cutError" ? "queue.status.error" : "catalog.pending.notSaved")
            : t("catalog.pending.badge")}
        </StatusBadge>
      </span>
      <span className="flex min-w-0 flex-col gap-[2px] px-[14px] pt-[10px] pb-[14px]">
        <span className="truncate text-caption-strong text-ink">{title}</span>
        <span className="truncate text-fine-print leading-[1.5] text-ink-muted-48">{status}</span>
      </span>
    </button>
  );
});

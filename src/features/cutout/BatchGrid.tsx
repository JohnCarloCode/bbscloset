"use client";

// Cuadrícula del recorte en lote (screens.md 13.2): 3 columnas en móvil, 4 en
// tablet y 6 en escritorio. Cada foto con su estado: En cola (etiqueta
// blanca, atenuada), recortando (barra negra sobre la foto), lista (recorte
// sobre cuadros) y error (etiqueta negra). Las listas abren la hoja de
// detalle; las de error ofrecen quitarlas.
import { memo } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { BlobImage } from "@/features/queue/BlobImage";
import type { QueueItem } from "@/features/queue/types";

export type BatchGridProps = {
  items: readonly QueueItem[];
  /** Nombre del PNG de cada item (localId → nombre). */
  names: ReadonlyMap<string, string>;
  onOpen: (item: QueueItem) => void;
};

export function BatchGrid({ items, names, onOpen }: BatchGridProps) {
  return (
    <ul className="grid grid-cols-3 gap-[10px] tablet:grid-cols-4 desktop:grid-cols-6">
      {items.map((item) => (
        <li key={item.localId} className="min-w-0">
          <BatchTile item={item} name={names.get(item.localId) ?? ""} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

const tileBox =
  "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-hairline";

const BatchTile = memo(function BatchTile({
  item,
  name,
  onOpen,
}: {
  item: QueueItem;
  name: string;
  onOpen: (item: QueueItem) => void;
}) {
  const t = useTranslations();
  const percent = Math.round(item.progress * 100);

  if (item.status === "ready") {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
        aria-label={t("cutout.tile.label", { name, status: t("cutout.tile.ready") })}
        className={cx(tileBox, "cursor-pointer p-0 active:scale-[0.98]")}
      >
        <TransparencyChecker className="absolute inset-0" />
        <BlobImage
          blob={item.thumb ?? item.cutout ?? item.source}
          decoding="async"
          draggable={false}
          className="relative size-full object-contain p-sm"
        />
      </button>
    );
  }

  if (item.status === "error") {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
        aria-label={t("cutout.tile.label", { name, status: t("cutout.tile.error") })}
        className={cx(tileBox, "cursor-pointer bg-photo-backdrop p-0 active:scale-[0.98]")}
      >
        <BlobImage
          blob={item.source}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover opacity-35"
        />
        <StatusBadge tone="error" className="absolute top-xs right-xs left-xs z-[1] w-fit">
          {t("cutout.tile.error")}
        </StatusBadge>
      </button>
    );
  }

  // En cola o recortando: sin acción.
  const cutting = item.status === "cutting";
  const status = cutting
    ? item.stage === "preparing"
      ? t("queue.status.preparing")
      : t("queue.status.cutting", { percent })
    : t("cutout.tile.queued");
  return (
    <div
      role="img"
      aria-label={t("cutout.tile.label", { name, status })}
      className={cx(tileBox, "bg-photo-backdrop")}
    >
      <BlobImage
        blob={item.source}
        decoding="async"
        draggable={false}
        className={cx("absolute inset-0 size-full object-cover", !cutting && "opacity-55")}
      />
      {cutting ? (
        <ProgressBar
          tone="photo"
          value={item.stage === "preparing" ? 0 : percent}
          aria-label={status}
          className="absolute right-[10px] bottom-[10px] left-[10px] w-auto"
        />
      ) : (
        <StatusBadge className="absolute top-xs left-xs z-[1]">
          {t("cutout.tile.queued")}
        </StatusBadge>
      )}
    </div>
  );
});

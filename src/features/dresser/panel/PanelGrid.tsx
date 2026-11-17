"use client";

// Cuadrícula de prendas del panel del vestidor (screens.md 7.3 y 7.4):
// 4 columnas en el panel inferior y 3 en el de escritorio. Tarjetas
// `garment-tile` (DESIGN.md) compactas: miniatura cuadrada sobre
// canvas-parchment y el nombre debajo a 12 px. La que está en el lienzo
// lleva borde negro de 2 px y el nombre en negro (`aria-pressed`); tocarla
// otra vez la quita. Tocar una tarjeta no mueve nada del panel: no hay
// foco programático ni cambios de altura.
// Con `limit` solo se pintan esas tarjetas (una fila en el estado medio).
// Con `onLoadMore`, un centinela al final pide la página siguiente al
// acercarse dentro del contenedor con scroll (`scrollRoot`).
import { memo, useEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { useAddGarment } from "@/features/catalog/add/store";
import type { SlotId } from "@/lib/domain/slots";
import { useSignedSrc } from "@/lib/storage/useSignedSrc";
import { selectClosetEmpty, useDresserStore, type KnownGarment } from "../store";

const THUMB_SIZE = 320;
const PREFETCH_MARGIN = "0px 0px 400px 0px";

export type PanelGridProps = {
  slot: SlotId;
  columns: 3 | 4;
  /** Máximo de tarjetas visibles (estado medio: una fila). */
  limit?: number;
  /** Pide más al llegar al final (solo con scroll). */
  paginate?: boolean;
  scrollRoot?: RefObject<HTMLElement | null>;
  onTap: (g: KnownGarment) => void;
};

export function PanelGrid({ slot, columns, limit, paginate, scrollRoot, onTap }: PanelGridProps) {
  const t = useTranslations("dresser.panel");
  const tCommon = useTranslations("common");
  const tSlots = useTranslations("slots");
  const list = useDresserStore((s) => s.lists[slot]);
  const count = useDresserStore((s) => s.counts?.[slot]);
  const closetEmpty = useDresserStore(selectClosetEmpty);
  const garments = useDresserStore((s) => s.garments);
  const items = useDresserStore((s) => s.canvas.items);
  const loadSlot = useDresserStore((s) => s.loadSlot);
  const loadMore = useDresserStore((s) => s.loadMore);
  const openAdd = useAddGarment((a) => a.open);
  const sentinel = useRef<HTMLDivElement>(null);

  const onCanvas = new Set(items.map((i) => i.garmentId));
  const ids = list?.ids ?? [];
  const shown = limit !== undefined ? ids.slice(0, limit) : ids;
  const hasMore = paginate && list?.status === "ready" && list.nextCursor !== null;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore(slot);
      },
      { root: scrollRoot?.current ?? null, rootMargin: PREFETCH_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, slot, scrollRoot, ids.length]);

  const gridClass = cx("grid gap-x-[10px] gap-y-sm", columns === 4 ? "grid-cols-4" : "grid-cols-3");

  if (!list || (list.status === "loading" && ids.length === 0)) {
    return (
      <div className={gridClass} aria-hidden="true">
        {Array.from({ length: limit ?? columns * 2 }, (_, k) => (
          <div key={k} className="flex min-w-0 flex-col gap-[6px]">
            <div className="aspect-square rounded-lg bg-canvas-parchment motion-safe:animate-pulse" />
            <div className="h-3 w-2/3 rounded-xs bg-canvas-parchment" />
          </div>
        ))}
      </div>
    );
  }

  if (list.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-xs text-caption text-ink-muted-48">
        <span>{t("loadError")}</span>
        <Button
          variant="text-link"
          className="text-caption"
          onClick={() => void loadSlot(slot, true)}
        >
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  if (ids.length === 0 && (count ?? 0) === 0) {
    return (
      <p className="flex flex-wrap gap-x-[6px] text-caption text-ink-muted-48">
        <span>{closetEmpty ? t("closetEmpty") : t("empty", { slot })}</span>
        <button
          type="button"
          onClick={openAdd}
          className="cursor-pointer text-ink underline underline-offset-2"
        >
          {t("addOne")}
        </button>
      </p>
    );
  }

  return (
    <>
      <ul className={gridClass} aria-label={t("grid", { label: tSlots(slot) })}>
        {shown.map((id) => {
          const g = garments[id];
          if (!g) return null;
          return (
            <li key={id} className="min-w-0">
              <PanelTile garment={g} onCanvas={onCanvas.has(id)} onTap={onTap} />
            </li>
          );
        })}
      </ul>
      {hasMore && <div ref={sentinel} className="h-px" aria-hidden="true" />}
      {paginate && list.loadingMore && (
        <p role="status" className="py-sm text-center text-caption text-ink-muted-48">
          {t("loadingMore")}
        </p>
      )}
    </>
  );
}

type PanelTileProps = {
  garment: KnownGarment;
  onCanvas: boolean;
  onTap: (g: KnownGarment) => void;
};

const PanelTile = memo(function PanelTile({ garment, onCanvas, onTap }: PanelTileProps) {
  const tTypes = useTranslations("types");
  // URL firmada caducada → se renueva y se reintenta una vez (7.6).
  const { src: thumbUrl, onError } = useSignedSrc(garment.thumbUrl);
  const label = garment.label || tTypes(garment.typeId);

  return (
    <button
      type="button"
      aria-pressed={onCanvas}
      // Sin foco al tocar con el ratón/dedo: evita que el navegador desplace el panel.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onTap(garment)}
      className="flex w-full min-w-0 cursor-pointer flex-col gap-[6px] text-left"
    >
      <span
        className={cx(
          "relative flex aspect-square w-full items-center justify-center rounded-lg bg-canvas-parchment",
          onCanvas ? "border-2 border-ink" : "border-2 border-transparent",
        )}
      >
        {thumbUrl && (
          // Miniatura WebP ya reducida con URL firmada: sin next/image. Ocupa
          // ~72 % del cuadro, como en el prototipo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={onError}
            className="absolute inset-0 size-full object-contain p-[14%]"
          />
        )}
      </span>
      <span
        className={cx(
          "block w-full truncate text-fine-print leading-[1.3]",
          onCanvas ? "text-ink" : "text-ink-muted-48",
        )}
      >
        {label}
      </span>
    </button>
  );
});

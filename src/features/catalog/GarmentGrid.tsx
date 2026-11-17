"use client";

// Cuadrícula del catálogo (screens.md 4): columnas automáticas de 150 px como
// mínimo y scroll vertical. Al final, un centinela con IntersectionObserver
// pide la página siguiente un poco antes de llegar (scroll paginado por cursor).
// Las prendas pendientes de la cola (3.9) van al principio, antes de las del
// servidor (ver pending.ts y usePendingGarments.ts).
// Con `selectedIds` (modo selección, 3.11) las tarjetas son checkboxes y las
// pendientes quedan desactivadas.
import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import type { Garment } from "@/lib/api/types";
import type { QueueItem } from "@/features/queue/types";
import { GarmentTile } from "./GarmentTile";
import { PendingTile } from "./PendingTile";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-sm";
/** Margen por debajo de la pantalla con el que ya se pide la página siguiente. */
const PREFETCH_MARGIN = "0px 0px 600px 0px";

export type GarmentGridProps = {
  items: Garment[];
  /** Prendas pendientes de la cola ya filtradas, la más nueva primero. */
  pending?: ReadonlyArray<QueueItem>;
  hasMore: boolean;
  moreStatus: "idle" | "loading" | "ready" | "error";
  onLoadMore: () => void;
  onOpen?: (garment: Garment) => void;
  /** Modo selección (3.11): ids marcados (undefined = fuera del modo). */
  selectedIds?: ReadonlyArray<string>;
  onToggle?: (id: string) => void;
};

export function GarmentGrid({
  items,
  pending = [],
  hasMore,
  moreStatus,
  onLoadMore,
  onOpen,
  selectedIds,
  onToggle,
}: GarmentGridProps) {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasMore && moreStatus !== "loading" && moreStatus !== "error";
  const selecting = selectedIds !== undefined;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Se vuelve a observar cada vez que crece la lista: si el centinela sigue a
  // la vista tras una página (pantalla alta), el observer avisa otra vez.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoad) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canLoad, items.length, onLoadMore]);

  return (
    <div className="flex flex-col gap-sm">
      <ul className={GRID}>
        {pending.map((item) => (
          <li key={`pending-${item.localId}`} className="flex min-w-0 flex-col">
            <PendingTile item={item} disabled={selecting} />
          </li>
        ))}
        {items.map((g) => (
          <li key={g.id} className="flex min-w-0 flex-col">
            <GarmentTile
              garment={g}
              onOpen={onOpen}
              selecting={selecting}
              selected={selected.has(g.id)}
              onToggle={onToggle}
            />
          </li>
        ))}
        {moreStatus === "loading" && <TileSkeletons count={2} />}
      </ul>
      {moreStatus === "loading" && (
        <p className="sr-only" role="status">
          {t("loadingMore")}
        </p>
      )}
      {moreStatus === "error" && (
        <div className="flex flex-col items-center gap-xs py-lg text-center" role="alert">
          <p className="text-caption text-ink-muted-80">{t("loadMoreError")}</p>
          <Button variant="secondary" onClick={onLoadMore}>
            {tCommon("retry")}
          </Button>
        </div>
      )}
      {hasMore && <div ref={sentinel} aria-hidden="true" className="h-px" />}
    </div>
  );
}

/** Tarjetas vacías mientras se carga (sin animación si se pide menos movimiento). */
export function TileSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <li key={`skeleton-${i}`} aria-hidden="true" className="flex min-w-0 flex-col">
      <div className="flex flex-col overflow-hidden rounded-lg border border-hairline motion-safe:animate-pulse">
        <div className="aspect-square bg-canvas-parchment" />
        <div className="flex flex-col gap-[6px] px-[14px] pt-[12px] pb-[16px]">
          <div className="h-[12px] w-3/4 rounded-pill bg-canvas-parchment" />
          <div className="h-[10px] w-1/2 rounded-pill bg-canvas-parchment" />
        </div>
      </div>
    </li>
  ));
}

/** Primera carga: cuadrícula de esqueletos. */
export function GridSkeleton() {
  const t = useTranslations("catalog");
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <ul className={GRID}>
        <TileSkeletons count={8} />
      </ul>
    </div>
  );
}

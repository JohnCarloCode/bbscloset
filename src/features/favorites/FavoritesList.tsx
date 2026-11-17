"use client";

// Listado de favoritos (screens.md 10; spec 3.4 › Listado; paso 5.3):
// título, contador ("3 outfits guardados", de `total`) y enlace "Editar" ↔
// "Hecho"; cuadrícula de tarjetas (columnas de 150 px como mínimo, como el
// catálogo) con scroll paginado por cursor (IntersectionObserver).
// - Modo Editar: "Eliminar" en cada tarjeta, con confirmación ("Las prendas
//   siguen en tu armario."); al confirmar, DELETE, la tarjeta sale y el
//   contador baja. Si ya no quedan, se sale del modo.
// - Vacío: "Todavía no hay favoritos" + "Abrir el vestidor" (/dresser).
// - Carga: esqueletos; error: mensaje y "Reintentar".
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/toast";
import { isApiClientError } from "@/lib/api/client";
import type { FavoriteSummary } from "@/lib/api/types";
import { FavoriteCard } from "./FavoriteCard";
import { MINI_COLLAGE_RATIO } from "./miniCollageLayout";
import { useFavoritesList } from "./useFavoritesList";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-sm";
/** Margen por debajo de la pantalla con el que ya se pide la página siguiente. */
const PREFETCH_MARGIN = "0px 0px 600px 0px";

export function FavoritesList() {
  const t = useTranslations("favorites");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const { show } = useToast();
  const list = useFavoritesList();
  const [editing, setEditing] = useState(false);
  const [toDelete, setToDelete] = useState<FavoriteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ready = list.status === "ready";
  const hasItems = ready && list.items.length > 0;
  // Sin favoritos no hay nada que editar.
  const isEditing = editing && hasItems;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await list.remove(toDelete.id);
      setToDelete(null);
      show({ message: t("list.deleted") });
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      console.warn("[favorites] no se ha podido eliminar", err);
      setToDelete(null);
      show({
        message:
          isApiClientError(err) && err.code === "network"
            ? t("list.offline")
            : t("list.deleteError"),
      });
    } finally {
      setDeleting(false);
    }
  }

  const onDelete = useCallback((f: FavoriteSummary) => setToDelete(f), []);

  let body;
  if (list.status === "error") {
    body = (
      <div role="alert">
        <EmptyState
          illustration={false}
          title={t("list.error.title")}
          description={
            list.errorCode === "network" ? t("list.error.offline") : t("list.error.generic")
          }
          action={
            <Button variant="secondary" onClick={() => void list.load()}>
              {tCommon("retry")}
            </Button>
          }
        />
      </div>
    );
  } else if (!ready) {
    body = <FavoritesSkeleton />;
  } else if (list.items.length === 0) {
    body = (
      <EmptyState
        illustration={
          <div
            aria-hidden="true"
            className="w-[150px] rounded-lg border border-dashed border-body-muted bg-canvas-parchment"
            style={{ aspectRatio: MINI_COLLAGE_RATIO }}
          />
        }
        title={t("list.empty.title")}
        description={t("list.empty.description")}
        action={
          <Link href="/dresser" className={buttonClasses("primary")}>
            {t("list.empty.action")}
          </Link>
        }
      />
    );
  } else {
    body = (
      <FavoritesGrid
        items={list.items}
        editing={isEditing}
        onDelete={onDelete}
        hasMore={list.nextCursor !== null}
        moreStatus={list.moreStatus}
        onLoadMore={list.loadMore}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-md px-5 pt-xs pb-xl">
      <header className="flex items-end justify-between gap-sm pt-xs">
        <div className="flex min-w-0 flex-col gap-xxs">
          <h1 className="text-lead font-semibold">{tNav("favorites")}</h1>
          {/* Espacio reservado mientras llega el total: no salta. */}
          <p className="min-h-[1lh] text-caption text-ink-muted-48" aria-live="polite">
            {ready && t("savedCount", { count: list.total })}
          </p>
        </div>
        {hasItems && (
          <Button
            variant="text-link"
            onClick={() => setEditing(!isEditing)}
            aria-pressed={isEditing}
            className="px-xxs"
          >
            {isEditing ? tCommon("done") : tCommon("edit")}
          </Button>
        )}
      </header>
      {body}
      <Dialog
        open={toDelete !== null}
        title={t("list.confirm.title")}
        description={t("list.confirm.description")}
        confirmLabel={t("list.confirm.confirm")}
        cancelLabel={tCommon("cancel")}
        destructive
        confirmDisabled={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </main>
  );
}

type FavoritesGridProps = {
  items: FavoriteSummary[];
  editing: boolean;
  onDelete: (f: FavoriteSummary) => void;
  hasMore: boolean;
  moreStatus: "idle" | "loading" | "error";
  onLoadMore: () => void;
};

function FavoritesGrid({
  items,
  editing,
  onDelete,
  hasMore,
  moreStatus,
  onLoadMore,
}: FavoritesGridProps) {
  const t = useTranslations("favorites.list");
  const tCommon = useTranslations("common");
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasMore && moreStatus === "idle";

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
        {items.map((f) => (
          <li key={f.id} className="flex min-w-0 flex-col">
            <FavoriteCard favorite={f} editing={editing} onDelete={onDelete} />
          </li>
        ))}
        {moreStatus === "loading" && <CardSkeletons count={2} />}
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

function CardSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <li key={`skeleton-${i}`} aria-hidden="true" className="flex min-w-0 flex-col">
      <div className="flex flex-col overflow-hidden rounded-lg border border-hairline motion-safe:animate-pulse">
        <div className="bg-canvas-parchment" style={{ aspectRatio: MINI_COLLAGE_RATIO }} />
        <div className="flex flex-col gap-[6px] px-[14px] pt-[12px] pb-[16px]">
          <div className="h-[12px] w-3/4 rounded-pill bg-canvas-parchment" />
          <div className="h-[10px] w-1/2 rounded-pill bg-canvas-parchment" />
        </div>
      </div>
    </li>
  ));
}

/** Primera carga: cuadrícula de esqueletos (también el fallback de la página). */
export function FavoritesSkeleton() {
  const t = useTranslations("favorites.list");
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <ul className={GRID}>
        <CardSkeletons count={6} />
      </ul>
    </div>
  );
}

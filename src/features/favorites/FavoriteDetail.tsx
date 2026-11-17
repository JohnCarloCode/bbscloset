"use client";

// Detalle del favorito (screens.md 11; spec 3.4; paso 5.4).
// - Cabecera: "‹ Favoritos", título (nombre o fecha), "Guardado el … · N
//   prendas" e icono "Guardar como imagen" (6.2: abre ExportSheet con lo que
//   se ve en pantalla, también con cambios sin guardar). No hay renombrar
//   (screens 11 no lo pide).
// - Lienzo editable SIN panel: mover, redimensionar, rotar y orden. Sin
//   "Quitar" ni candado (no se quitan prendas y aquí no hay aleatorios), y sin
//   "Colocación automática" (no está en screens 11 ni en el prototipo).
// - Posiciones: las guardadas se respetan; las null se colocan con
//   `relayout` (autoLayout, como el vestidor) con el tamaño medido y el
//   aspecto real de cada recorte (onAspect). `draft` es el estado editado y
//   el lienzo pinta su versión recolocada.
// - Guardado explícito: con el primer cambio (isDirty) aparece la barra
//   "Cambios sin guardar · Cancelar · Guardar". Guardar → PATCH con las
//   posiciones de todas las prendas; Cancelar → vuelve al último guardado.
//   Sin autoguardado ni localStorage.
// - Salir con cambios (enlaces internos: "‹ Favoritos", pestañas, barra
//   lateral; recargar o cerrar) pide "¿Descartar cambios?" (useLeaveGuard).
// - Las prendas archivadas se siguen mostrando (spec 2.5), sin marca.
// - 404 (inexistente o ajeno) → "No encontrado" con enlace a Favoritos.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { ChevronLeftIcon, DownloadIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useLeaveGuard } from "@/features/cutout/useLeaveGuard";
import { OutfitCanvasLazy, type CanvasGarment } from "@/features/dresser/canvas/OutfitCanvasLazy";
import type { CanvasState } from "@/features/dresser/model";
import { relayout } from "@/features/dresser/store";
import { ExportSheet } from "@/features/export/ExportSheet";
import { apiFetch, isApiClientError, type ApiClientErrorCode } from "@/lib/api/client";
import type { Favorite } from "@/lib/api/types";
import type { CanvasSize } from "@/lib/layout/autoLayout";
import { favoritePatch, favoriteToCanvas, isDirty } from "./detailLogic";
import { markFavoritesChanged } from "./listFreshness";
import { UnsavedBar } from "./UnsavedBar";

type Loaded = {
  favorite: Favorite;
  /** Último estado guardado. */
  saved: CanvasState;
  /** Estado editado (los automáticos, sin recolocar). */
  draft: CanvasState;
};

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error"; code: ApiClientErrorCode }
  | ({ status: "ready" } & Loaded);

export function FavoriteDetail() {
  const { id } = useParams<{ id: string }>();
  // Otro favorito → estado nuevo.
  return <FavoriteDetailView key={id} id={id} />;
}

function FavoriteDetailView({ id }: { id: string }) {
  const t = useTranslations("favorites.detail");
  const tCommon = useTranslations("common");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Pide el favorito y devuelve el estado que toca (null: sesión caducada,
  // la página se va al login).
  const fetchFavorite = useCallback(async (): Promise<LoadState | null> => {
    try {
      const favorite = await apiFetch<Favorite>(`/api/favorites/${encodeURIComponent(id)}`);
      const saved = favoriteToCanvas(favorite);
      return { status: "ready", favorite, saved, draft: saved };
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return null;
      if (isApiClientError(err) && err.status === 404) {
        // Ya no existe (p. ej. se borró su única prenda): el listado se recargará.
        markFavoritesChanged();
        return { status: "notFound" };
      }
      console.warn("[favorites] no se ha podido cargar el favorito", err);
      return { status: "error", code: isApiClientError(err) ? err.code : "unknown" };
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    void fetchFavorite().then((next) => {
      if (alive && next) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [fetchFavorite]);

  const retry = () => {
    setState({ status: "loading" });
    void fetchFavorite().then((next) => next && setState(next));
  };

  if (state.status === "ready")
    return (
      <Editor
        id={id}
        loaded={state}
        onChange={(patch) => setState((s) => (s.status === "ready" ? { ...s, ...patch } : s))}
        onNotFound={() => setState({ status: "notFound" })}
      />
    );

  return (
    <main className="flex min-h-[calc(100dvh-var(--tab-bar-h))] flex-col px-5 pb-xl">
      <BackLink />
      {state.status === "loading" && (
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
      )}
      {state.status === "notFound" && (
        <EmptyState
          title={t("notFound.title")}
          description={t("notFound.description")}
          action={
            <Link href="/favorites" className={buttonClasses("primary")}>
              {t("notFound.action")}
            </Link>
          }
        />
      )}
      {state.status === "error" && (
        <EmptyState
          title={t("error.title")}
          description={state.code === "network" ? t("error.offline") : t("error.generic")}
          action={
            <Button variant="secondary" onClick={retry}>
              {tCommon("retry")}
            </Button>
          }
        />
      )}
    </main>
  );
}

function BackLink() {
  const t = useTranslations("favorites.detail");
  return (
    <Link
      href="/favorites"
      className="-ml-[6px] flex min-h-11 items-center gap-[2px] self-start text-body text-ink"
    >
      <ChevronLeftIcon />
      {t("back")}
    </Link>
  );
}

function Editor({
  id,
  loaded,
  onChange,
  onNotFound,
}: {
  id: string;
  loaded: Loaded;
  onChange: (patch: Partial<Loaded>) => void;
  onNotFound: () => void;
}) {
  const t = useTranslations("favorites.detail");
  const format = useFormatter();
  const { show } = useToast();
  const tTypes = useTranslations("types");
  const { favorite, saved, draft } = loaded;
  // Datos de cada prenda para el lienzo: los recortes firmados de la carga
  // (al guardar no se sustituyen, para no volver a descargarlos).
  const garments = useMemo(() => {
    const out: Record<string, CanvasGarment> = {};
    for (const i of favorite.items)
      out[i.garment_id] = {
        id: i.garment_id,
        cutoutUrl: i.cutoutUrl,
        label: i.name || tTypes(i.type_id),
      };
    return out;
  }, [favorite, tTypes]);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  // Cada apertura monta la hoja de nuevo (key), así empieza limpia.
  const [imgSheet, setImgSheet] = useState({ open: false, key: 0 });
  const canvasBox = useRef<HTMLDivElement>(null);

  const date = format.dateTime(new Date(favorite.created_at), "short");
  const title = favorite.name || date;

  // Tamaño del lienzo: los automáticos se recolocan al cambiar.
  useEffect(() => {
    const el = canvasBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const width = Math.round(e.contentRect.width);
      const height = Math.round(e.contentRect.height);
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onAspect = useCallback((garmentId: string, aspect: number) => {
    setAspects((a) => (a[garmentId] === aspect ? a : { ...a, [garmentId]: aspect }));
  }, []);

  const laid = useMemo(() => relayout(draft, (gid) => aspects[gid], size), [draft, aspects, size]);
  const dirty = isDirty(saved, draft);
  const { leaving, stay, leave } = useLeaveGuard(dirty);

  const cancel = () => onChange({ draft: saved });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    // Lo que se manda queda como último guardado (si mientras tanto se ha
    // movido algo, sigue habiendo cambios).
    const sent = laid;
    try {
      await apiFetch<Favorite>(`/api/favorites/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: favoritePatch(sent),
      });
      onChange({ saved: sent });
      markFavoritesChanged();
      show({ message: t("saved") });
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      if (isApiClientError(err) && err.status === 404) {
        markFavoritesChanged();
        onNotFound();
        return;
      }
      console.warn("[favorites] no se han podido guardar los cambios", err);
      const code = isApiClientError(err) ? err.code : "unknown";
      show({
        message:
          code === "network"
            ? t("offline")
            : code === "invalid_garments"
              ? t("invalidGarments")
              : t("saveError"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative flex h-[calc(100dvh-var(--tab-bar-h))] min-h-0 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between pr-[10px] pl-[14px]">
        <BackLink />
        <button
          type="button"
          aria-label={t("saveImage")}
          title={t("saveImage")}
          disabled={laid.items.length === 0}
          onClick={() => setImgSheet((s) => ({ open: true, key: s.key + 1 }))}
          className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink disabled:cursor-default disabled:opacity-30"
        >
          <DownloadIcon />
        </button>
      </div>
      <header className="flex shrink-0 flex-col gap-xxs px-5 pb-sm">
        <h1 className="truncate text-lead font-semibold">{title}</h1>
        <p className="text-caption text-ink-muted-48">
          {t("subtitle", { date, count: favorite.items.length })}
        </p>
      </header>
      <div className="min-h-0 flex-1 px-4">
        <div ref={canvasBox} className="relative h-full w-full">
          <OutfitCanvasLazy
            items={laid.items}
            garments={garments}
            editable
            allowRemove={false}
            allowLock={false}
            onChange={(next) => onChange({ draft: next })}
            onAspect={onAspect}
          />
        </div>
      </div>
      <p className="min-h-16 shrink-0 px-5 pt-sm pb-md text-caption text-ink-muted-48">
        {t("help")}
      </p>
      {dirty && (
        <UnsavedBar
          className="absolute inset-x-0 bottom-0 z-20"
          saving={saving}
          onCancel={cancel}
          onSave={() => void save()}
        />
      )}
      <ExportSheet
        key={imgSheet.key}
        open={imgSheet.open && laid.items.length > 0}
        onClose={() => setImgSheet((s) => ({ ...s, open: false }))}
        items={laid.items}
        garments={garments}
        canvasSize={size}
        name={favorite.name}
        date={new Date(favorite.created_at)}
      />
      <Dialog
        open={leaving}
        title={t("leave.title")}
        description={t("leave.body")}
        confirmLabel={t("leave.confirm")}
        cancelLabel={t("leave.cancel")}
        destructive
        onConfirm={leave}
        onCancel={stay}
      />
    </main>
  );
}

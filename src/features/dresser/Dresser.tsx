"use client";

// Pantalla del vestidor (screens.md 7; paso 4.4): lienzo editable arriba y
// panel de prendas. En móvil y tablet el panel es inferior con tres alturas
// (BottomDrawer); en extendido, pantalla partida (el lienzo se encoge y se
// recoloca solo). En escritorio (≥ 1024 px), panel fijo a la derecha
// (DesktopPanel) y el lienzo ocupa el resto.
// - Todo cambio del lienzo pasa por el store (commit / tapGarment).
// - Los recortes se piden solo para las prendas del lienzo
//   (GET /api/garments/[id]); el panel usa las miniaturas.
// - Bajo el lienzo, la fila de aleatorios (RandomBar, 4.5); los avisos de
//   tocar una prenda (vestido que sustituye, joyería al máximo) salen como
//   toasts con "Deshacer".
// - Cabecera con Deshacer · Rehacer (DresserHeader, 4.6). El borrador se
//   restaura al entrar (store.enter) y se escribe en localStorage con cada
//   cambio del lienzo (useDraftWriter). "Colocación automática" arriba a la
//   derecha del lienzo, solo con ajustes manuales.
// - Estados vacíos (4.7) superpuestos al lienzo: "Un lienzo en blanco" o,
//   sin prendas en uso, "Tu armario está vacío" + "Añadir una prenda".
import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { useAddGarment } from "@/features/catalog/add/store";
import { GARMENT_SAVED_EVENT } from "@/features/queue/store";
import { apiFetch } from "@/lib/api/client";
import type { Garment } from "@/lib/api/types";
import { OutfitCanvasLazy } from "./canvas/OutfitCanvasLazy";
import { serializeDraft, writeDraft } from "./draft";
import { DresserHeader } from "./DresserHeader";
import { hasManual } from "./model";
import { BottomDrawer } from "./panel/BottomDrawer";
import { RandomBar } from "./RandomBar";
import { DesktopPanel } from "./panel/DesktopPanel";
import { selectClosetEmpty, toKnownGarment, useDresserStore, type KnownGarment } from "./store";
import { useCanvasGarments } from "./useCanvasGarments";
import { useDresserToasts } from "./useDresserToasts";

/** Pide el recorte de las prendas del lienzo que aún no lo tienen. */
function useCanvasCutouts() {
  const items = useDresserStore((s) => s.canvas.items);
  const garments = useDresserStore((s) => s.garments);
  const setCutout = useDresserStore((s) => s.setCutout);
  // Mientras se comprueba el lienzo en lote (borrador), los recortes llegan con él.
  const syncing = useDresserStore((s) => s.syncing);
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    if (syncing) return;
    for (const { garmentId } of items) {
      if (garments[garmentId]?.cutoutUrl !== undefined || inflight.current.has(garmentId)) continue;
      inflight.current.add(garmentId);
      apiFetch<Garment>(`/api/garments/${garmentId}`)
        .then((g) => setCutout({ ...toKnownGarment(g), cutoutUrl: g.cutoutUrl ?? null }))
        .catch(() => {
          // Se reintenta en el siguiente cambio del lienzo.
        })
        .finally(() => inflight.current.delete(garmentId));
    }
  }, [items, garments, setCutout, syncing]);
}

/**
 * Texto sobre el lienzo vacío (screens 7.1). Solo cuando ya se sabe si hay
 * borrador y prendas, para no enseñarlo un instante antes de restaurar.
 */
function CanvasEmptyState() {
  const t = useTranslations("dresser.canvas");
  const openAdd = useAddGarment((a) => a.open);
  const empty = useDresserStore((s) => s.canvas.items.length === 0);
  const known = useDresserStore(
    (s) => s.draftOwner !== null && (s.counts !== null || s.countsError),
  );
  const closetEmpty = useDresserStore(selectClosetEmpty);
  if (!empty || !known) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-xs p-6 text-center">
      <p className="text-body-strong">{closetEmpty ? t("closetEmptyTitle") : t("emptyTitle")}</p>
      {closetEmpty ? (
        <Button variant="secondary" className="pointer-events-auto mt-xs" onClick={openAdd}>
          {t("addGarment")}
        </Button>
      ) : (
        <p className="max-w-[240px] text-caption text-ink-muted-48">{t("emptyBody")}</p>
      )}
    </div>
  );
}

/** Pausa antes de escribir el borrador (un gesto o un reajuste encadenan cambios). */
const DRAFT_DEBOUNCE_MS = 300;

/**
 * Escribe el borrador (draft.ts) con cada cambio del presente, con un poco
 * de pausa, y sin esperar al salir de la pantalla o de la pestaña. No
 * escribe nada hasta saber de quién es (store.draftOwner).
 */
function useDraftWriter() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const flush = () => {
      clearTimeout(timer);
      if (!pending) return;
      pending = false;
      const { draftOwner, canvas, garments } = useDresserStore.getState();
      if (!draftOwner) return;
      writeDraft(
        draftOwner,
        serializeDraft(canvas, (id) => {
          const g = garments[id];
          return g ? { typeId: g.typeId, aspect: g.aspect } : undefined;
        }),
      );
    };
    const unsubscribe = useDresserStore.subscribe((s, prev) => {
      if (!s.draftOwner || (s.canvas === prev.canvas && s.draftOwner === prev.draftOwner)) return;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(flush, DRAFT_DEBOUNCE_MS);
    });
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      flush();
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);
}

export function Dresser() {
  const tNav = useTranslations("nav");
  const tCanvas = useTranslations("dresser.canvas");
  const items = useDresserStore((s) => s.canvas.items);
  const drawer = useDresserStore((s) => s.drawer);
  const activeSlot = useDresserStore((s) => s.activeSlot);
  const commit = useDresserStore((s) => s.commit);
  const showAutoArrange = useDresserStore((s) => hasManual(s.canvas));
  const autoArrange = useDresserStore((s) => s.autoArrange);
  const tapGarment = useDresserStore((s) => s.tapGarment);
  const setCanvasSize = useDresserStore((s) => s.setCanvasSize);
  const setAspect = useDresserStore((s) => s.setAspect);
  const setSelected = useDresserStore((s) => s.setSelected);
  const loadSlot = useDresserStore((s) => s.loadSlot);
  const canvasBox = useRef<HTMLDivElement>(null);

  useCanvasCutouts();
  useDraftWriter();

  // Al entrar: perfil, borrador y prendas del lienzo comprobadas (las
  // archivadas mientras tanto se quitan); y los recuentos.
  useEffect(() => {
    const s = useDresserStore.getState();
    void s.enter();
    if (!s.counts) void s.loadCounts();
  }, []);

  // Lista de la categoría activa (de la caché si es reciente).
  useEffect(() => {
    void loadSlot(activeSlot);
  }, [activeSlot, loadSlot]);

  // Prenda nueva subida por la cola: listas y recuentos se vuelven a pedir.
  useEffect(() => {
    const onSaved = () => {
      const s = useDresserStore.getState();
      s.invalidate();
      void s.loadSlot(s.activeSlot);
    };
    window.addEventListener(GARMENT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(GARMENT_SAVED_EVENT, onSaved);
  }, []);

  // Tamaño del lienzo: al cambiar (pantalla partida, giro) se recoloca.
  useEffect(() => {
    const el = canvasBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setCanvasSize({
        width: Math.round(e.contentRect.width),
        height: Math.round(e.contentRect.height),
      }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [setCanvasSize]);

  const canvasGarments = useCanvasGarments(items);

  const { showTapEvents } = useDresserToasts();
  const onTap = useCallback(
    (g: KnownGarment) => showTapEvents(g.id, g.slot, tapGarment(g)),
    [tapGarment, showTapEvents],
  );

  return (
    <main className="flex h-[calc(100dvh-var(--tab-bar-h))] min-h-0 flex-col overflow-hidden desktop:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DresserHeader title={tNav("dresser")} />
        <div className="min-h-0 flex-1 px-4 pb-sm desktop:pb-5">
          <div ref={canvasBox} className="relative h-full w-full">
            <OutfitCanvasLazy
              items={items}
              garments={canvasGarments}
              editable
              onChange={(next) => commit(next)}
              onSelect={setSelected}
              onAspect={setAspect}
            />
            <CanvasEmptyState />
            {showAutoArrange && (
              <button
                type="button"
                onClick={autoArrange}
                title={tCanvas("autoArrangeHint")}
                className="absolute top-[10px] right-[10px] z-20 h-8 cursor-pointer rounded-md border-[3px] border-divider-soft bg-surface-pearl px-3 text-[13px] whitespace-nowrap text-ink-muted-80 select-none active:scale-95"
              >
                {tCanvas("autoArrange")}
              </button>
            )}
          </div>
        </div>
        {/* Fila de aleatorios (4.5): se oculta en pantalla partida. */}
        <RandomBar className={cx(drawer === "expanded" && "hidden desktop:flex")} />
        <BottomDrawer onTap={onTap} className="desktop:hidden" />
      </div>
      <DesktopPanel onTap={onTap} className="hidden desktop:flex" />
    </main>
  );
}

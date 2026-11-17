"use client";

// Pantalla del catálogo (screens.md 4): cabecera, En uso · Archivadas (N),
// chips de hueco y cuadrícula paginada, con sus estados de carga, error y
// vacío. El estado vive en store.ts (zustand) y se refleja en la URL
// (useUrlSync.ts; por eso la página lo envuelve en <Suspense>).
// Filtros (3.4): botón "Filtros · N" delante de los huecos, hoja de filtros y
// chips de filtros activos debajo.
// "Añadir" y el estado vacío abren la hoja global de añadir prenda (3.7).
// Prendas pendientes de la cola (3.9): al principio de la cuadrícula; el
// contador de la cabecera solo cuenta las del servidor (decisión 4).
// Tocar una tarjeta abre su ficha (3.10, edit/GarmentSheet.tsx).
// Selección en lote (3.11, screens.md 4.2): "Seleccionar" en la cabecera,
// tarjetas marcables y barra inferior con "Archivar"/"Desarchivar" y aviso con
// "Deshacer". Se sale con "Cancelar", Escape, al cambiar de vista (store.ts)
// o al salir de la pantalla.
// Franja "N prendas por revisar · Revisar" (3.12, screens.md 4.4) bajo la
// cabecera, salvo en modo selección (como el prototipo).
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { FiltersIcon } from "@/components/icons";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useToast } from "@/components/toast";
import { cx } from "@/components/cx";
import { isApiClientError } from "@/lib/api/client";
import type { Garment } from "@/lib/api/types";
import { ActiveFilters } from "./ActiveFilters";
import { CatalogHeader } from "./CatalogHeader";
import { EmptyCloset, NoResults } from "./EmptyStates";
import { FiltersSheet } from "./FiltersSheet";
import { GarmentGrid, GridSkeleton } from "./GarmentGrid";
import { SelectionBar } from "./SelectionBar";
import { SlotChips } from "./SlotChips";
import { GarmentSheet } from "./edit/GarmentSheet";
import { useAddGarment } from "./add/store";
import { ReviewBanner } from "./review/ReviewBanner";
import { activeFilterCount, isAllSelected, useCatalogStore, type CatalogView } from "./store";
import { usePendingGarments } from "./usePendingGarments";
import { useCatalogUrlSync } from "./useUrlSync";

export function Catalog() {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");
  const s = useCatalogStore();
  const onAdd = useAddGarment((a) => a.open);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Prenda con la ficha abierta (3.10).
  const [opened, setOpened] = useState<Garment | null>(null);
  const closeSheet = useCallback(() => setOpened(null), []);
  const pending = usePendingGarments();
  const { show } = useToast();
  // Petición en curso del modo selección: "Seleccionar todo" o archivar.
  const [busy, setBusy] = useState<"selectAll" | "archive" | null>(null);

  // Al entrar se piden datos frescos (y URLs firmadas nuevas) con la vista,
  // el hueco y los filtros de la URL (o los que hubiera).
  useCatalogUrlSync();

  // Al salir a otra pantalla (Activity la oculta) la hoja se cierra.
  // Lo mismo con el modo selección (3.11: al cambiar de pestaña se sale).
  useLayoutEffect(
    () => () => {
      setFiltersOpen(false);
      setOpened(null);
      useCatalogStore.getState().setSelecting(false);
    },
    [],
  );

  // Escape sale del modo selección (si no lo ha usado antes una hoja abierta).
  const selecting = s.selecting;
  const setSelecting = s.setSelecting;
  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setSelecting(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selecting, setSelecting]);

  /** Error de una acción de la selección (401: apiFetch ya lleva al login). */
  const failed = (err: unknown, message: string) => {
    if (isApiClientError(err) && err.code === "unauthorized") return;
    show({ message });
  };

  async function selectAll() {
    if (busy) return;
    setBusy("selectAll");
    try {
      await s.selectAll();
    } catch (err) {
      failed(err, t("select.selectAllError"));
    } finally {
      setBusy(null);
    }
  }

  async function archiveSelected() {
    const ids = s.selectedIds;
    if (busy || ids.length === 0) return;
    // En En uso se archiva; en Archivadas se desarchiva.
    const archived = s.view === "active";
    setBusy("archive");
    try {
      await s.setArchived(ids, archived);
      s.setSelecting(false);
      show({
        message: t(archived ? "select.archived" : "select.unarchived", { count: ids.length }),
        actionLabel: tCommon("undo"),
        onAction: () => {
          useCatalogStore
            .getState()
            .setArchived(ids, !archived)
            .catch((err: unknown) => failed(err, t("select.error")));
        },
      });
    } catch (err) {
      failed(err, t("select.error"));
    } finally {
      setBusy(null);
    }
  }

  const nFilters = activeFilterCount(s.filters);

  const counts = s.counts;
  const total = counts ? counts.inUse + counts.archived : 0;
  const firstLoad = s.status === "loading" || s.status === "idle";

  let body;
  if (s.status === "error") {
    body = (
      <div role="alert">
        <EmptyState
          illustration={false}
          title={t("error.title")}
          description={s.errorCode === "network" ? t("error.offline") : t("error.generic")}
          action={
            <Button variant="secondary" onClick={() => void s.load()}>
              {tCommon("retry")}
            </Button>
          }
        />
      </div>
    );
  } else if (firstLoad || !counts) {
    body = <GridSkeleton />;
  } else if (s.items.length === 0 && pending.length === 0) {
    const noArchived = s.view === "archived" && nFilters === 0;
    body = <NoResults kind={noArchived ? "noArchived" : "noResults"} />;
  } else {
    body = (
      <GarmentGrid
        items={s.items}
        pending={pending}
        hasMore={s.nextCursor !== null}
        moreStatus={s.moreStatus}
        onLoadMore={s.loadMore}
        onOpen={setOpened}
        selectedIds={s.selecting ? s.selectedIds : undefined}
        onToggle={s.toggleSelected}
      />
    );
  }

  // Armario vacío (nada en uso ni archivado, ni pendiente en la vista):
  // solo la cabecera y la invitación a añadir.
  const emptyCloset =
    s.status === "ready" && counts !== null && total === 0 && pending.length === 0;

  return (
    <main
      className={cx(
        "mx-auto flex w-full max-w-[1200px] flex-col gap-md px-5 pt-xs pb-xl",
        // Hueco para que la barra de selección no tape la última fila.
        s.selecting && "pb-[calc(var(--selection-bar-h)+var(--spacing-xl))]",
      )}
    >
      <CatalogHeader
        counts={counts}
        onAdd={onAdd}
        canSelect={!emptyCloset && s.status === "ready" && s.items.length > 0}
        selecting={s.selecting}
        allSelected={isAllSelected(s.selectedIds, s.allIds)}
        selectingAll={busy === "selectAll"}
        onSelect={() => s.setSelecting(true)}
        onSelectAll={() => void selectAll()}
        onSelectNone={() => s.setSelected([])}
      />
      {!s.selecting && <ReviewBanner />}
      {emptyCloset ? (
        <EmptyCloset onAdd={onAdd} />
      ) : (
        <>
          <div className="flex flex-col gap-sm">
            <SegmentedControl<CatalogView>
              aria-label={t("viewLabel")}
              className="max-w-[360px]"
              value={s.view}
              onChange={s.setView}
              options={[
                { value: "active", label: t("inUse") },
                { value: "archived", label: t("archived", { count: counts?.archived ?? 0 }) },
              ]}
            />
            {counts && (
              <SlotChips
                counts={counts}
                view={s.view}
                value={s.slot}
                onChange={s.setSlot}
                leading={
                  <>
                    <Chip
                      selected={nFilters > 0}
                      onClick={() => setFiltersOpen(true)}
                      aria-haspopup="dialog"
                      aria-label={t("filters.buttonLabel", { count: nFilters })}
                      className="shrink-0 gap-[6px] whitespace-nowrap"
                    >
                      <FiltersIcon />
                      {nFilters > 0
                        ? t("filters.buttonCount", { count: nFilters })
                        : t("filters.button")}
                    </Chip>
                    {/* Separador entre el botón y los huecos, como el prototipo. */}
                    <span aria-hidden="true" className="my-[6px] w-px shrink-0 bg-hairline" />
                  </>
                }
              />
            )}
            <ActiveFilters />
          </div>
          {body}
        </>
      )}
      {filtersOpen && <FiltersSheet onClose={() => setFiltersOpen(false)} />}
      {opened && <GarmentSheet key={opened.id} garment={opened} onClose={closeSheet} />}
      {s.selecting && (
        <SelectionBar
          view={s.view}
          count={s.selectedIds.length}
          busy={busy === "archive"}
          onConfirm={() => void archiveSelected()}
          onCancel={() => s.setSelecting(false)}
        />
      )}
    </main>
  );
}

"use client";

// Hoja de filtros del catálogo (screens.md 4.1, paso 3.4): secciones Tipo
// (según el hueco elegido), Marca, Color y Etiquetas en chips multiselección,
// nota sobre la Y, "Borrar" arriba y "Ver N prendas" abajo. El Color no está
// en screens 4.1 ni en el prototipo, pero lo pide la spec (3.1): sus chips
// llevan la muestra de la familia y solo salen las familias con prendas en la
// vista (recuentos de GET /api/garments/counts).
// - Los cambios son provisionales: solo se aplican con el botón principal;
//   cerrar la hoja (X, Escape, fondo) los descarta.
// - El recuento del botón sale de GET /api/garments?count=true con los
//   filtros provisionales, con debounce.
// - Con "Todo", los tipos salen agrupados por hueco (solo los huecos con
//   prendas en la vista).
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ChipGroup } from "@/components/Chip";
import { ColorSwatch } from "@/components/ColorSwatch";
import { Sheet } from "@/components/Sheet";
import { apiFetch } from "@/lib/api/client";
import type { GarmentCountResponse } from "@/lib/api/types";
import { SLOT_IDS, type SlotId } from "@/lib/domain/slots";
import { typesOfSlot, type GarmentTypeId } from "@/lib/domain/types";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  colorOptions,
  countParams,
  slotCounts,
  useCatalogStore,
  type CatalogFilters,
} from "./store";

/** Espera desde el último toque antes de pedir el recuento. */
const COUNT_DEBOUNCE_MS = 250;

export type FiltersSheetProps = {
  onClose: () => void;
};

/** Se monta al abrir: el borrador parte de los filtros aplicados. */
export function FiltersSheet({ onClose }: FiltersSheetProps) {
  const t = useTranslations("catalog.filters");
  const tCommon = useTranslations("common");
  const tSlots = useTranslations("slots");
  const tTypes = useTranslations("types");
  const tColors = useTranslations("colors");
  const view = useCatalogStore((s) => s.view);
  const slot = useCatalogStore((s) => s.slot);
  const counts = useCatalogStore((s) => s.counts);
  const options = useCatalogStore((s) => s.options);
  const applied = useCatalogStore((s) => s.filters);
  const setFilters = useCatalogStore((s) => s.setFilters);

  const [draft, setDraft] = useState<CatalogFilters>(applied);
  const [optionsFailed, setOptionsFailed] = useState(false);
  // Recuento con los filtros provisionales; `for` = la consulta a la que corresponde.
  const [count, setCount] = useState<{ for: string; value: number | null } | null>(null);
  const ids = { type: useId(), brand: useId(), color: useId(), tags: useId() };

  // Marcas y etiquetas frescas cada vez que se abre.
  useEffect(() => {
    void useCatalogStore
      .getState()
      .loadOptions()
      .then(() => {
        const opts = useCatalogStore.getState().options;
        setOptionsFailed(opts === null);
        // Etiquetas que ya no existen: fuera también del borrador.
        if (opts) {
          const known = new Set(opts.tags.map((x) => x.id));
          setDraft((d) => ({ ...d, tags: d.tags.filter((id) => known.has(id)) }));
        }
      });
  }, []);

  const query = countParams({ view, slot, filters: draft }).toString();
  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<GarmentCountResponse>(`/api/garments?${query}`, { signal: ac.signal })
        .then((r) => setCount({ for: query, value: r.count }))
        .catch(() => {
          if (!ac.signal.aborted) setCount({ for: query, value: null });
        });
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query]);

  const upToDate = count?.for === query;
  const shown = count?.value ?? null;

  // Tipos: los del hueco; con "Todo", agrupados por hueco (los que tienen prendas).
  const typeGroups: Array<{ slot: SlotId; types: GarmentTypeId[] }> =
    slot !== "all"
      ? [{ slot, types: typesOfSlot(slot) }]
      : counts
        ? SLOT_IDS.filter((s) => slotCounts(counts, view)[s] > 0).map((s) => ({
            slot: s,
            types: typesOfSlot(s),
          }))
        : [];

  const setTypesOf = (group: GarmentTypeId[], next: GarmentTypeId[]) =>
    setDraft((d) => ({
      ...d,
      types: [...d.types.filter((x) => !group.includes(x)), ...next],
    }));

  // Marcas de la URL que no estén en la lista siguen visibles para poder quitarlas.
  const brandOptions = [
    ...new Set([...(options?.brands ?? []), ...draft.brands.filter(Boolean)]),
  ].map((b) => ({ value: b, label: b }));
  const colorChips = colorOptions(counts, view, draft.colors).map((c) => ({
    value: c,
    label: tColors(c),
    icon: <ColorSwatch family={c} />,
  }));
  const tagOptions = (options?.tags ?? []).map((tag) => ({ value: tag.id, label: tag.name }));

  const empty = activeFilterCount(draft) === 0;
  const muted = "text-caption text-ink-muted-48";

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("title")}
      closeLabel={tCommon("close")}
      headerAction={
        <Button
          variant="text-link"
          className="px-xs"
          disabled={empty}
          onClick={() => setDraft(EMPTY_FILTERS)}
        >
          {t("clear")}
        </Button>
      }
      footer={
        <Button
          variant="primary"
          fullWidth
          aria-busy={!upToDate}
          onClick={() => {
            setFilters(draft);
            onClose();
          }}
        >
          {shown === null ? t("showUnknown") : t("show", { count: shown })}
        </Button>
      }
    >
      <div className="flex flex-col gap-lg pt-xs">
        <section className="flex flex-col gap-xs" aria-labelledby={ids.type}>
          <h3 id={ids.type} className="text-caption-strong">
            {t("type")}
          </h3>
          {typeGroups.length === 0 && <p className={muted}>{t("noTypes")}</p>}
          {typeGroups.map((g) => (
            <div key={g.slot} className="flex flex-col gap-xxs">
              {slot === "all" && <span className={muted}>{tSlots(g.slot)}</span>}
              <ChipGroup
                aria-label={slot === "all" ? `${t("type")}: ${tSlots(g.slot)}` : undefined}
                aria-labelledby={slot === "all" ? undefined : ids.type}
                options={g.types.map((ty) => ({ value: ty, label: tTypes(ty) }))}
                value={draft.types.filter((x) => g.types.includes(x))}
                onChange={(next) => setTypesOf(g.types, next)}
              />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-xs" aria-labelledby={ids.brand}>
          <h3 id={ids.brand} className="text-caption-strong">
            {t("brand")}
          </h3>
          {brandOptions.length > 0 ? (
            <ChipGroup
              aria-labelledby={ids.brand}
              options={brandOptions}
              value={draft.brands}
              onChange={(brands) => setDraft((d) => ({ ...d, brands }))}
            />
          ) : (
            <p className={muted}>
              {options ? t("noBrands") : optionsFailed ? t("optionsError") : t("loadingOptions")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-xs" aria-labelledby={ids.color}>
          <h3 id={ids.color} className="text-caption-strong">
            {t("color")}
          </h3>
          {colorChips.length > 0 ? (
            <ChipGroup
              aria-labelledby={ids.color}
              options={colorChips}
              value={draft.colors}
              onChange={(colors) => setDraft((d) => ({ ...d, colors }))}
            />
          ) : (
            <p className={muted}>{t("noColors")}</p>
          )}
        </section>

        <section className="flex flex-col gap-xs" aria-labelledby={ids.tags}>
          <h3 id={ids.tags} className="text-caption-strong">
            {t("tags")}
          </h3>
          {tagOptions.length > 0 ? (
            <ChipGroup
              aria-labelledby={ids.tags}
              options={tagOptions}
              value={draft.tags}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
            />
          ) : (
            <p className={muted}>
              {options ? t("noTags") : optionsFailed ? t("optionsError") : t("loadingOptions")}
            </p>
          )}
          <p className="text-fine-print text-ink-muted-48">{t("tagsNote")}</p>
        </section>
      </div>
    </Sheet>
  );
}

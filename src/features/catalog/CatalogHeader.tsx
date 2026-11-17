"use client";

// Cabecera del catálogo (screens.md 4): título, contador "58 en uso ·
// 3 archivadas" (solo lo que hay en el servidor, decisión 4) y botón "Añadir".
// El botón abre la hoja de añadir prenda (paso 3.7).
// Selección en lote (3.11, screens.md 4.2): enlace "Seleccionar" junto a
// "Añadir"; mientras dura el modo, en su lugar "Seleccionar todo" (o "Quitar
// selección" si ya están todas). "Cancelar" va en la barra inferior.
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { PlusIcon } from "@/components/icons";
import type { GarmentCountsResponse } from "@/lib/api/types";

export type CatalogHeaderProps = {
  counts: GarmentCountsResponse | null;
  onAdd: () => void;
  /** Mostrar "Seleccionar" (hay prendas en la vista). */
  canSelect: boolean;
  selecting: boolean;
  /** Todas las de la vista y los filtros están marcadas. */
  allSelected: boolean;
  /** Pidiendo los ids de "Seleccionar todo". */
  selectingAll: boolean;
  onSelect: () => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

export function CatalogHeader({
  counts,
  onAdd,
  canSelect,
  selecting,
  allSelected,
  selectingAll,
  onSelect,
  onSelectAll,
  onSelectNone,
}: CatalogHeaderProps) {
  const t = useTranslations("catalog");
  const total = counts ? counts.inUse + counts.archived : 0;

  return (
    <header className="flex items-end justify-between gap-sm pt-xs">
      <div className="flex min-w-0 flex-col gap-xxs">
        <h1 className="text-lead font-semibold">{t("title")}</h1>
        {/* Espacio reservado mientras llegan los recuentos: no salta. */}
        <p className="min-h-[1lh] text-caption text-ink-muted-48" aria-live="polite">
          {counts &&
            (total > 0
              ? t("count", { inUse: counts.inUse, archived: counts.archived })
              : t("countEmpty"))}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-xs">
        {selecting ? (
          <Button
            variant="text-link"
            onClick={allSelected ? onSelectNone : onSelectAll}
            disabled={selectingAll}
            aria-busy={selectingAll || undefined}
            className="px-xxs"
          >
            {allSelected ? t("select.selectNone") : t("select.selectAll")}
          </Button>
        ) : (
          canSelect && (
            <Button variant="text-link" onClick={onSelect} className="px-xxs">
              {t("select.select")}
            </Button>
          )
        )}
        <Button variant="primary" onClick={onAdd} aria-haspopup="dialog" className="gap-[6px]">
          <PlusIcon />
          {t("add")}
        </Button>
      </div>
    </header>
  );
}

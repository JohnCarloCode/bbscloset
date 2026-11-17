"use client";

// Filtros activos bajo la fila de huecos (screens.md 4, paso 3.4): un chip
// quitable por tipo, marca, color (con su muestra) y etiqueta (#nombre), y
// "Borrar todo". Como en el prototipo: píldoras grises con una X.
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ColorSwatch } from "@/components/ColorSwatch";
import { CloseIcon } from "@/components/icons";
import { activeFilterCount, useCatalogStore } from "./store";

export function ActiveFilters() {
  const t = useTranslations("catalog.activeFilters");
  const tTypes = useTranslations("types");
  const tColors = useTranslations("colors");
  const filters = useCatalogStore((s) => s.filters);
  const tags = useCatalogStore((s) => s.options?.tags);
  const setFilters = useCatalogStore((s) => s.setFilters);
  const clearFilters = useCatalogStore((s) => s.clearFilters);

  const tagName = new Map((tags ?? []).map((x) => [x.id, x.name]));
  const chips: Array<{ key: string; label: string; icon?: ReactNode; remove: () => void }> = [
    ...filters.types.map((ty) => ({
      key: `type:${ty}`,
      label: tTypes(ty),
      remove: () => setFilters({ types: filters.types.filter((x) => x !== ty) }),
    })),
    ...filters.brands.map((b) => ({
      key: `brand:${b}`,
      label: b,
      remove: () => setFilters({ brands: filters.brands.filter((x) => x !== b) }),
    })),
    ...filters.colors.map((c) => ({
      key: `color:${c}`,
      label: tColors(c),
      icon: <ColorSwatch family={c} size={12} />,
      remove: () => setFilters({ colors: filters.colors.filter((x) => x !== c) }),
    })),
    // Hasta que llegan los nombres, las etiquetas no se pintan (no hay nada que leer).
    ...filters.tags.flatMap((id) => {
      const name = tagName.get(id);
      return name === undefined
        ? []
        : [
            {
              key: `tag:${id}`,
              label: t("tag", { name }),
              remove: () => setFilters({ tags: filters.tags.filter((x) => x !== id) }),
            },
          ];
    }),
  ];

  if (activeFilterCount(filters) === 0) return null;

  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-xs">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          aria-label={t("remove", { label: c.label })}
          className="relative inline-flex h-8 cursor-pointer items-center gap-[6px] rounded-pill bg-canvas-parchment pr-[10px] pl-sm text-caption text-ink after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
        >
          {c.icon}
          <span>{c.label}</span>
          <CloseIcon size={12} className="text-ink-muted-48" />
        </button>
      ))}
      <button
        type="button"
        onClick={clearFilters}
        className="relative inline-flex h-8 cursor-pointer items-center px-xxs text-caption text-ink underline underline-offset-2 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}

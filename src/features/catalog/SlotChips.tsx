"use client";

// Fila de chips por hueco (screens.md 4): "Todo" siempre y los huecos con
// prendas en la vista, cada uno con su número. Como en el prototipo, la fila
// se desplaza en horizontal dentro de sí misma (la página nunca), sangrando
// hasta los bordes de la pantalla. `leading` deja sitio delante para el botón
// "Filtros" (paso 3.4).
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/Chip";
import type { GarmentCountsResponse } from "@/lib/api/types";
import { visibleSlotChips, type CatalogView, type SlotFilter } from "./store";

export type SlotChipsProps = {
  counts: GarmentCountsResponse;
  view: CatalogView;
  value: SlotFilter;
  onChange: (slot: SlotFilter) => void;
  leading?: ReactNode;
};

export function SlotChips({ counts, view, value, onChange, leading }: SlotChipsProps) {
  const t = useTranslations("catalog");
  const tSlots = useTranslations("slots");
  const chips = visibleSlotChips(counts, view, value);

  return (
    <div
      role="group"
      aria-label={t("slotsLabel")}
      // -mx/px: la fila llega al borde de la pantalla y su contenido respeta el margen.
      // py: deja ver el área táctil ampliada (::after) y el foco de los chips.
      className="-mx-5 flex gap-xs overflow-x-auto overscroll-x-contain px-5 py-1 [scrollbar-width:none]"
    >
      {leading}
      {chips.map(({ slot, count }) => {
        const label = slot === "all" ? t("all") : tSlots(slot);
        return (
          <Chip
            key={slot}
            selected={slot === value}
            onClick={() => onChange(slot)}
            aria-label={t("slotChip", { label, count })}
            className="shrink-0 gap-[6px] whitespace-nowrap"
          >
            <span>{label}</span> {/* Sobre el rosa del chip activo el gris no llega a 4,5:1. */}
            <span className={slot === value ? "text-ink-muted-80" : "text-ink-muted-48"}>
              {count}
            </span>
          </Chip>
        );
      })}
    </div>
  );
}

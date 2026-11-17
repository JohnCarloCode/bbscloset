"use client";

// Tipo de prenda (obligatorio): chips de una sola selección agrupados por
// hueco, en el orden de spec 2.1 (screens.md 5.3).
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/Chip";
import { SLOT_IDS } from "@/lib/domain/slots";
import { typesOfSlot, type GarmentTypeId } from "@/lib/domain/types";

export type TypeChipsProps = {
  value: GarmentTypeId | null;
  onChange: (type: GarmentTypeId) => void;
};

export function TypeChips({ value, onChange }: TypeChipsProps) {
  const t = useTranslations();
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-sm">
      <div className="flex items-baseline gap-xs">
        <span id={labelId} className="text-body-strong">
          {t("garment.form.type")}
        </span>
        <span className="text-fine-print text-ink-muted-48">{t("garment.form.required")}</span>
      </div>
      {SLOT_IDS.map((slot) => (
        <div key={slot} className="flex flex-col gap-[6px]">
          <span id={`${labelId}-${slot}`} className="text-fine-print text-ink-muted-48">
            {t(`slots.${slot}`)}
          </span>
          <div
            role="group"
            aria-labelledby={`${labelId}-${slot}`}
            className="flex flex-wrap gap-[6px]"
          >
            {typesOfSlot(slot).map((type) => (
              <Chip key={type} selected={value === type} onClick={() => onChange(type)}>
                {t(`types.${type}`)}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

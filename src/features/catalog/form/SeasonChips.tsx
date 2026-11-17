"use client";

// Temporada: chips de selección múltiple (spec 2.3).
import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChipGroup } from "@/components/Chip";
import { SEASON_IDS, type SeasonId } from "@/lib/domain/seasons";

export type SeasonChipsProps = {
  value: SeasonId[];
  onChange: (seasons: SeasonId[]) => void;
};

export function SeasonChips({ value, onChange }: SeasonChipsProps) {
  const t = useTranslations();
  const labelId = useId();
  return (
    <div className="flex flex-col gap-xs">
      <span id={labelId} className="text-caption-strong">
        {t("garment.form.season")}
      </span>
      <ChipGroup<SeasonId>
        aria-labelledby={labelId}
        className="gap-[6px]"
        options={SEASON_IDS.map((s) => ({ value: s, label: t(`seasons.${s}`) }))}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

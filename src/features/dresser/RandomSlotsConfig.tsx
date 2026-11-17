"use client";

// Chips de las categorías del "Outfit aleatorio" (screens 7.2): se despliegan
// encima de la fila de aleatorios. Cada cambio se guarda al momento en el
// perfil (PATCH /api/me, random_slots); si falla, vuelve atrás y avisa.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChipGroup } from "@/components/Chip";
import { cx } from "@/components/cx";
import { useToast } from "@/components/toast";
import { isApiClientError } from "@/lib/api/client";
import { SLOT_IDS, type SlotId } from "@/lib/domain/slots";
import { useDresserStore } from "./store";

export function RandomSlotsConfig({ id, className }: { id?: string; className?: string }) {
  const t = useTranslations("dresser.random");
  const tSlots = useTranslations("slots");
  const { show } = useToast();
  const randomSlots = useDresserStore((s) => s.randomSlots);
  const setRandomSlots = useDresserStore((s) => s.setRandomSlots);
  const hintId = useId();

  const onChange = (slots: SlotId[]) => {
    setRandomSlots(slots).catch((err) => {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      show({ message: t("saveError") });
    });
  };

  return (
    <div id={id} className={cx("flex flex-col gap-xs", className)}>
      <p id={hintId} className="text-caption text-ink-muted-48">
        {t("settingsHint")}
      </p>
      <ChipGroup
        aria-labelledby={hintId}
        options={SLOT_IDS.map((slot) => ({ value: slot, label: tSlots(slot) }))}
        value={randomSlots}
        onChange={onChange}
      />
    </div>
  );
}

"use client";

// Fila de aleatorios bajo el lienzo (screens 7.2, spec 3.2; paso 4.5):
// Sustituir (secundario) · Outfit aleatorio (principal) · botón redondo de
// ajustes que despliega encima los chips de categorías (activo en negro).
// - Sustituir se atenúa con el lienzo vacío o con todo bloqueado.
// - Las listas de prendas de cada hueco las da el store (loadPool), en
//   caché para la sesión; mientras llegan, los botones no responden.
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { SlidersIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { isApiClientError } from "@/lib/api/client";
import { canSubstitute } from "./random";
import { RandomSlotsConfig } from "./RandomSlotsConfig";
import { selectClosetEmpty, useDresserStore } from "./store";
import { useDresserToasts } from "./useDresserToasts";

export function RandomBar({ className }: { className?: string }) {
  const t = useTranslations("dresser.random");
  const { show } = useToast();
  const { showMissing } = useDresserToasts();
  const canvas = useDresserStore((s) => s.canvas);
  const randomSlots = useDresserStore((s) => s.randomSlots);
  const closetEmpty = useDresserStore(selectClosetEmpty);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const configId = useId();

  const substituteOff = !canSubstitute(canvas);
  const randomOff = randomSlots.length === 0 || closetEmpty;

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (!(isApiClientError(err) && err.code === "unauthorized"))
        show({ message: t("loadError") });
    } finally {
      setBusy(false);
    }
  };

  const onSubstitute = () =>
    run(async () => {
      await useDresserStore.getState().runSubstitute();
    });

  const onRandom = () =>
    run(async () => {
      const { empty } = await useDresserStore.getState().runRandomOutfit();
      showMissing(empty);
    });

  return (
    <div data-random-bar-slot className={cx("flex flex-col", className)}>
      {open && <RandomSlotsConfig id={configId} className="px-4 pt-sm" />}
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-xs px-4 py-sm">
        <Button
          variant="secondary"
          disabled={substituteOff}
          aria-busy={busy || undefined}
          onClick={onSubstitute}
        >
          {t("substitute")}
        </Button>
        <Button
          variant="primary"
          className="whitespace-nowrap"
          disabled={randomOff}
          aria-busy={busy || undefined}
          onClick={onRandom}
        >
          {t("randomOutfit")}
        </Button>
        <button
          type="button"
          aria-label={t("settings")}
          title={t("settings")}
          aria-expanded={open}
          aria-controls={open ? configId : undefined}
          onClick={() => setOpen((o) => !o)}
          className={cx(
            "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
            open ? "bg-ink text-on-dark" : "bg-canvas-parchment text-ink",
          )}
        >
          <SlidersIcon />
        </button>
      </div>
    </div>
  );
}

"use client";

// Ajustes › Vestidor (screens.md 12; spec 3.6): "Joyas a la vez" con − / +
// (1–10, 3 por defecto). Optimista: el número cambia al momento, se guarda
// con PATCH /api/me (solo el último valor si se pulsa varias veces seguidas)
// y, si falla, vuelve al último guardado con un aviso. El store del vestidor
// recibe el valor nuevo enseguida (setJewelryMax), así que el vestidor lo usa
// sin recargar; además vuelve a leer el perfil al entrar (loadProfile).
import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { useToast } from "@/components/toast";
import { useDresserStore } from "@/features/dresser/store";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import { invalidateMe } from "@/lib/api/me";
import type { Me } from "@/lib/api/types";
import {
  clampJewelryMax,
  createLatestSaver,
  JEWELRY_MAX_MAX,
  JEWELRY_MAX_MIN,
  type LatestSaver,
} from "./logic";
import { SettingsGroup, settingsRow } from "./SettingsGroup";

const stepButton =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full " +
  "bg-canvas-parchment text-tagline leading-none text-ink " +
  "disabled:cursor-not-allowed disabled:opacity-35";

export function DresserSection({ jewelryMax }: { jewelryMax: number }) {
  const t = useTranslations("settings");
  const { show } = useToast();
  const labelId = useId();
  // El aviso de error usa siempre los textos del idioma actual (el saver se crea una vez).
  const notifyRef = useRef<(err: unknown) => void>(() => {});
  useLayoutEffect(() => {
    notifyRef.current = (err) => {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      show({
        message:
          isApiClientError(err) && err.code === "network" ? t("offline") : t("dresser.saveError"),
      });
    };
  }, [show, t]);
  const [value, setValue] = useState(() => clampJewelryMax(jewelryMax));
  // El saver se crea al primer toque (en un manejador, no durante el render).
  const saverRef = useRef<LatestSaver<number> | null>(null);

  function change(delta: number) {
    saverRef.current ??= createLatestSaver<number>({
      initial: value,
      save: async (next) => {
        const me = await apiFetch<Me>("/api/me", { method: "PATCH", json: { jewelry_max: next } });
        invalidateMe();
        return me.jewelry_max;
      },
      apply: (next) => {
        setValue(next);
        useDresserStore.getState().setJewelryMax(next);
      },
      onError: (err) => notifyRef.current(err),
    });
    void saverRef.current.set(clampJewelryMax(value + delta));
  }

  return (
    <SettingsGroup title={t("dresser.title")} note={t("dresser.note")}>
      <div className={cx(settingsRow, "justify-between")}>
        <span id={labelId} className="text-body">
          {t("dresser.jewelry")}
        </span>
        <div role="group" aria-labelledby={labelId} className="flex items-center gap-xxs">
          <button
            type="button"
            className={stepButton}
            aria-label={t("dresser.decrease")}
            disabled={value <= JEWELRY_MAX_MIN}
            onClick={() => change(-1)}
          >
            <span aria-hidden="true">−</span>
          </button>
          <output aria-live="polite" className="min-w-8 text-center text-body-strong">
            {value}
          </output>
          <button
            type="button"
            className={stepButton}
            aria-label={t("dresser.increase")}
            disabled={value >= JEWELRY_MAX_MAX}
            onClick={() => change(1)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </SettingsGroup>
  );
}

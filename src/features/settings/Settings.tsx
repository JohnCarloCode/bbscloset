"use client";

// Pantalla de Ajustes (screens.md 12; spec 3.6; paso 7.2): grupos tipo lista
// sobre fondo gris claro, en el orden del prototipo: Etiquetas, Vestidor,
// Idioma, Herramientas y Cuenta. El perfil (GET /api/me: máximo de joyas y
// email) se pide aquí y lo comparten Vestidor y Cuenta; las etiquetas las
// carga su propia sección.
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { isApiClientError } from "@/lib/api/client";
import { getMe } from "@/lib/api/me";
import type { Me } from "@/lib/api/types";
import { AccountSection } from "./AccountSection";
import { DresserSection } from "./DresserSection";
import { LanguageSection } from "./LanguageSection";
import { SettingsGroup, settingsRow } from "./SettingsGroup";
import { TagsSection } from "./TagsSection";
import { ToolsSection } from "./ToolsSection";

type MeState = { status: "loading" } | { status: "error" } | { status: "ready"; me: Me };

export function Settings() {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [state, setState] = useState<MeState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", me: await getMe() });
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    void load();
  }, [load]);

  let dresser;
  if (state.status === "ready") {
    dresser = <DresserSection jewelryMax={state.me.jewelry_max} />;
  } else {
    dresser = (
      <SettingsGroup title={t("dresser.title")}>
        {state.status === "loading" ? (
          <div className={settingsRow} aria-busy="true">
            <div className="h-[18px] w-1/2 rounded-xs bg-canvas-parchment" />
          </div>
        ) : (
          <div role="alert" className={cx(settingsRow, "justify-between")}>
            <span className="text-caption text-ink-muted-80">{t("loadError")}</span>
            <Button variant="text-link" onClick={() => void load()}>
              {tCommon("retry")}
            </Button>
          </div>
        )}
      </SettingsGroup>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-var(--tab-bar-h))] bg-canvas-parchment">
      <div className="mx-auto flex max-w-[640px] flex-col gap-[28px] px-[20px] pt-md pb-xl">
        <h1 className="text-lead font-semibold">{tNav("settings")}</h1>
        <TagsSection />
        {dresser}
        <LanguageSection />
        <ToolsSection />
        <AccountSection email={state.status === "ready" ? state.me.email : null} />
      </div>
    </main>
  );
}

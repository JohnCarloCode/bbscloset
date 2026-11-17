"use client";

// Ajustes › Idioma (screens.md 12; spec 3.6): English · Español.
// 1. PATCH /api/me { language } guarda profiles.language (persiste en otros
//    dispositivos: el login lo copia a la cookie) y la respuesta fija la
//    cookie `locale` de este navegador.
// 2. router.refresh() vuelve a pedir la ruta al servidor: request.ts lee la
//    cookie nueva, LocaleProviders (dentro del <Suspense> del layout raíz)
//    entrega los mensajes del otro idioma y todos los componentes de cliente
//    se vuelven a pintar traducidos sin perder su estado (cola de recorte,
//    lienzo del vestidor…). Una recarga completa también valdría, pero
//    cortaría las subidas en curso.
import { useId, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useToast } from "@/components/toast";
import { isLocale, type Locale } from "@/i18n/config";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import { invalidateMe } from "@/lib/api/me";
import type { Me } from "@/lib/api/types";

/** Orden del prototipo: English · Español. */
const ORDER: Locale[] = ["en", "es"];

export function LanguageSection() {
  const t = useTranslations("settings");
  const tLang = useTranslations("common.languages");
  const locale = useLocale();
  const router = useRouter();
  const { show } = useToast();
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  // Durante el cambio se ve ya el idioma elegido; la transición acaba cuando
  // llegan los mensajes nuevos (useLocale lo confirma) o se vuelve atrás si falla.
  const [shown, setShown] = useOptimistic(locale);

  function change(next: Locale) {
    if (pending || next === locale) return;
    startTransition(async () => {
      setShown(next);
      try {
        await apiFetch<Me>("/api/me", { method: "PATCH", json: { language: next } });
        invalidateMe();
        router.refresh();
      } catch (err) {
        if (isApiClientError(err) && err.code === "unauthorized") return;
        show({
          message:
            isApiClientError(err) && err.code === "network" ? t("offline") : t("languageError"),
        });
      }
    });
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-xs">
      <h2 id={titleId} className="px-xxs text-caption-strong">
        {t("language")}
      </h2>
      <SegmentedControl<Locale>
        aria-labelledby={titleId}
        options={ORDER.map((l) => ({ value: l, label: tLang(l) }))}
        value={isLocale(shown) ? shown : "es"}
        onChange={change}
      />
    </section>
  );
}

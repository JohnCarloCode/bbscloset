"use client";

// En el login, tras un 401 de la API (src/lib/api/client.ts llega con
// ?expired=1): toast "Tu sesión ha caducado. Vuelve a entrar." y se quita la
// marca de la URL para que no se repita al recargar.
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/toast";
import { SESSION_EXPIRED_PARAM } from "@/lib/api/client";

export function SessionExpiredToast() {
  const t = useTranslations("login");
  const { show } = useToast();

  useEffect(() => {
    // Se lee window.location en vez de useSearchParams: así la página del
    // login no necesita Suspense por los parámetros de búsqueda.
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SESSION_EXPIRED_PARAM)) return;
    url.searchParams.delete(SESSION_EXPIRED_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    show({ message: t("sessionExpired") });
  }, [show, t]);

  return null;
}

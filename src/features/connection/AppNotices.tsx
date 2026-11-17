"use client";

// Avisos globales de robustez (paso 7.6), montados en el layout de (app):
// - Supabase no responde (la API da 503 `service_unavailable`, p. ej. el
//   proyecto Free pausado): aviso fijo arriba "No se puede conectar" con
//   "Reintentar" (vuelve a preguntar y, si ya responde, recarga la pantalla).
// - Sin red: toast al perderla y aviso fijo mientras dure; al volver, se va
//   solo (cada pantalla tiene su "Reintentar" y la cola de recorte sigue sola).
// - Sin almacenamiento en el dispositivo (modo privado, lleno o bloqueado):
//   un toast por sesión; la app sigue sin borrador ni cola persistente.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { NoticeInline } from "@/components/NoticeInline";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api/client";
import { isServiceUnavailable, subscribeServiceUnavailable } from "@/lib/api/connection";
import { isStorageUnavailable, subscribeStorageUnavailable } from "@/lib/storageNotice";

/** Duración de los toasts de este archivo: se leen con calma. */
const LONG_TOAST_MS = 6000;

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function AppNotices() {
  const t = useTranslations("connection");
  const tCommon = useTranslations("common");
  const { show } = useToast();
  const unavailable = useSyncExternalStore(
    subscribeServiceUnavailable,
    isServiceUnavailable,
    () => false,
  );
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );
  const [checking, setChecking] = useState(false);

  // Toast al perder la red.
  useEffect(() => {
    const onOffline = () => show({ message: t("offlineToast"), durationMs: LONG_TOAST_MS });
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [show, t]);

  // Almacenamiento bloqueado: un toast por sesión.
  useEffect(() => {
    const notify = () => show({ message: t("storageToast"), durationMs: LONG_TOAST_MS });
    if (isStorageUnavailable()) notify();
    else return subscribeStorageUnavailable(notify);
  }, [show, t]);

  async function retry() {
    setChecking(true);
    try {
      // Cualquier respuesta buena apaga el aviso (apiFetch); entonces se
      // recarga para que cada pantalla vuelva a pedir lo suyo.
      await apiFetch("/api/me", { cache: "no-store" });
      window.location.reload();
    } catch {
      show({ message: t("stillDown"), durationMs: LONG_TOAST_MS });
    } finally {
      setChecking(false);
    }
  }

  if (offline) {
    return (
      <div className="sticky top-0 z-30 bg-canvas px-sm pt-sm">
        <NoticeInline role="status">{t("offline")}</NoticeInline>
      </div>
    );
  }
  if (!unavailable) return null;
  return (
    <div className="sticky top-0 z-30 bg-canvas px-sm pt-sm">
      <NoticeInline role="status">
        <div className="flex flex-col gap-xxs">
          <p className="text-caption-strong">{t("unavailableTitle")}</p>
          <p>{t("unavailableBody")}</p>
          <div>
            <Button
              variant="text-link"
              className="text-caption"
              disabled={checking}
              onClick={() => void retry()}
            >
              {tCommon("retry")}
            </Button>
          </div>
        </div>
      </NoticeInline>
    </div>
  );
}

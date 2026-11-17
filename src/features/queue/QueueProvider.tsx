"use client";

// Monta la cola de recorte en el layout de (app), para que corra en
// cualquier pantalla: averigua el usuario (/api/me) para separar lo
// pendiente de cada uno en IndexedDB, arranca el bucle de recorte y el de
// subida, y pinta la píldora (dentro de QueuePillSlot) y la hoja.
// Al acabar una tanda con prendas subidas: "5 prendas listas para el vestidor".
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api/client";
import { QueuePill } from "./QueuePill";
import { QueueSheet } from "./QueueSheet";
import { startRunner } from "./runner";
import { useQueueStore } from "./store";
import { startUploader } from "./upload";

type Me = { user_id: string };

export function QueueProvider() {
  const t = useTranslations("queue");
  const { show } = useToast();
  const userId = useQueueStore((s) => s.userId);

  // Usuario de la sesión. Un 401 ya lo gestiona apiFetch (va al login).
  useEffect(() => {
    let cancelled = false;
    apiFetch<Me>("/api/me")
      .then((me) => {
        if (!cancelled) void useQueueStore.getState().init(me.user_id);
      })
      .catch((err) => console.warn("[queue] sin usuario", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Bucles de recorte y subida, solo con usuario conocido.
  useEffect(() => {
    if (!userId) return;
    const stopRunner = startRunner();
    const stopUploader = startUploader();
    return () => {
      stopRunner();
      stopUploader();
    };
  }, [userId]);

  // Fin de tanda: aviso y limpieza de las prendas ya subidas.
  useEffect(
    () =>
      useQueueStore.subscribe((s, prev) => {
        if (s.items === prev.items) return;
        queueMicrotask(() => {
          const count = useQueueStore.getState().settleRound();
          if (count > 0) show({ message: t("allReady", { count }) });
        });
      }),
    [show, t],
  );

  return (
    <>
      <QueuePill />
      <QueueSheet />
    </>
  );
}

"use client";

// Hoja "Por revisar" (screens.md 4.4, paso 3.12): las fotos de la subida
// masiva, de una en una. Arriba "3 de 12"; el recorte en grande (o su estado
// si aún recorta, CutoutPreview) y GarmentForm en modo `review` (Tipo arriba,
// "Más datos" plegado). Pie: "Guardar y siguiente" (activo al elegir tipo),
// "Saltar" (sigue en la franja) y "Descartar foto" (fuera de la cola).
// Guardar pone los datos en el item (setGarmentData quita `needsReview`): la
// cola la sube cuando tenga recorte y entonces sale como pendiente en la
// cuadrícula (3.9).
// Avisos (sin duplicar el de fin de tanda de la cola, screens.md 6): al acabar,
// "12 prendas añadidas."; las guardadas con el recorte ya hecho quedan
// `announced` (no entran en "N prendas listas para el vestidor"); las que aún
// se recortan sí, porque ese aviso es el que dice que ya están listas (3.8).
import { useEffect, useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/toast";
import { useQueueStore } from "@/features/queue/store";
import { CutoutPreview } from "../form/CutoutPreview";
import { GarmentForm } from "../form/GarmentForm";
import { isGarmentFormValid, toGarmentData } from "../form/logic";
import { advance, currentId, nextIndex, reviewCount, toReview, type ReviewSession } from "./logic";
import { useReview } from "./store";

export function ReviewSheet() {
  const t = useTranslations();
  const { show } = useToast();
  const formId = useId();
  const session = useReview((s) => s.session);
  const draft = useReview((s) => s.draft);
  const setDraft = useReview((s) => s.setDraft);
  const items = useQueueStore((s) => s.items);
  const pending = useMemo(() => new Set(toReview(items).map((i) => i.localId)), [items]);

  const id = session ? currentId(session) : null;
  const item = id ? items.find((i) => i.localId === id) : undefined;

  /** Cierra la hoja con el aviso que toque. */
  function finish(ended: ReviewSession | null, reachedEnd: boolean) {
    useReview.getState().close();
    if (!ended) return;
    if (ended.added > 0) {
      show({ message: t("catalog.review.added", { count: ended.added }) });
    } else if (reachedEnd) {
      const left = reviewCount(useQueueStore.getState().items);
      if (left > 0) show({ message: t("catalog.review.stillToReview", { count: left }) });
    }
  }

  /** Siguiente foto, o fin de la pasada. */
  function go(action: "save" | "skip" | "discard" | "gone") {
    const current = useReview.getState().session;
    if (!current) return;
    const now = new Set(toReview(useQueueStore.getState().items).map((i) => i.localId));
    const next = advance(current, now, action);
    if (next.index === -1) finish(next, true);
    else useReview.getState().setSession(next);
  }

  // La foto actual dejó de estar por revisar desde fuera (quitada en la hoja
  // de la cola, por ejemplo): se pasa a la siguiente.
  useEffect(() => {
    if (session && id && !pending.has(id)) go("gone");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` lee el estado al llamarse
  }, [session, id, pending]);

  function save() {
    if (!id || !item || !draft.typeId || !isGarmentFormValid(draft)) return;
    const ready = item.status === "ready" && !!item.cutout;
    useQueueStore.getState().setGarmentData(id, toGarmentData(draft), { announced: ready });
    go("save");
  }

  function discard() {
    if (!id) return;
    useQueueStore.getState().remove(id);
    go("discard");
  }

  const hasNext = session ? nextIndex(session, pending) !== -1 : false;

  return (
    <Sheet
      open={!!session && !!item}
      onClose={() => finish(useReview.getState().session, false)}
      title={
        <>
          {t("catalog.review.title")}{" "}
          {session && (
            <span className="text-caption text-ink-muted-48">
              {t("catalog.review.position", {
                current: session.index + 1,
                total: session.order.length,
              })}
            </span>
          )}
        </>
      }
      closeLabel={t("common.close")}
      fullScreen
      className="tablet:min-h-[min(560px,92dvh)]"
      footer={
        <div className="flex flex-col">
          <Button type="submit" form={formId} fullWidth disabled={!draft.typeId}>
            {!draft.typeId
              ? t("catalog.addGarment.data.pickType")
              : hasNext
                ? t("catalog.review.saveNext")
                : t("catalog.review.save")}
          </Button>
          <div className="flex justify-between">
            <Button variant="text-link" className="text-[15px]" onClick={() => go("skip")}>
              {t("catalog.review.skip")}
            </Button>
            <Button variant="text-link" className="text-[15px]" onClick={discard}>
              {t("catalog.review.discard")}
            </Button>
          </div>
        </div>
      }
    >
      {item && (
        <GarmentForm
          key={item.localId}
          id={formId}
          mode="review"
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          className="pt-xs pb-md"
          header={<CutoutPreview localId={item.localId} hasAlpha={item.hasAlpha} />}
        />
      )}
    </Sheet>
  );
}

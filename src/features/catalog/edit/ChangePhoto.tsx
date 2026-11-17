"use client";

// "Cambiar foto" desde la ficha (screens.md 5.4): los pasos 5.1 (elegir una
// foto) y 5.2 (¿recortar o ya recortada?) de "Añadir prenda", sin el de
// datos. Al continuar, la foto entra en la cola como `kind: "replace"` con el
// id de la prenda: mientras se recorta, la prenda sigue usándose con su
// recorte viejo; al terminar, la cola la sube (POST /api/garments/[id]/image)
// y avisa con GARMENT_SAVED_EVENT, y el catálogo y la ficha la vuelven a pedir.
// Si ya había un cambio de foto pendiente para la prenda, el nuevo lo sustituye.
//
// Es un hook porque la ficha (GarmentSheet) pinta el cuerpo y el pie en su
// propia hoja: devuelve los dos y `reset` (vuelta al paso 1 al salir).
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { IMAGING_ERROR_MESSAGE, isImagingError } from "@/lib/imaging/errors";
import { useQueueStore } from "@/features/queue/store";
import type { QueueMode } from "@/features/queue/types";
import { CutoutChoiceStep } from "../add/CutoutChoiceStep";
import { PickPhotoStep } from "../add/PickPhotoStep";

type ErrorKey = (typeof IMAGING_ERROR_MESSAGE)[keyof typeof IMAGING_ERROR_MESSAGE];

// Transparencia detectada de cada foto encolada (para el texto de estado de
// la vista previa en la ficha). Solo en memoria: tras recargar no se sabe.
const detectedAlpha = new Map<string, boolean>();

/** ¿La foto nueva del cambio `localId` tenía transparencia? (si se sabe). */
export function replaceHasAlpha(localId: string): boolean | undefined {
  return detectedAlpha.get(localId);
}

/** Quita de la cola los cambios de foto sin subir de una prenda (al eliminarla). */
export function dropPendingReplaces(garmentId: string, except?: string) {
  const queue = useQueueStore.getState();
  for (const i of queue.items) {
    if (i.kind === "replace" && i.garmentId === garmentId && !i.uploaded && i.localId !== except) {
      queue.remove(i.localId);
      detectedAlpha.delete(i.localId);
    }
  }
}

export type ChangePhotoFlow = {
  body: ReactNode;
  footer: ReactNode;
  /** Vuelve al paso 1 (al salir del flujo sin continuar). */
  reset: () => void;
};

export function useChangePhoto({
  garmentId,
  onDone,
}: {
  garmentId: string;
  /** La foto ya está en la cola. */
  onDone: () => void;
}): ChangePhotoFlow {
  const t = useTranslations();
  const [photo, setPhoto] = useState<{ file: File; hasAlpha: boolean } | null>(null);
  const [mode, setMode] = useState<QueueMode>("cut");
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  function reset() {
    setPhoto(null);
    setMode("cut");
    setContinuing(false);
    setError(null);
  }

  async function onContinue() {
    if (!photo || continuing) return;
    setError(null);
    setContinuing(true);
    try {
      const localId = await useQueueStore.getState().enqueue("replace", photo.file, mode, {
        garmentId,
        sourceName: photo.file.name,
      });
      detectedAlpha.set(localId, photo.hasAlpha);
      // La foto nueva sustituye a otra que estuviera pendiente.
      dropPendingReplaces(garmentId, localId);
      reset();
      onDone();
    } catch (err) {
      console.warn("[change-photo] no se pudo encolar", err);
      setError(
        isImagingError(err) ? IMAGING_ERROR_MESSAGE[err.code] : IMAGING_ERROR_MESSAGE.decode_failed,
      );
      setContinuing(false);
    }
  }

  if (!photo) {
    return {
      body: (
        <PickPhotoStep
          multiple={false}
          checkRoom={false}
          onPicked={(file, hasAlpha) => {
            setPhoto({ file, hasAlpha });
            setMode(hasAlpha ? "as-is" : "cut");
          }}
        />
      ),
      footer: undefined,
      reset,
    };
  }

  return {
    body: (
      <CutoutChoiceStep
        file={photo.file}
        hasAlpha={photo.hasAlpha}
        mode={mode}
        onModeChange={setMode}
        error={error ? t(error) : null}
      />
    ),
    footer: (
      <Button fullWidth onClick={() => void onContinue()} disabled={continuing}>
        {t("catalog.addGarment.choose.continue")}
      </Button>
    ),
    reset,
  };
}

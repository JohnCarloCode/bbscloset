"use client";

// Hoja "Añadir prenda" (screens.md 5): pantalla completa en móvil, centrada
// en tablet y escritorio. Se monta una vez en el layout de (app) y se abre
// desde cualquier pantalla con `useAddGarment.getState().open()` (catálogo,
// barra lateral, vestidor, toasts), encima de la pantalla actual.
// Pasos: 1 elegir foto (5.1) → 2 recortar o ya recortada (5.2) → 3 datos
// (5.3, paso 3.8). Cerrar sin guardar descarta la foto y su item de la cola.
// Con varias fotos: resumen de la subida masiva (5.5, paso 3.12) y "Añadir 12
// fotos", que las deja por revisar en la cola y cierra la hoja.
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/toast";
import { slotOfType } from "@/lib/domain/types";
import { IMAGING_ERROR_MESSAGE, isImagingError } from "@/lib/imaging/errors";
import { useReview } from "../review/store";
import { fittingIds } from "./bulk";
import { BulkSummaryStep } from "./BulkSummaryStep";
import { CutoutChoiceStep } from "./CutoutChoiceStep";
import { GarmentDataStep } from "./GarmentDataStep";
import { PickPhotoStep } from "./PickPhotoStep";
import { useAddGarment } from "./store";
import { useSaveGarment } from "./useSaveGarment";

type ErrorKey = (typeof IMAGING_ERROR_MESSAGE)[keyof typeof IMAGING_ERROR_MESSAGE];

export function AddGarmentSheet() {
  const t = useTranslations();
  const isOpen = useAddGarment((s) => s.isOpen);
  const step = useAddGarment((s) => s.step);
  const file = useAddGarment((s) => s.file);
  const continuing = useAddGarment((s) => s.continuing);
  const close = useAddGarment((s) => s.close);
  const continueWith = useAddGarment((s) => s.continueWith);
  const pickPhoto = useAddGarment((s) => s.pickPhoto);
  const pickSeveral = useAddGarment((s) => s.pickSeveral);
  const bulk = useAddGarment((s) => s.bulk);
  const bulkRoom = useAddGarment((s) => s.bulkRoom);
  const bulkAdding = useAddGarment((s) => s.bulkAdding);
  const addBulk = useAddGarment((s) => s.addBulk);
  const { show } = useToast();
  const hasAlpha = useAddGarment((s) => s.hasAlpha);
  const mode = useAddGarment((s) => s.mode);
  const setMode = useAddGarment((s) => s.setMode);
  const typeId = useAddGarment((s) => s.draft.typeId);
  const save = useSaveGarment();
  const formId = useId();
  // Error al encolar (la foto no se pudo reducir), ligado a la foto elegida.
  const [continueError, setContinueError] = useState<{ file: File; key: ErrorKey } | null>(null);

  async function onContinue() {
    setContinueError(null);
    try {
      await continueWith();
    } catch (err) {
      console.warn("[add-garment] no se pudo encolar", err);
      const key: ErrorKey = isImagingError(err)
        ? IMAGING_ERROR_MESSAGE[err.code]
        : IMAGING_ERROR_MESSAGE.decode_failed;
      if (file) setContinueError({ file, key });
    }
  }

  const error = continueError && continueError.file === file ? t(continueError.key) : null;

  // Subida masiva: cuántas se añadirán (válidas y que caben).
  const bulkCount = useMemo(() => fittingIds(bulk, bulkRoom).size, [bulk, bulkRoom]);
  const bulkChecking = bulk.some((e) => e.check === "pending");

  async function onAddBulk() {
    const added = await addBulk();
    if (!added) return;
    show({
      message: t("catalog.addGarment.bulk.added", { count: added }),
      actionLabel: t("catalog.addGarment.bulk.review"),
      onAction: () => useReview.getState().open(),
    });
  }

  return (
    <Sheet
      open={isOpen}
      onClose={close}
      title={
        step === "bulk"
          ? t("catalog.addGarment.bulk.title", { count: bulk.length })
          : t("catalog.addGarment.title")
      }
      closeLabel={t("common.close")}
      fullScreen
      className="tablet:min-h-[min(560px,92dvh)]"
      footer={
        step === "choose" ? (
          <Button fullWidth onClick={() => void onContinue()} disabled={continuing}>
            {t("catalog.addGarment.choose.continue")}
          </Button>
        ) : step === "bulk" ? (
          <div className="flex flex-col gap-xs">
            <p className="text-center text-fine-print leading-normal text-ink-muted-48">
              {t("catalog.addGarment.bulk.note")}
            </p>
            <Button
              fullWidth
              onClick={() => void onAddBulk()}
              disabled={bulkChecking || !!bulkAdding || bulkCount === 0}
            >
              {bulkAdding
                ? t("catalog.addGarment.bulk.adding", bulkAdding)
                : bulkChecking
                  ? t("catalog.addGarment.bulk.checking")
                  : bulkCount === 0
                    ? t("catalog.addGarment.bulk.nothing")
                    : t("catalog.addGarment.bulk.submit", { count: bulkCount })}
            </Button>
          </div>
        ) : step === "data" ? (
          <div className="flex flex-col items-center">
            <Button type="submit" form={formId} fullWidth disabled={!typeId}>
              {typeId
                ? t("catalog.addGarment.data.submit", { slot: t(`slots.${slotOfType(typeId)}`) })
                : t("catalog.addGarment.data.pickType")}
            </Button>
            <Button
              variant="text-link"
              className="text-[15px]"
              disabled={!typeId}
              onClick={() => save(true)}
            >
              {t("catalog.addGarment.data.saveAnother")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {step === "pick" && <PickPhotoStep onPicked={pickPhoto} onSeveral={pickSeveral} />}
      {step === "bulk" && <BulkSummaryStep />}
      {step === "choose" && file && (
        <CutoutChoiceStep
          file={file}
          hasAlpha={hasAlpha}
          mode={mode}
          onModeChange={setMode}
          error={error}
        />
      )}
      {step === "data" && <GarmentDataStep formId={formId} onSubmit={() => save(false)} />}
    </Sheet>
  );
}

"use client";

// Paso 2 de "Añadir prenda" (screens.md 5.2): miniatura (sobre cuadros si
// tiene transparencia; si no, sobre photo-backdrop) con el nombre del archivo
// y lo detectado; control segmentado Quitar fondo · Ya está recortada,
// preseleccionado según lo detectado (decide el usuario), y su ayuda. Si
// elige "ya recortada" con una foto con fondo, aviso que no bloquea.
// El botón "Continuar" va en el pie de la hoja (AddGarmentSheet).
// Controlado: también lo usa "Cambiar foto" de la ficha (5.4, paso 3.10).
import { useId } from "react";
import { useTranslations } from "next-intl";
import { NoticeInline } from "@/components/NoticeInline";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { BlobImage } from "@/features/queue/BlobImage";
import type { QueueMode } from "@/features/queue/types";

export type CutoutChoiceStepProps = {
  file: File;
  /** Lo detectado: la foto tiene fondo transparente. */
  hasAlpha: boolean;
  mode: QueueMode;
  onModeChange: (mode: QueueMode) => void;
  error?: string | null;
};

export function CutoutChoiceStep({
  file,
  hasAlpha,
  mode,
  onModeChange: setMode,
  error,
}: CutoutChoiceStepProps) {
  const t = useTranslations("catalog.addGarment.choose");
  const labelId = useId();

  return (
    <div className="flex flex-col gap-lg pt-xs">
      <div className="flex items-center gap-md">
        <TransparencyChecker
          variant={hasAlpha ? "checker" : "photo"}
          className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        >
          <BlobImage
            blob={file}
            alt={t("thumbAlt", { name: file.name })}
            className="size-full object-contain"
          />
        </TransparencyChecker>
        <div className="flex min-w-0 flex-col gap-xxs">
          <span className="truncate text-body-strong">{file.name}</span>
          <span className="text-caption text-ink-muted-48">
            {hasAlpha ? t("detectedAlpha") : t("detectedBackground")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-xs">
        <span id={labelId} className="text-caption-strong">
          {t("label")}
        </span>
        <SegmentedControl<QueueMode>
          variant="emphasis"
          aria-labelledby={labelId}
          value={mode}
          onChange={setMode}
          options={[
            { value: "cut", label: t("cut") },
            { value: "as-is", label: t("asIs") },
          ]}
        />
        <p className="text-fine-print leading-normal text-ink-muted-48">
          {mode === "cut" ? t("hintCut") : t("hintAsIs")}
        </p>
      </div>

      {mode === "as-is" && !hasAlpha && (
        <NoticeInline role="status">{t("warnBackground")}</NoticeInline>
      )}

      {error && (
        <p role="alert" className="text-caption">
          {error}
        </p>
      )}
    </div>
  );
}

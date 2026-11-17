"use client";

// Vista previa grande del item de la cola mientras se rellenan los datos
// (screens.md 5.3): el recorte sobre cuadros cuando llega; antes, la foto
// reducida atenuada con la barra rosa. Debajo, la línea de estado y, si el
// recorte falla, "Cambiar foto" (nueva foto para el mismo item).
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { cx } from "@/components/cx";
import { BlobImage } from "@/features/queue/BlobImage";
import { queuePosition } from "@/features/queue/logic";
import { useQueueStore } from "@/features/queue/store";
import { previewStatus } from "./previewStatus";

export type CutoutPreviewProps = {
  localId: string;
  /** La foto original tenía transparencia (cambia el texto de "ya recortada"). */
  hasAlpha?: boolean;
};

export function CutoutPreview({ localId, hasAlpha }: CutoutPreviewProps) {
  const t = useTranslations();
  const item = useQueueStore((s) => s.items.find((i) => i.localId === localId));
  const position = useQueueStore((s) => queuePosition(s.items, localId));
  const replaceSource = useQueueStore((s) => s.replaceSource);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!item) return null;
  const status = previewStatus(item, position, hasAlpha);
  const text = t(status.key, status.values);
  // "Ya recortada" con fondo: se ve sobre el fondo de foto, no sobre cuadros.
  const checker = item.cutout ? !(item.mode === "as-is" && hasAlpha === false) : !!hasAlpha;

  return (
    <div className="flex flex-col gap-xs">
      <TransparencyChecker
        variant={checker ? "checker" : "photo"}
        className="flex h-[220px] w-full items-center justify-center overflow-hidden rounded-lg tablet:h-[260px]"
      >
        <BlobImage
          blob={item.cutout ?? item.source}
          alt={t("catalog.addGarment.data.previewAlt")}
          className={cx(
            "size-full object-contain p-sm motion-safe:transition-opacity",
            !item.cutout && "opacity-55",
          )}
        />
      </TransparencyChecker>
      <div className="flex min-h-11 items-center justify-between gap-sm">
        <p className="text-fine-print leading-normal text-ink-muted-48">{text}</p>
        {status.failed && (
          <>
            <Button
              variant="text-link"
              className="text-caption whitespace-nowrap"
              onClick={() => fileRef.current?.click()}
            >
              {t("catalog.addGarment.data.changePhoto")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void replaceSource(localId, file);
              }}
            />
          </>
        )}
      </div>
      {status.progress !== null && <ProgressBar value={status.progress} aria-label={text} />}
    </div>
  );
}

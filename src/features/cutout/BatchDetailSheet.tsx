"use client";

// Hoja de una foto lista (screens.md 13.2): el recorte en grande sobre
// cuadros, "PNG con transparencia", "Quitar" y "Descargar PNG".
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { BlobImage } from "@/features/queue/BlobImage";
import type { QueueItem } from "@/features/queue/types";

export type BatchDetailSheetProps = {
  /** La foto abierta (null = cerrada). */
  item: QueueItem | null;
  name: string;
  downloading: boolean;
  onClose: () => void;
  onRemove: (item: QueueItem) => void;
  onDownload: (item: QueueItem) => void;
};

export function BatchDetailSheet({
  item,
  name,
  downloading,
  onClose,
  onRemove,
  onDownload,
}: BatchDetailSheetProps) {
  const t = useTranslations();
  const cutout = item?.cutout;

  return (
    <Sheet
      open={!!item && !!cutout}
      onClose={onClose}
      title={name}
      closeLabel={t("common.close")}
      footer={
        item && (
          <div className="grid grid-cols-2 gap-xs">
            <Button variant="secondary" fullWidth onClick={() => onRemove(item)}>
              {t("cutout.detail.remove")}
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={downloading}
              onClick={() => onDownload(item)}
            >
              {t("cutout.detail.download")}
            </Button>
          </div>
        )
      }
    >
      {cutout && (
        <>
          <TransparencyChecker className="flex h-[300px] items-center justify-center rounded-lg p-md">
            <BlobImage
              blob={cutout}
              alt={t("cutout.detail.alt", { name })}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          </TransparencyChecker>
          <p className="pt-xs text-fine-print text-ink-muted-48">
            {t("cutout.detail.transparent")}
          </p>
        </>
      )}
    </Sheet>
  );
}

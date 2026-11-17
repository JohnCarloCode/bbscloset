"use client";

// Hoja de la cola de recorte (screens.md 6): lista de prendas pendientes con
// miniatura, nombre (o "Prenda nueva (sin guardar)") y estado; en error,
// "Cambiar foto" y "Quitar". El recorte en lote no sale aquí.
import { useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { Sheet } from "@/components/Sheet";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { cx } from "@/components/cx";
import { IMAGING_ERROR_MESSAGE } from "@/lib/imaging/errors";
import { garmentItems, pillState, queuePosition } from "./logic";
import { useQueueStore } from "./store";
import type { QueueItem } from "./types";
import { BlobImage } from "./BlobImage";

export function QueueSheet() {
  const t = useTranslations();
  const open = useQueueStore((s) => s.sheetOpen);
  const close = useQueueStore((s) => s.closeSheet);
  const items = useQueueStore((s) => s.items);
  const rows = useMemo(() => garmentItems(items), [items]);
  const pill = useMemo(() => pillState(items), [items]);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("queue.sheet.title")}
      closeLabel={t("common.close")}
    >
      <div className="flex min-h-0 flex-col">
        <div className="px-[20px] text-caption text-ink-muted-48">
          <p>
            {pill.visible
              ? t("queue.sheet.subtitle", { ready: pill.ready, total: pill.total })
              : t("queue.sheet.allDone")}
          </p>
          {pill.visible && <p>{t("queue.sheet.keepOpen")}</p>}
        </div>
        <ul className="min-h-0 overflow-y-auto px-[20px] pt-xs pb-[28px]">
          {rows.map((item, i) => (
            <QueueRow
              key={item.localId}
              item={item}
              position={queuePosition(items, item.localId)}
              divider={i > 0}
            />
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function QueueRow({
  item,
  position,
  divider,
}: {
  item: QueueItem;
  position: number;
  divider: boolean;
}) {
  const t = useTranslations();
  const remove = useQueueStore((s) => s.remove);
  const replaceSource = useQueueStore((s) => s.replaceSource);
  const fileRef = useRef<HTMLInputElement>(null);

  const name =
    item.garmentData?.name ||
    (item.garmentData?.type_id
      ? t(`types.${item.garmentData.type_id}`)
      : item.kind === "replace"
        ? t("queue.item.changePhoto")
        : item.needsReview
          ? t("queue.item.toReview")
          : t("queue.item.newGarment"));

  let status: string;
  if (item.status === "cutting") {
    status =
      item.stage === "preparing"
        ? t("queue.status.preparing")
        : t("queue.status.cutting", { percent: Math.round(item.progress * 100) });
  } else if (item.status === "queued") {
    status = t("queue.item.position", { position });
  } else if (item.status === "error") {
    status = item.error ? t(IMAGING_ERROR_MESSAGE[item.error]) : t("queue.status.error");
  } else if (item.uploadError) {
    status =
      item.uploadError === "limit_reached"
        ? t("queue.uploadErrors.limit_reached")
        : t("queue.uploadErrors.other");
  } else {
    status = t("queue.item.ready");
  }
  const failed = item.status === "error" || !!item.uploadError;

  return (
    <li
      className={cx(
        "flex items-center gap-sm py-[10px]",
        divider && "border-t border-divider-soft",
      )}
    >
      <TransparencyChecker
        variant={item.thumb ? "checker" : "photo"}
        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md"
      >
        <BlobImage
          blob={item.thumb ?? item.source}
          className={cx("max-h-full max-w-full object-contain", !item.thumb && "opacity-55")}
        />
      </TransparencyChecker>
      <div className="flex min-w-0 flex-1 flex-col gap-xxs">
        <span className="truncate text-[15px] font-semibold tracking-[-0.224px]">{name}</span>
        <span className="text-[13px] text-ink-muted-48">{status}</span>
        {item.status === "cutting" && (
          <ProgressBar
            value={item.stage === "preparing" ? 0 : item.progress * 100}
            aria-label={status}
          />
        )}
        {failed && (
          <div className="flex gap-md">
            {item.status === "error" && (
              <>
                <Button variant="text-link" onClick={() => fileRef.current?.click()}>
                  {t("queue.item.changePhoto")}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void replaceSource(item.localId, file);
                  }}
                />
              </>
            )}
            <Button variant="text-link" onClick={() => remove(item.localId)}>
              {t("queue.item.remove")}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

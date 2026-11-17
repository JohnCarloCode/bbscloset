"use client";

// Resumen de la subida masiva (screens.md 5.5, paso 3.12), dentro de la hoja
// "Añadir prenda": control segmentado para todas ("Quitar fondo a todas" /
// "Ya están recortadas") y cuadrícula de miniaturas con lo detectado en cada
// una; tocar una cambia solo esa. Las que fallan la validación se marcan y no
// se añaden; si no caben todas en el límite de 500 (decisión 3) se avisa de
// cuántas entran y las que sobran se marcan. El botón "Añadir 12 fotos" va en
// el pie de la hoja (AddGarmentSheet).
import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { NoticeInline } from "@/components/NoticeInline";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { cx } from "@/components/cx";
import { BlobImage } from "@/features/queue/BlobImage";
import type { QueueMode } from "@/features/queue/types";
import { IMAGING_ERROR_MESSAGE } from "@/lib/imaging/errors";
import { asIsWithBackground, commonMode, fittingIds, overLimit, type BulkEntry } from "./bulk";
import { useAddGarment } from "./store";

export function BulkSummaryStep() {
  const t = useTranslations();
  const tb = useTranslations("catalog.addGarment.bulk");
  const labelId = useId();
  const bulk = useAddGarment((s) => s.bulk);
  const dropped = useAddGarment((s) => s.bulkDropped);
  const room = useAddGarment((s) => s.bulkRoom);
  const adding = useAddGarment((s) => s.bulkAdding);
  const toggle = useAddGarment((s) => s.toggleBulkMode);
  const setAll = useAddGarment((s) => s.setBulkModeAll);

  const fitting = useMemo(() => fittingIds(bulk, room), [bulk, room]);
  const all = commonMode(bulk);
  const invalid = bulk.filter((e) => e.check === "invalid").length;
  const noRoom = overLimit(bulk, room);
  const withBackground = asIsWithBackground(bulk, fitting);
  const checking = bulk.some((e) => e.check === "pending");

  function cellLabel(e: BulkEntry, n: number) {
    const name = e.file.name;
    if (e.check === "pending") return tb("cellChecking", { n, name });
    if (e.check === "invalid") {
      const reason = t(IMAGING_ERROR_MESSAGE[e.error ?? "decode_failed"]);
      return tb("cellInvalid", { n, name, reason });
    }
    if (!fitting.has(e.id)) return tb("cellNoRoom", { n, name });
    return tb("cellLabel", {
      n,
      name,
      detected: e.hasAlpha ? tb("detectedAlpha") : tb("detectedBackground"),
      mode: e.mode === "cut" ? tb("modeCut") : tb("modeAsIs"),
    });
  }

  function badge(e: BulkEntry) {
    if (e.check === "pending") return tb("badgeChecking");
    if (e.check === "invalid") return tb("badgeInvalid");
    if (!fitting.has(e.id)) return tb("badgeNoRoom");
    return e.mode === "cut" ? tb("badgeCut") : tb("badgeAsIs");
  }

  return (
    <div className="flex flex-col gap-lg pt-xs pb-md">
      <div className="flex flex-col gap-xs">
        <span id={labelId} className="text-caption-strong">
          {tb("label")}
        </span>
        <SegmentedControl<QueueMode | "mixed">
          variant="emphasis"
          aria-labelledby={labelId}
          value={all ?? "mixed"}
          onChange={(v) => v !== "mixed" && setAll(v)}
          disabled={!!adding}
          options={[
            { value: "cut", label: tb("allCut") },
            { value: "as-is", label: tb("allAsIs") },
          ]}
        />
        <p className="text-fine-print leading-normal text-ink-muted-48">{tb("hint")}</p>
      </div>

      {dropped > 0 && <NoticeInline>{tb("tooMany", { count: dropped })}</NoticeInline>}

      <ul className="grid grid-cols-4 gap-[10px] tablet:grid-cols-5">
        {bulk.map((e, i) => {
          const usable = e.check === "ok" && fitting.has(e.id);
          const marked = e.check === "invalid" || (e.check === "ok" && !fitting.has(e.id));
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => toggle(e.id)}
                disabled={!usable || !!adding}
                aria-label={cellLabel(e, i + 1)}
                className={cx(
                  "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-[14px] border border-hairline",
                  "disabled:cursor-default",
                )}
              >
                <TransparencyChecker
                  variant={e.hasAlpha ? "checker" : "photo"}
                  className="flex size-full items-center justify-center"
                >
                  <BlobImage
                    blob={e.file}
                    decoding="async"
                    loading="lazy"
                    className={cx(
                      "size-full object-contain p-[6px]",
                      (marked || e.check === "pending") && "opacity-40",
                    )}
                  />
                </TransparencyChecker>
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-x-[4px] bottom-[4px] truncate rounded-pill px-[4px] py-[2px] text-center text-[10px] text-ink",
                    marked
                      ? "bg-ink text-on-dark"
                      : e.check === "ok" && e.mode === "cut"
                        ? "bg-primary"
                        : "bg-canvas",
                  )}
                >
                  {badge(e)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {invalid > 0 && (
        <NoticeInline role="status">{tb("invalid", { count: invalid })}</NoticeInline>
      )}
      {noRoom > 0 && room !== null && (
        <NoticeInline role="status">{tb("noRoom", { room })}</NoticeInline>
      )}
      {withBackground > 0 && (
        <NoticeInline role="status">{tb("warnBackground", { count: withBackground })}</NoticeInline>
      )}
      <div aria-live="polite" className="sr-only">
        {checking ? tb("checking") : ""}
      </div>
    </div>
  );
}

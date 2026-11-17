"use client";

// Recortar fotos (screens.md 13; spec.md 3.1 y 4, punto 8): recorte en lote
// con descarga en PNG, sin crear prendas.
// - Las fotos son items `kind: "batch"` de la cola global (3.6): comparten el
//   bucle de recorte con las prendas por orden de llegada, no cuentan en la
//   píldora y no se suben nunca.
// - Solo viven en memoria mientras la página está abierta (decisión 13): al
//   salir (Next la oculta con Activity) se quitan de la cola, para que no
//   sigan recortándose en otra pantalla. Por eso salir con fotos sin
//   descargar pide confirmación (useLeaveGuard).
// - Estados: vacía (13.1), procesando (13.2) y terminado (13.3).
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { Dialog } from "@/components/Dialog";
import { ChevronLeftIcon, PhotoIcon } from "@/components/icons";
import { NoticeInline } from "@/components/NoticeInline";
import { useToast } from "@/components/toast";
import { BULK_MAX, capBatch } from "@/features/catalog/add/bulk";
import { useQueueStore } from "@/features/queue/store";
import type { QueueItem } from "@/features/queue/types";
import { IMAGING_ERROR_MESSAGE, isImagingError, type ImagingErrorCode } from "@/lib/imaging/errors";
import { toPng } from "@/lib/imaging/toPng";
import { validate } from "@/lib/imaging/validate";
import { BatchDetailSheet } from "./BatchDetailSheet";
import { BatchGrid } from "./BatchGrid";
import { Dropzone } from "./Dropzone";
import { batchItems, summarize } from "./logic";
import { useLeaveGuard } from "./useLeaveGuard";
import { pngFileName, saveBlob, uniqueNames, zipBlob } from "./zip";

/** Avisos en línea de la última tanda añadida. */
type AddNotice = { dropped: number; invalid: { name: string; code: ImagingErrorCode }[] };

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

// ¿Ofrecer "Compartir o guardar en Fotos"? Solo en pantallas táctiles que
// sepan compartir PNG (Web Share con archivos). Se calcula una vez.
let canShareCache: boolean | null = null;
function canSharePngs(): boolean {
  if (canShareCache !== null) return canShareCache;
  try {
    const probe = new File([new Uint8Array(1)], "x.png", { type: "image/png" });
    canShareCache =
      window.matchMedia("(pointer: coarse)").matches &&
      typeof navigator.share === "function" &&
      !!navigator.canShare?.({ files: [probe] });
  } catch {
    canShareCache = false;
  }
  return canShareCache;
}
const noopSubscribe = () => () => {};

export function BatchCutout() {
  const t = useTranslations();
  const { show } = useToast();
  const userId = useQueueStore((s) => s.userId);
  const allItems = useQueueStore((s) => s.items);
  const batch = useMemo(() => batchItems(allItems), [allItems]);

  // localIds ya descargados (sueltos, en el ZIP o compartidos).
  const [downloaded, setDownloaded] = useState<ReadonlySet<string>>(() => new Set());
  const [adding, setAdding] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<AddNotice | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const [busy, setBusy] = useState<"zip" | "share" | "one" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Cambia al vaciar la página (salir o empezar de nuevo): lo que se estaba
  // añadiendo entonces se descarta.
  const session = useRef(0);

  const summary = summarize(batch, downloaded);
  const canShare = useSyncExternalStore(noopSubscribe, canSharePngs, () => false);
  const { leaving, stay, leave } = useLeaveGuard(summary.unsaved);

  // Nombre del PNG de cada foto: el original con .png, sin repetir.
  const names = useMemo(() => {
    const list = uniqueNames(
      batch.map((i, n) => pngFileName(i.sourceName, t("cutout.fallbackName", { n: n + 1 }))),
    );
    return new Map(batch.map((i, n) => [i.localId, list[n]]));
  }, [batch, t]);

  const clearPage = useCallback(() => {
    session.current++;
    const { items, remove } = useQueueStore.getState();
    for (const item of items) if (item.kind === "batch") remove(item.localId);
    setDownloaded(new Set());
    setAdding(null);
    setNotice(null);
    setOpenId(null);
    setErrorId(null);
    setConfirmStartOver(false);
  }, []);

  // Al salir de la página (Activity la oculta o se desmonta): fuera de la cola.
  useLayoutEffect(() => clearPage, [clearPage]);

  const markDownloaded = useCallback((ids: readonly string[]) => {
    setDownloaded((prev) => new Set([...prev, ...ids]));
  }, []);

  async function addFiles(files: File[]) {
    if (adding || !userId || files.length === 0) return;
    const mine = session.current;
    const { files: kept, dropped } = capBatch(files, Math.max(0, BULK_MAX - batch.length));
    const invalid: AddNotice["invalid"] = [];
    setNotice(null);
    setAdding({ done: 0, total: kept.length });
    // Una a una: validar y reducir 30 fotos a la vez saturaría el móvil.
    for (const [i, file] of kept.entries()) {
      try {
        await validate(file);
        const localId = await useQueueStore
          .getState()
          .enqueue("batch", file, "cut", { sourceName: file.name });
        // Se salió o se empezó de nuevo mientras tanto: no se queda.
        if (mine !== session.current) {
          useQueueStore.getState().remove(localId);
          return;
        }
      } catch (err) {
        if (mine !== session.current) return;
        invalid.push({ name: file.name, code: isImagingError(err) ? err.code : "decode_failed" });
      }
      setAdding({ done: i + 1, total: kept.length });
      await yieldToBrowser();
      if (mine !== session.current) return;
    }
    setAdding(null);
    if (dropped > 0 || invalid.length > 0) setNotice({ dropped, invalid });
  }

  const readyItems = batch.filter((i) => i.status === "ready" && i.cutout);

  async function downloadOne(item: QueueItem) {
    if (!item.cutout) return;
    const file = names.get(item.localId)!;
    setBusy("one");
    try {
      saveBlob(await toPng(item.cutout), file);
      markDownloaded([item.localId]);
      setOpenId(null);
      show({ message: t("cutout.downloaded", { file }) });
    } catch (err) {
      console.warn("[cutout] no se pudo descargar", err);
      show({ message: t("cutout.downloadFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    if (readyItems.length === 0) return;
    const file = `${t("cutout.zipName")}.zip`;
    setBusy("zip");
    try {
      const blob = await zipBlob(
        readyItems.map((i) => ({ name: names.get(i.localId)!, png: () => toPng(i.cutout!) })),
      );
      saveBlob(blob, file);
      markDownloaded(readyItems.map((i) => i.localId));
      show({ message: t("cutout.downloadedAll", { file, count: readyItems.length }) });
    } catch (err) {
      console.warn("[cutout] no se pudo generar el ZIP", err);
      show({ message: t("cutout.downloadFailed") });
    } finally {
      setBusy(null);
    }
  }

  // Móvil: los PNG sueltos a la hoja de compartir del sistema (desde ahí se
  // guardan en Fotos). En iOS el recorte ya es PNG y no hay espera.
  async function shareAll() {
    if (readyItems.length === 0) return;
    setBusy("share");
    try {
      const files = await Promise.all(
        readyItems.map(
          async (i) =>
            new File([await toPng(i.cutout!)], names.get(i.localId)!, { type: "image/png" }),
        ),
      );
      if (!navigator.canShare?.({ files })) {
        setBusy(null);
        await downloadAll();
        return;
      }
      await navigator.share({ files });
      markDownloaded(readyItems.map((i) => i.localId));
    } catch (err) {
      // Cancelar la hoja de compartir no es un error.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.warn("[cutout] no se pudo compartir", err);
        show({ message: t("cutout.downloadFailed") });
      }
    } finally {
      setBusy(null);
    }
  }

  const removeItem = useCallback((item: QueueItem) => {
    useQueueStore.getState().remove(item.localId);
    setOpenId(null);
    setErrorId(null);
  }, []);

  const onOpen = useCallback((item: QueueItem) => {
    if (item.status === "ready") setOpenId(item.localId);
    else if (item.status === "error") setErrorId(item.localId);
  }, []);

  const opened = batch.find((i) => i.localId === openId && i.status === "ready") ?? null;
  const failedItem = batch.find((i) => i.localId === errorId && i.status === "error") ?? null;
  const full = batch.length >= BULK_MAX;
  const addDisabled = !userId || !!adding || full;
  const preparing = batch.some((i) => i.status === "cutting" && i.stage === "preparing");

  const subtitle =
    batch.length === 0
      ? t("cutout.subtitle")
      : t("cutout.progress", { ready: summary.ready, total: summary.total }) +
        (summary.failed > 0 ? ` · ${t("cutout.progressFailed", { count: summary.failed })}` : "");

  const pickButton = (variant: "primary" | "secondary", label: string, className?: string) => (
    <Button
      variant={variant}
      onClick={() => inputRef.current?.click()}
      disabled={addDisabled}
      className={className}
    >
      {label}
    </Button>
  );

  return (
    <Dropzone
      onFiles={(files) => void addFiles(files)}
      disabled={addDisabled}
      className="min-h-full"
    >
      {(dragging) => (
        <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-[20px] px-5 pt-xs pb-xl">
          <Link
            href="/settings"
            className="-ml-[6px] flex min-h-11 items-center gap-[2px] self-start text-body text-ink desktop:hidden"
          >
            <ChevronLeftIcon />
            {t("cutout.back")}
          </Link>

          <header className="flex items-end justify-between gap-sm pt-xs">
            <div className="flex min-w-0 flex-col gap-xxs">
              <h1 className="text-lead font-semibold">{t("cutout.title")}</h1>
              <p className="text-caption text-ink-muted-48" aria-live="polite">
                {subtitle}
              </p>
            </div>
            {batch.length > 0 &&
              pickButton("secondary", t("cutout.add"), "min-h-9 px-md text-caption")}
          </header>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          <div aria-live="polite" className="empty:hidden">
            {adding && (
              <p className="text-caption text-ink-muted-48">
                {t("cutout.adding", { done: adding.done, total: adding.total })}
              </p>
            )}
            {!adding && preparing && (
              <p className="text-caption text-ink-muted-48">{t("queue.status.preparing")}</p>
            )}
          </div>

          {notice && (
            <NoticeInline role="status">
              {notice.dropped > 0 && (
                <p>{t("cutout.notices.tooMany", { count: notice.dropped })}</p>
              )}
              {notice.invalid.length > 0 && (
                <>
                  <p>{t("cutout.notices.invalid", { count: notice.invalid.length })}</p>
                  <ul className="list-disc pl-md">
                    {notice.invalid.map((f, i) => (
                      <li key={i}>
                        {t("cutout.notices.invalidItem", {
                          name: f.name,
                          reason: t(IMAGING_ERROR_MESSAGE[f.code]),
                        })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </NoticeInline>
          )}

          {batch.length === 0 ? (
            <div
              className={cx(
                "flex flex-col items-center gap-md rounded-lg border-[1.5px] border-dashed px-[20px] py-[48px] text-center",
                dragging ? "border-ink bg-canvas-parchment" : "border-body-muted",
              )}
            >
              <PhotoIcon className="text-ink-muted-48" />
              <div className="flex max-w-[320px] flex-col gap-[6px]">
                <h2 className="text-body-strong">{t("cutout.empty.title")}</h2>
                <p className="text-caption text-ink-muted-80">
                  {t("cutout.empty.body")}
                  <span className="hidden desktop:inline"> {t("cutout.empty.dropHint")}</span>
                </p>
              </div>
              {pickButton("primary", t("cutout.empty.choose"))}
              <p className="text-fine-print text-ink-muted-48">{t("cutout.empty.note")}</p>
            </div>
          ) : (
            <div
              className={cx(
                "rounded-lg outline-offset-4",
                dragging && "outline-[1.5px] outline-ink outline-dashed",
              )}
            >
              <BatchGrid items={batch} names={names} onOpen={onOpen} />
            </div>
          )}

          {batch.length > 0 && !summary.busy && !adding && (
            <div className="flex w-full max-w-[420px] flex-col gap-xxs self-center">
              {summary.ready > 0 && (
                <Button
                  variant="primary"
                  fullWidth
                  disabled={busy !== null}
                  onClick={() => void downloadAll()}
                >
                  {busy === "zip"
                    ? t("cutout.zipping")
                    : t("cutout.downloadAll", { count: summary.ready })}
                </Button>
              )}
              {summary.ready > 0 && canShare && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={busy !== null}
                  onClick={() => void shareAll()}
                >
                  {t("cutout.share")}
                </Button>
              )}
              <Button
                variant="text-link"
                className="self-center"
                onClick={() => setConfirmStartOver(true)}
              >
                {t("cutout.startOver.action")}
              </Button>
            </div>
          )}

          <BatchDetailSheet
            item={opened}
            name={opened ? (names.get(opened.localId) ?? "") : ""}
            downloading={busy !== null}
            onClose={() => setOpenId(null)}
            onRemove={removeItem}
            onDownload={(item) => void downloadOne(item)}
          />

          <Dialog
            open={!!failedItem}
            title={t("cutout.errorDialog.title")}
            description={
              failedItem?.error && failedItem.error !== "cut_failed"
                ? t(IMAGING_ERROR_MESSAGE[failedItem.error])
                : t("cutout.errorDialog.tip")
            }
            confirmLabel={t("cutout.errorDialog.remove")}
            cancelLabel={t("cutout.errorDialog.keep")}
            destructive
            onConfirm={() => failedItem && removeItem(failedItem)}
            onCancel={() => setErrorId(null)}
          />

          <Dialog
            open={confirmStartOver}
            title={t("cutout.startOver.title")}
            description={
              summary.unsaved
                ? t("cutout.startOver.bodyNotDownloaded")
                : t("cutout.startOver.bodyDownloaded")
            }
            confirmLabel={t("cutout.startOver.confirm")}
            cancelLabel={t("common.cancel")}
            destructive
            onConfirm={clearPage}
            onCancel={() => setConfirmStartOver(false)}
          />

          <Dialog
            open={leaving}
            title={t("cutout.leave.title")}
            description={t("cutout.leave.body")}
            confirmLabel={t("cutout.leave.confirm")}
            cancelLabel={t("cutout.leave.cancel")}
            destructive
            onConfirm={leave}
            onCancel={stay}
          />
        </main>
      )}
    </Dropzone>
  );
}

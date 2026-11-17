"use client";

// Página temporal para probar el procesado de imagen (paso 3.5): validar,
// reducir, detectar transparencia, quitar el fondo y codificar recorte y
// miniatura, con tiempos. Se borra en el paso 7.5; puede llevar literales.
// Los resultados también quedan en window.__imaging para pruebas automáticas.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { toCutoutAndThumb, type EncodedImage } from "@/lib/imaging/encode";
import { IMAGING_ERROR_MESSAGE, isImagingError } from "@/lib/imaging/errors";
import { removeBackground, type CutoutProgress } from "@/lib/imaging/removeBackground";
import { shrink } from "@/lib/imaging/shrink";
import { hasTransparency } from "@/lib/imaging/transparency";
import { validate } from "@/lib/imaging/validate";

type Result = {
  name: string;
  original: { width: number; height: number; bytes: number; type: string };
  transparentOriginal: boolean;
  cut: boolean;
  times: { shrink: number; cut?: number; encode: number };
  shrunkBytes: number;
  /** hasTransparency del PNG recortado (debe ser true) y de la foto reducida. */
  transparentCutPng?: boolean;
  transparentShrunk: boolean;
  cutPngUrl?: string;
  cutout: EncodedImage & { url: string };
  thumb: EncodedImage & { url: string };
};

declare global {
  interface Window {
    __imaging?: { status: string; results: Omit<Result, "cutout" | "thumb">[]; error?: string };
  }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export default function DevImagingPage() {
  const t = useTranslations();
  const [forceCut, setForceCut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CutoutProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const record = (status: string, extra?: Partial<NonNullable<Window["__imaging"]>>) => {
    const prev = window.__imaging ?? { status, results: [] };
    window.__imaging = { ...prev, status, ...extra };
  };

  async function processFile(file: File) {
    const original = await validate(file);
    const transparentOriginal = await hasTransparency(file);
    const cut = forceCut || !transparentOriginal;

    let t0 = performance.now();
    const shrunk = await shrink(file, 1200);
    const shrinkMs = performance.now() - t0;
    const transparentShrunk = await hasTransparency(shrunk);

    let source: Blob = shrunk;
    let cutMs: number | undefined;
    let transparentCutPng: boolean | undefined;
    let cutPngUrl: string | undefined;
    if (cut) {
      // El cronómetro del recorte no incluye la descarga del modelo.
      let cutStart = performance.now();
      source = await removeBackground(shrunk, (p) => {
        if (p.stage === "preparing") cutStart = performance.now();
        setProgress(p);
      });
      cutMs = performance.now() - cutStart;
      transparentCutPng = await hasTransparency(source);
      cutPngUrl = URL.createObjectURL(source);
    }

    t0 = performance.now();
    const { cutout, thumb } = await toCutoutAndThumb(source);
    const encodeMs = performance.now() - t0;

    return {
      name: file.name,
      original: { ...original, bytes: file.size, type: file.type },
      transparentOriginal,
      cut,
      times: { shrink: shrinkMs, cut: cutMs, encode: encodeMs },
      shrunkBytes: shrunk.size,
      transparentCutPng,
      transparentShrunk,
      cutPngUrl,
      cutout: { ...cutout, url: URL.createObjectURL(cutout.blob) },
      thumb: { ...thumb, url: URL.createObjectURL(thumb.blob) },
    } satisfies Result;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    record("busy", { error: undefined });
    try {
      for (const file of Array.from(files)) {
        const r = await processFile(file);
        setResults((rs) => [r, ...rs]);
        const { cutout, thumb, ...plain } = r;
        const summary = {
          ...plain,
          cutoutInfo: {
            ...cutout,
            blob: undefined,
            type: cutout.blob.type,
            bytes: cutout.blob.size,
          },
          thumbInfo: { ...thumb, blob: undefined, type: thumb.blob.type, bytes: thumb.blob.size },
        };
        record("busy", { results: [...(window.__imaging?.results ?? []), summary] });
        console.info("[dev/imaging]", summary);
      }
      record("done");
    } catch (err) {
      const msg = isImagingError(err)
        ? `${err.code}: ${t(IMAGING_ERROR_MESSAGE[err.code])}`
        : String(err);
      setError(msg);
      record("error", { error: msg });
      console.error("[dev/imaging]", err);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-lg p-lg">
      <h1 className="text-display-md">Procesado de imagen · dev</h1>
      <p className="text-body text-ink-muted-48">
        Sube una foto: se valida, se reduce a 1200 px, se detecta la transparencia, se quita el
        fondo (si no es ya transparente) y se codifican recorte y miniatura.
      </p>

      <div className="flex flex-wrap items-center gap-lg">
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          data-testid="imaging-input"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <label className="flex items-center gap-xs text-body">
          <input
            type="checkbox"
            checked={forceCut}
            onChange={(e) => setForceCut(e.target.checked)}
          />
          Quitar el fondo aunque ya sea transparente
        </label>
      </div>

      {progress && (
        <div className="flex flex-col gap-xs" aria-live="polite">
          <span className="text-body">
            {progress.stage === "preparing"
              ? t("queue.status.preparing")
              : t("queue.status.cutting", { percent: Math.round(progress.fraction * 100) })}
          </span>
          {progress.fraction !== null && <ProgressBar value={progress.fraction * 100} />}
        </div>
      )}
      {error && (
        <p role="alert" className="text-body-strong">
          {error}
        </p>
      )}

      {results.map((r) => (
        <section key={r.cutout.url} className="flex flex-col gap-sm border-t border-hairline pt-lg">
          <h2 className="text-tagline">{r.name}</h2>
          <ul className="text-caption">
            <li>
              Original: {r.original.width}×{r.original.height} · {kb(r.original.bytes)} ·{" "}
              {r.original.type || "(sin tipo)"} · transparente: {String(r.transparentOriginal)}
            </li>
            <li>
              Reducir: {secs(r.times.shrink)} → PNG {kb(r.shrunkBytes)} · hasTransparency:{" "}
              {String(r.transparentShrunk)}
            </li>
            <li>
              Recortar: {r.cut ? secs(r.times.cut ?? 0) : "no (ya transparente)"}
              {r.transparentCutPng !== undefined &&
                ` · hasTransparency(PNG recortado): ${String(r.transparentCutPng)}`}
              {r.cutPngUrl && (
                <>
                  {" · "}
                  <a className="underline" href={r.cutPngUrl} download="recorte.png">
                    descargar PNG transparente
                  </a>
                </>
              )}
            </li>
            <li>Codificar: {secs(r.times.encode)}</li>
          </ul>
          <div className="flex flex-wrap items-start gap-lg">
            {[
              ["cutout", r.cutout],
              ["thumb", r.thumb],
            ].map(([label, img]) => {
              const e = img as Result["cutout"];
              return (
                <figure key={label as string} className="flex flex-col gap-xs">
                  <TransparencyChecker className="flex items-center justify-center rounded-md border border-hairline p-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob local */}
                    <img
                      src={e.url}
                      alt={label as string}
                      width={e.width}
                      height={e.height}
                      style={{ maxWidth: label === "cutout" ? 480 : 160, height: "auto" }}
                    />
                  </TransparencyChecker>
                  <figcaption className="text-caption">
                    {label as string}: {e.width}×{e.height} · {kb(e.blob.size)} · {e.blob.type}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}

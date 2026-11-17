"use client";

// Hoja "Guardar como imagen" (screens.md 9; spec 3.5; paso 6.2). Se abre
// desde el vestidor y desde el detalle del favorito.
// - Tres tarjetas: Cuadrado 1:1 · Vertical 4:5 · Story 9:16, con un icono de
//   la forma. Seleccionada como chip-filter (DESIGN.md): fondo rosa y borde
//   negro de 2 px. Empieza en 4:5, como el prototipo.
// - Vista previa: el PNG real a 1080 px (renderPng) reducido con CSS. Se
//   genera al elegir la proporción (con estado de carga) y se guarda por
//   proporción mientras la hoja está abierta. Así, al pulsar "Descargar PNG"
//   el archivo ya existe y compartir / abrir pestaña conservan el gesto del
//   usuario (download.ts).
// - `items` llegan ya resueltos: lo que se ve en pantalla (colocación
//   automática aplicada y, en el detalle, también los cambios sin guardar).
// - Errores: un recorte que no carga → mensaje y "Reintentar"; sin prendas
//   que pintar → mensaje (quien la abre ya la impide con el lienzo vacío).
// - Quien la abre le cambia la `key` en cada apertura para que empiece limpia.
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/toast";
import type { Size } from "@/features/dresser/canvas/geometry";
import type { CanvasItem } from "@/features/dresser/model";
import { exportFileName, pickSaveMethod, readSaveEnv, savePng } from "./download";
import {
  EXPORT_SIZES,
  EmptyCanvasError,
  renderPng,
  type ExportGarment,
  type ExportRatio,
} from "./renderPng";

const RATIOS: { id: ExportRatio; key: "square" | "portrait" | "story" }[] = [
  { id: "1:1", key: "square" },
  { id: "4:5", key: "portrait" },
  { id: "9:16", key: "story" },
];
const DEFAULT_RATIO: ExportRatio = "4:5";
/** Lado mayor del icono de la forma (px), como el prototipo. */
const ICON_MAX = 22;

type Rendered = { blob: Blob; url: string; width: number; height: number };
type ErrorCode = "cutout" | "empty" | "generic";

export type ExportSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Items ya resueltos, tal como se ven en pantalla. */
  items: CanvasItem[];
  garments: Record<string, ExportGarment | undefined>;
  /** Tamaño del lienzo en pantalla (px CSS). */
  canvasSize: Size;
  /** Nombre del favorito (null en el vestidor o si no tiene). */
  name: string | null;
  /** Fecha para el nombre del archivo si no hay nombre. */
  date: Date;
};

function RatioIcon({ ratio }: { ratio: ExportRatio }) {
  const { width, height } = EXPORT_SIZES[ratio];
  const k = ICON_MAX / Math.max(width, height);
  return (
    <span
      aria-hidden="true"
      className="block rounded-[3px] border-[1.5px] border-ink"
      style={{ width: Math.round(width * k), height: Math.round(height * k) }}
    />
  );
}

export function ExportSheet({
  open,
  onClose,
  items,
  garments,
  canvasSize,
  name,
  date,
}: ExportSheetProps) {
  const t = useTranslations("export");
  const tCommon = useTranslations("common");
  const { show } = useToast();
  const [ratio, setRatio] = useState<ExportRatio>(DEFAULT_RATIO);
  const [rendered, setRendered] = useState<Partial<Record<ExportRatio, Rendered>>>({});
  const [errors, setErrors] = useState<Partial<Record<ExportRatio, ErrorCode>>>({});
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const urls = useRef<string[]>([]);

  const current = rendered[ratio];
  const error = errors[ratio];
  // En el vestidor los recortes pueden estar llegando (undefined): se espera.
  const waiting = items.some((i) => garments[i.garmentId]?.cutoutUrl === undefined);
  const target = EXPORT_SIZES[ratio];

  // Genera el PNG de la proporción elegida si aún no está.
  useEffect(() => {
    if (!open || current || error || waiting) return;
    let alive = true;
    renderPng({ items, garments, canvasSize, ratio })
      .then(({ blob, width, height }) => {
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        if (!alive) return;
        setRendered((r) => ({ ...r, [ratio]: { blob, url, width, height } }));
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const code: ErrorCode =
          err instanceof EmptyCanvasError
            ? "empty"
            : err instanceof Error && err.message === "cutout_load_failed"
              ? "cutout"
              : "generic";
        if (code === "generic") console.warn("[export] no se ha podido generar el PNG", err);
        setErrors((e) => ({ ...e, [ratio]: code }));
      });
    return () => {
      alive = false;
    };
  }, [open, ratio, current, error, waiting, items, garments, canvasSize, attempt]);

  // Al desmontar, se liberan los PNG.
  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const retry = () => {
    setErrors({});
    setAttempt((a) => a + 1);
  };

  const download = async () => {
    if (!current || saving) return;
    setSaving(true);
    setSaveError(false);
    const fileName = exportFileName(name, date, ratio);
    try {
      const result = await savePng(
        current.blob,
        fileName,
        pickSaveMethod(readSaveEnv()),
        t("openHint"),
      );
      if (result === "cancelled") return;
      onClose();
      if (result === "downloaded") show({ message: t("downloaded", { file: fileName }) });
    } catch (err) {
      console.warn("[export] no se ha podido guardar el PNG", err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const errorText =
    error === "cutout" ? t("errorCutout") : error === "empty" ? t("errorEmpty") : t("errorGeneric");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tCommon("close")}
      footer={
        <div className="flex flex-col gap-xs">
          {saveError && (
            <p role="alert" className="text-center text-caption">
              {t("saveError")}
            </p>
          )}
          <Button fullWidth disabled={!current || saving} onClick={() => void download()}>
            {t("download")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-[20px] pt-xs">
        <div role="group" aria-label={t("ratioLabel")} className="grid grid-cols-3 gap-xs">
          {RATIOS.map((r) => {
            const selected = r.id === ratio;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setRatio(r.id);
                  setSaveError(false);
                }}
                className={cx(
                  "flex min-h-11 cursor-pointer flex-col items-center gap-xs rounded-lg text-ink active:scale-[0.97]",
                  // Al pasar de 1 a 2 px de borde se quita 1 px de relleno: no salta.
                  selected
                    ? "border-2 border-ink bg-primary px-[7px] py-[11px]"
                    : "border border-hairline bg-transparent px-xs py-sm",
                )}
              >
                <span className="flex size-[22px] items-center justify-center">
                  <RatioIcon ratio={r.id} />
                </span>
                <span className="flex flex-col items-center">
                  <span className="text-caption">{t(`ratio.${r.key}`)}</span>
                  <span className="text-fine-print text-ink-muted-48">{r.id}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex h-[280px] items-center justify-center tablet:h-[320px]">
          <div
            className="relative h-full overflow-hidden rounded-sm border border-hairline bg-canvas-parchment"
            style={{ aspectRatio: `${target.width} / ${target.height}` }}
          >
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element -- PNG local (object URL)
              <img
                src={current.url}
                alt={t("previewAlt")}
                className="block h-full w-full object-contain"
              />
            ) : error ? (
              <div
                role="alert"
                className="absolute inset-0 flex flex-col items-center justify-center gap-sm p-sm text-center"
              >
                <p className="text-caption">{errorText}</p>
                {error !== "empty" && (
                  <Button variant="secondary" onClick={retry}>
                    {tCommon("retry")}
                  </Button>
                )}
              </div>
            ) : (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center p-sm text-center text-caption text-ink-muted-48 motion-safe:animate-pulse"
              >
                {t("preparing")}
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-fine-print text-ink-muted-48">
          {t("meta", { width: target.width, height: target.height })}
        </p>
      </div>
    </Sheet>
  );
}

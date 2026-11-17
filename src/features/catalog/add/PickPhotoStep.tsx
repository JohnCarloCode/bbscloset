"use client";

// Paso 1 de "Añadir prenda" (screens.md 5.1): un único botón "Elegir fotos"
// (sin `capture`, para que el móvil ofrezca cámara o galería) y el consejo
// fijo. La foto se valida aquí (formato, ~10 MB, HEIC que el navegador no
// abre) y se detecta su transparencia para el paso 2. Los errores salen en
// línea y la hoja sigue abierta. Antes se comprueba el límite de 500
// prendas contando lo del servidor y lo pendiente en la cola (decisión 3).
// Varias fotos → subida masiva (5.5, paso 3.12): tras comprobar el límite se
// pasan todas a `onSeveral` (la pantalla resumen las valida una a una).
// "Cambiar foto" de la ficha (5.4, paso 3.10) lo reutiliza con una sola foto
// y sin comprobar el límite (la prenda ya existe).
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { WarningIcon } from "@/components/icons";
import { IMAGING_ERROR_MESSAGE, isImagingError } from "@/lib/imaging/errors";
import { hasTransparency } from "@/lib/imaging/transparency";
import { validate } from "@/lib/imaging/validate";
import { useQueueStore } from "@/features/queue/store";
import { fetchRoomLeft } from "./limit";

/** Clave de messages del error en línea. */
type PickError =
  | (typeof IMAGING_ERROR_MESSAGE)[keyof typeof IMAGING_ERROR_MESSAGE]
  | "catalog.addGarment.pick.full";

export type PickPhotoStepProps = {
  /** Foto válida elegida, con su transparencia detectada. */
  onPicked: (file: File, hasAlpha: boolean) => void;
  /**
   * Varias fotos (subida masiva, 5.5), con el sitio libre bajo el límite de
   * 500 (null si no se pudo preguntar o no se comprueba).
   */
  onSeveral?: (files: File[], room: number | null) => void;
  /** Permitir varias fotos (subida masiva). Por defecto, sí. */
  multiple?: boolean;
  /** Comprobar el límite de 500 prendas antes. Por defecto, sí. */
  checkRoom?: boolean;
};

export function PickPhotoStep({
  onPicked: pickPhoto,
  onSeveral: pickSeveral,
  multiple = true,
  checkRoom = true,
}: PickPhotoStepProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const tipId = useId();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<PickError | null>(null);
  // Si la hoja se cierra mientras se comprueba la foto, el resultado se ignora.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function onSingle(file: File) {
    setChecking(true);
    try {
      if (checkRoom) {
        const room = await fetchRoomLeft(useQueueStore.getState().items);
        if (!alive.current) return;
        if (room === 0) {
          setError("catalog.addGarment.pick.full");
          setChecking(false);
          return;
        }
      }
      await validate(file);
      const alpha = await hasTransparency(file);
      if (alive.current) pickPhoto(file, alpha);
    } catch (err) {
      if (!alive.current) return;
      setError(
        isImagingError(err) ? IMAGING_ERROR_MESSAGE[err.code] : IMAGING_ERROR_MESSAGE.decode_failed,
      );
      setChecking(false);
    }
  }

  // Subida masiva (5.5): comprueba que cabe alguna y pasa a la pantalla resumen.
  async function onSeveral(files: File[]) {
    if (!pickSeveral) return;
    let room: number | null = null;
    if (checkRoom) {
      setChecking(true);
      room = await fetchRoomLeft(useQueueStore.getState().items);
      if (!alive.current) return;
      setChecking(false);
      if (room === 0) {
        setError("catalog.addGarment.pick.full");
        return;
      }
    }
    pickSeveral(files, room);
  }

  function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    setError(null);
    if (files.length === 1) void onSingle(files[0]);
    else if (files.length > 1) void onSeveral(files);
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-md py-lg text-center">
      <Button
        variant="primary"
        onClick={() => inputRef.current?.click()}
        disabled={checking}
        aria-describedby={tipId}
      >
        {t("catalog.addGarment.pick.button")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          const { files } = e.target;
          onFiles(files);
          e.target.value = "";
        }}
      />
      <p id={tipId} className="max-w-[320px] text-caption text-ink-muted-48">
        {t("catalog.addGarment.pick.tip")}
      </p>
      <div aria-live="polite" className="min-h-[1lh] max-w-[360px] text-caption">
        {checking && (
          <span className="text-ink-muted-48">{t("catalog.addGarment.pick.checking")}</span>
        )}
      </div>
      {error && (
        <p role="alert" className="flex max-w-[360px] items-start gap-[6px] text-left text-caption">
          <WarningIcon size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </p>
      )}
    </div>
  );
}

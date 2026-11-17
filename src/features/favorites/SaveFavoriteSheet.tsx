"use client";

// Hoja "Guardar en favoritos" (screens.md 8; spec 3.4; paso 5.2): vista
// previa del collage (el mismo lienzo, no editable y a escala, con las
// proporciones del lienzo del vestidor para que las posiciones coincidan),
// nombre opcional (vacío → la lista muestra la fecha) y "Guardar favorito".
// - Se guarda el lienzo tal cual (canvasToFavoriteItems): manuales con su
//   posición, automáticos a null. No se comprueban duplicados.
// - Al guardar: se cierra y sale "Guardado en Favoritos." + "Ver"
//   (/favorites/{id}). Si falla, error en línea y la hoja sigue abierta.
// - Quien la abre le cambia la `key` en cada apertura para que empiece limpia.
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/toast";
import { OutfitCanvasLazy, type CanvasGarment } from "@/features/dresser/canvas/OutfitCanvasLazy";
import type { CanvasState } from "@/features/dresser/model";
import { formatShortDate } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import { FAVORITE_NAME_MAX, type Favorite } from "@/lib/api/types";
import type { CanvasSize } from "@/lib/layout/autoLayout";
import { canvasToFavoriteItems } from "./canvasToFavoriteItems";
import { markFavoritesChanged } from "./listFreshness";

/** Caja máxima de la vista previa (px); el prototipo usa 150 de ancho. */
const PREVIEW_MAX = { width: 200, height: 240 };
/** Proporción de la vista previa si el lienzo aún no se ha medido (alto/ancho). */
const FALLBACK_RATIO = 1.25;

/** Tamaño de la vista previa con la misma proporción que el lienzo. */
export function previewSize(canvasSize: CanvasSize): { width: number; height: number } {
  const ratio =
    canvasSize.width > 0 && canvasSize.height > 0
      ? canvasSize.height / canvasSize.width
      : FALLBACK_RATIO;
  const width = Math.min(PREVIEW_MAX.width, PREVIEW_MAX.height / ratio);
  return { width: Math.round(width), height: Math.round(width * ratio) };
}

export type SaveFavoriteSheetProps = {
  open: boolean;
  onClose: () => void;
  canvas: CanvasState;
  garments: Record<string, CanvasGarment>;
  /** Tamaño del lienzo del vestidor: da la proporción de la vista previa. */
  canvasSize: CanvasSize;
};

export function SaveFavoriteSheet({
  open,
  onClose,
  canvas,
  garments,
  canvasSize,
}: SaveFavoriteSheetProps) {
  const t = useTranslations("favorites.save");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { show } = useToast();
  const formId = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty = canvas.items.length === 0;
  const today = formatShortDate(new Date(), locale);
  const box = previewSize(canvasSize);

  const save = async () => {
    if (busy || empty) return;
    setBusy(true);
    setError(null);
    try {
      const favorite = await apiFetch<Favorite>("/api/favorites", {
        method: "POST",
        json: { name: name.trim() || null, items: canvasToFavoriteItems(canvas) },
      });
      markFavoritesChanged();
      onClose();
      show({
        message: t("saved"),
        actionLabel: tCommon("view"),
        onAction: () => router.push(`/favorites/${favorite.id}`),
      });
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      console.warn("[save-favorite] no se ha podido guardar", err);
      setError(
        isApiClientError(err) && err.code === "network"
          ? t("offline")
          : isApiClientError(err) && err.code === "invalid_garments"
            ? t("invalidGarments")
            : t("error"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tCommon("close")}
      footer={
        <div className="flex flex-col gap-xs">
          {error && (
            <p role="alert" className="text-center text-caption">
              {error}
            </p>
          )}
          <Button type="submit" form={formId} fullWidth disabled={busy || empty}>
            {t("submit")}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-[20px] pt-xs"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div
          className="self-center overflow-hidden rounded-lg border border-hairline"
          style={{ width: box.width, height: box.height }}
        >
          <OutfitCanvasLazy items={canvas.items} garments={garments} editable={false} />
        </div>
        <TextField
          label={t("nameLabel")}
          hint={t("nameHint", { date: today })}
          placeholder={t("namePlaceholder")}
          value={name}
          maxLength={FAVORITE_NAME_MAX}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
        />
      </form>
    </Sheet>
  );
}

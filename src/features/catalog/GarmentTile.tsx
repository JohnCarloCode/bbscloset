"use client";

// Tarjeta de prenda del catálogo (`garment-tile`, DESIGN.md; tarjeta del
// prototipo): miniatura cuadrada sobre canvas-parchment con el recorte
// centrado, nombre (o el tipo traducido si no tiene) y "hueco · marca".
// La miniatura se carga en diferido (loading="lazy", decoding="async").
// Modo selección (3.11, screens.md 4.2): la tarjeta es un checkbox
// (`role="checkbox"`, `aria-checked`) con un círculo marcable arriba a la
// derecha; tocarla la marca o desmarca en vez de abrir la ficha. Marcada,
// borde negro de 2 px y círculo rosa con la marca (como el prototipo).
import { memo } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { CheckIcon } from "@/components/icons";
import type { Garment } from "@/lib/api/types";
import { useSignedSrc } from "@/lib/storage/useSignedSrc";

/** Lado de la miniatura en Storage (thumb.webp, paso 3.5). */
const THUMB_SIZE = 320;

export type GarmentTileProps = {
  garment: Garment;
  /** Modo selección (3.11): la tarjeta se marca en vez de abrir la ficha. */
  selecting?: boolean;
  selected?: boolean;
  onOpen?: (garment: Garment) => void;
  onToggle?: (id: string) => void;
};

export const GarmentTile = memo(function GarmentTile({
  garment,
  selecting = false,
  selected = false,
  onOpen,
  onToggle,
}: GarmentTileProps) {
  const tTypes = useTranslations("types");
  const tSlots = useTranslations("slots");
  // Si la URL firmada ha caducado se renueva y se reintenta una vez (7.6);
  // si aun así no carga, el fondo queda liso.
  const { src: thumbUrl, onError } = useSignedSrc(garment.thumbUrl);

  const title = garment.name || tTypes(garment.type_id);
  const meta = [tSlots(garment.slot), garment.brand].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => (selecting ? onToggle?.(garment.id) : onOpen?.(garment))}
      role={selecting ? "checkbox" : undefined}
      aria-checked={selecting ? selected : undefined}
      className={cx(
        "flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg bg-canvas text-left",
        "active:scale-[0.98]",
        selecting && selected ? "border-2 border-ink" : "border border-hairline",
      )}
    >
      <span className="relative flex aspect-square items-center justify-center bg-canvas-parchment">
        {selecting && (
          <span
            aria-hidden="true"
            className={cx(
              "absolute top-xs right-xs z-[1] flex size-6 items-center justify-center rounded-full",
              "border-2 border-ink text-ink",
              selected ? "bg-primary" : "bg-canvas",
            )}
          >
            {selected && <CheckIcon />}
          </span>
        )}
        {thumbUrl && (
          // Miniatura WebP ya reducida (≤ 320 px) con URL firmada de Supabase:
          // no pasa por el optimizador de next/image. La prenda ocupa ~62 % del
          // cuadro, como en el prototipo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={onError}
            className="absolute inset-0 size-full object-contain p-[19%]"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-[2px] px-[14px] pt-[10px] pb-[14px]">
        <span className="truncate text-caption-strong text-ink">{title}</span>
        <span className="truncate text-fine-print leading-[1.5] text-ink-muted-48">{meta}</span>
      </span>
    </button>
  );
});

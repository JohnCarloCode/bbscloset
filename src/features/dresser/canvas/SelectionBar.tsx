"use client";

// Barra del lienzo con una prenda seleccionada (screens.md 7.1): "Traer
// delante · Enviar atrás · Quitar". Va abajo del lienzo, encima de él, como
// en el prototipo; botones `button-pearl-capsule` (DESIGN.md) de 44 px.
// No confundir con la SelectionBar del catálogo (modo selección).
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";

export type CanvasSelectionBarProps = {
  garmentLabel: string;
  canForward: boolean;
  canBackward: boolean;
  onForward: () => void;
  onBackward: () => void;
  onRemove: () => void;
  className?: string;
};

const capsule =
  "min-h-11 cursor-pointer rounded-md border-[3px] border-divider-soft bg-surface-pearl " +
  "px-[14px] text-caption whitespace-nowrap text-ink-muted-80 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export function SelectionBar({
  garmentLabel,
  canForward,
  canBackward,
  onForward,
  onBackward,
  onRemove,
  className,
}: CanvasSelectionBarProps) {
  const t = useTranslations("dresser.canvas");
  return (
    <div
      role="toolbar"
      aria-label={t("selectionLabel", { name: garmentLabel })}
      className={cx("flex gap-[6px]", className)}
    >
      <button type="button" className={capsule} disabled={!canForward} onClick={onForward}>
        {t("bringForward")}
      </button>
      <button type="button" className={capsule} disabled={!canBackward} onClick={onBackward}>
        {t("sendBackward")}
      </button>
      <button type="button" className={capsule} onClick={onRemove}>
        {t("remove")}
      </button>
    </div>
  );
}

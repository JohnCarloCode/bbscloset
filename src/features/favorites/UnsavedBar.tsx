"use client";

// Barra "Cambios sin guardar · Cancelar · Guardar" del detalle del favorito
// (screens.md 11; prototipo: barra translúcida abajo, encima de la ayuda).
// Va pegada al final de la pantalla, sobre la barra de pestañas. Lleva
// `data-selection-bar` para que los toasts y la queue-pill suban por encima
// (globals.css fija entonces --selection-bar-h, que es también su alto).
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";

export type UnsavedBarProps = {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  className?: string;
};

export function UnsavedBar({ saving, onCancel, onSave, className }: UnsavedBarProps) {
  const t = useTranslations("favorites.detail");
  const tCommon = useTranslations("common");
  return (
    <div
      role="region"
      aria-label={t("unsaved")}
      data-selection-bar=""
      className={cx(
        "flex h-(--selection-bar-h) items-center justify-between gap-sm",
        "border-t border-hairline bg-canvas-parchment/80 pr-md pl-5 backdrop-blur-xl backdrop-saturate-[1.8]",
        className,
      )}
    >
      <p role="status" className="min-w-0 truncate text-caption text-ink-muted-80">
        {t("unsaved")}
      </p>
      <div className="flex shrink-0 gap-xs">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          {tCommon("cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={saving}
          aria-busy={saving || undefined}
        >
          {tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

"use client";

// Barra inferior del modo selección (3.11, screens.md 4.2): "3 seleccionadas"
// (anunciado con aria-live), botón principal "Archivar" (o "Desarchivar" en
// Archivadas) y "Cancelar". En móvil y tablet va justo encima de la barra de
// pestañas; en escritorio, abajo del contenido, a la derecha de la barra
// lateral. Mientras se ve, `data-selection-bar` fija --selection-bar-h
// (globals.css) y la queue-pill y los toasts suben por encima.
// Archivar es reversible: no hay diálogo, el aviso lleva "Deshacer"
// (screens.md, reglas comunes y 4.2).
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import type { CatalogView } from "./store";

export type SelectionBarProps = {
  view: CatalogView;
  count: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SelectionBar({ view, count, busy, onConfirm, onCancel }: SelectionBarProps) {
  const t = useTranslations("catalog.select");
  const tCommon = useTranslations("common");

  return (
    <div
      role="region"
      aria-label={t("barLabel")}
      data-selection-bar=""
      className={cx(
        "fixed inset-x-0 bottom-(--tab-bar-h) z-40 h-(--selection-bar-h)",
        "desktop:left-[232px]",
        "flex items-center gap-sm border-t border-hairline bg-canvas px-md py-xs",
      )}
    >
      <Button variant="text-link" onClick={onCancel} className="px-xxs">
        {tCommon("cancel")}
      </Button>
      <p
        aria-live="polite"
        className="min-w-0 flex-1 truncate text-center text-caption text-ink-muted-80"
      >
        {t("count", { count })}
      </p>
      <Button
        variant="primary"
        onClick={onConfirm}
        disabled={count === 0 || busy}
        aria-busy={busy || undefined}
      >
        {view === "archived" ? t("unarchive") : t("archive")}
      </Button>
    </div>
  );
}

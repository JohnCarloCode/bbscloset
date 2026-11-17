"use client";

// Confirmación antes de eliminar una prenda (screens.md 4.3, spec 2.5 y 3.4):
// en cuántos favoritos aparece y, si alguno se quedaría vacío, que también se
// eliminará (lo hace el trigger de la BD). Usa el diálogo destructivo común.
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/Dialog";
import type { GarmentUsageResponse } from "@/lib/api/types";
import { deleteNotices } from "./logic";

export type DeleteDialogProps = {
  /** null = cerrado. */
  usage: GarmentUsageResponse | null;
  /** Nombre que se muestra (el puesto o el tipo). */
  garmentName: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteDialog({
  usage,
  garmentName,
  deleting,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const t = useTranslations();
  const description = usage
    ? deleteNotices(usage)
        .map((n) =>
          n.key === "usage"
            ? t("catalog.edit.deleteUsage", { count: n.count })
            : n.key === "kept"
              ? t("catalog.edit.deleteKept", { count: n.count })
              : n.key === "empty"
                ? t("catalog.edit.deleteEmpty", { count: n.count })
                : t("catalog.edit.deleteIrreversible"),
        )
        .join(" ")
    : undefined;

  return (
    <Dialog
      open={usage !== null}
      destructive
      title={t("catalog.edit.deleteTitle", { garment: garmentName })}
      description={description}
      confirmLabel={t("catalog.edit.delete")}
      cancelLabel={t("common.cancel")}
      confirmDisabled={deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

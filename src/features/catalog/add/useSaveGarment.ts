"use client";

// Guardar la prenda del paso 3 (screens.md 5.3): los datos van al item de la
// cola (setGarmentData). Si el recorte ya está, la cola la sube enseguida; si
// no, queda pendiente y se sube sola al terminar.
// Avisos (sin duplicar el de fin de tanda de la cola, screens.md 6):
// - con el recorte hecho: "Añadida a Capa base." (+ "Añadir otra" si se
//   cierra la hoja). La prenda queda marcada `announced` y no entra en el
//   "N prendas listas para el vestidor" de la cola;
// - recortando aún: "Guardada. Camisa estará lista cuando acabe el recorte.";
//   ese "N prendas listas para el vestidor" de la cola es el aviso de que ya
//   lo está (como el prototipo).
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/toast";
import { useQueueStore } from "@/features/queue/store";
import { slotOfType } from "@/lib/domain/types";
import { displayName, isGarmentFormValid, toGarmentData } from "../form/logic";
import { useAddGarment } from "./store";

/** Devuelve `save(again)`: again = "Guardar y añadir otra" (vuelve a 5.1 sin cerrar). */
export function useSaveGarment(): (again: boolean) => void {
  const t = useTranslations();
  const { show } = useToast();

  return useCallback(
    (again: boolean) => {
      const add = useAddGarment.getState();
      const { draft, localId } = add;
      if (!localId || !draft.typeId || !isGarmentFormValid(draft)) return;
      const queue = useQueueStore.getState();
      const item = queue.items.find((i) => i.localId === localId);
      if (!item) {
        // La foto salió de la cola (p. ej. "Quitar" en la hoja de la cola).
        add.close();
        return;
      }
      const ready = item.status === "ready" && !!item.cutout;
      queue.setGarmentData(localId, toGarmentData(draft), { announced: ready });

      const typeLabel = t(`types.${draft.typeId}`);
      const message = ready
        ? t("catalog.addGarment.data.added", { slot: t(`slots.${slotOfType(draft.typeId)}`) })
        : t("catalog.addGarment.data.savedPending", {
            garment: displayName(draft.name, typeLabel),
          });

      if (again) {
        add.restart();
        show({ message });
      } else {
        add.finish();
        show(
          ready
            ? {
                message,
                actionLabel: t("catalog.addGarment.data.addAnother"),
                onAction: () => useAddGarment.getState().open(),
              }
            : { message },
        );
      }
    },
    [show, t],
  );
}

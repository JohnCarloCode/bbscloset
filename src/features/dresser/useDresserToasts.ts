"use client";

// Avisos del vestidor (screens 7.2): sustituciones entre huecos y joyería al
// máximo (+ "Deshacer"), y categorías del aleatorio sin prendas (+ "Añadir
// uno", abre la hoja de añadir). Las prendas se nombran por su nombre o, si
// no tienen, por su tipo con artículo ("la camiseta").
import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useToast } from "@/components/toast";
import { useAddGarment } from "@/features/catalog/add/store";
import type { SlotId } from "@/lib/domain/slots";
import type { CanvasItem } from "./model";
import { useDresserStore, type TapResult } from "./store";

// Pone en mayúscula el principio de cada frase (los nombres van en minúscula).
function sentenceCase(text: string): string {
  return text.replace(
    /(^|[.!?]\s+)(\p{Ll})/gu,
    (_, pre: string, c: string) => pre + c.toUpperCase(),
  );
}

/**
 * Clave del select de los mensajes: el tipo de la prenda, o "named" si
 * tiene nombre propio (o no se conoce: entonces `fallback`).
 */
function refArgs(garmentId: string, fallback: string): { type: string; name: string } {
  const g = useDresserStore.getState().garments[garmentId];
  const name = g ? (g.label?.trim() ?? "") : fallback;
  return name || !g ? { type: "named", name } : { type: g.typeId, name: "" };
}

export function useDresserToasts() {
  const t = useTranslations("dresser.toast");
  const tRandom = useTranslations("dresser.random");
  const tCommon = useTranslations("common");
  const tSlots = useTranslations("slots");
  const locale = useLocale();
  const { show } = useToast();
  const openAdd = useAddGarment((a) => a.open);

  /** Nombre de una prenda para un aviso ("la camiseta"; con `to`, "a la camiseta"). */
  const refOf = useCallback(
    (garmentId: string, slotId: SlotId, to = false) => {
      const args = refArgs(garmentId, tSlots(slotId).toLowerCase());
      return to ? t("refTo", args) : t("ref", args);
    },
    [t, tSlots],
  );

  const undo = useCallback(() => useDresserStore.getState().undo(), []);

  /** Avisos de tocar una prenda del panel. */
  const showTapEvents = useCallback(
    (garmentId: string, slotId: SlotId, { events, removed }: TapResult) => {
      if (removed) return;
      const crossed: CanvasItem[] = events.removedByFullBody;
      if (crossed.length > 0) {
        const parts = crossed.map((i, k) => refOf(i.garmentId, i.slotId, k === 0));
        const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(parts);
        show({
          message: sentenceCase(
            t("replacedBy", {
              name: refOf(garmentId, slotId),
              subject: refArgs(garmentId, "").type,
              list,
            }),
          ),
          actionLabel: tCommon("undo"),
          onAction: undo,
        });
        return;
      }
      const dropped = events.jewelryDropped;
      if (dropped) {
        show({
          message: sentenceCase(
            t("jewelryDropped", {
              max: useDresserStore.getState().jewelryMax,
              name: refOf(dropped.garmentId, dropped.slotId),
              type: refArgs(dropped.garmentId, "").type,
            }),
          ),
          actionLabel: tCommon("undo"),
          onAction: undo,
        });
      }
    },
    [locale, refOf, show, t, tCommon, undo],
  );

  /** Aviso de categorías del aleatorio sin ninguna prenda en uso. */
  const showMissing = useCallback(
    (empty: SlotId[]) => {
      if (empty.length === 0) return;
      const list = new Intl.ListFormat(locale, { type: "disjunction" }).format(
        empty.map((slot) => tRandom("slotPlural", { slot })),
      );
      show({
        message: tRandom("missing", { list }),
        actionLabel: tRandom("addOne", { slot: empty.length === 1 ? empty[0] : "many" }),
        onAction: openAdd,
      });
    },
    [locale, openAdd, show, tRandom],
  );

  return { showTapEvents, showMissing };
}

"use client";

// Datos que el lienzo necesita de cada prenda del lienzo (recorte, nombre
// para lectores de pantalla y aspecto). Lo usan el vestidor y la vista
// previa de "Guardar en favoritos".
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CanvasGarment } from "./canvas/OutfitCanvasLazy";
import type { CanvasItem } from "./model";
import { useDresserStore } from "./store";

export function useCanvasGarments(items: CanvasItem[]): Record<string, CanvasGarment> {
  const tTypes = useTranslations("types");
  const garments = useDresserStore((s) => s.garments);
  return useMemo(() => {
    const out: Record<string, CanvasGarment> = {};
    for (const { garmentId } of items) {
      const g = garments[garmentId];
      if (!g) continue;
      out[garmentId] = {
        id: garmentId,
        cutoutUrl: g.cutoutUrl ?? null,
        label: g.label || tTypes(g.typeId),
        aspect: g.aspect,
      };
    }
    return out;
  }, [items, garments, tTypes]);
}

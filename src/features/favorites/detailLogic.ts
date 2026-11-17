// Lógica pura del detalle del favorito (paso 5.4; screens.md 11; spec 3.4).
// Sin React ni red.
// - favoriteToCanvas: items del GET → estado del lienzo (unidades de
//   dresser/model.ts). Con posición guardada → manual (se respeta tal cual);
//   sin ella → automático (la recoloca `relayout`, como en el vestidor).
//   z: la guardada o la `defaultZ` del hueco; placedAt: el orden del GET.
// - favoritePatch: cuerpo del PATCH (posiciones de TODAS las prendas, como
//   canvasToFavoriteItems: null si no son manuales, la z siempre).
// - isDirty: hay cambios sin guardar si el PATCH que se mandaría difiere del
//   del último guardado. Así no cuentan los reajustes de la colocación
//   automática (tamaño del lienzo, aspecto real de un recorte), que no se
//   guardan, y sí cualquier gesto o cambio de orden.
import { DEFAULT_TRANSFORM, type CanvasItem, type CanvasState } from "@/features/dresser/model";
import type { Favorite } from "@/lib/api/types";
import { SLOTS } from "@/lib/domain/slots";
import { canvasToFavoriteItems, type FavoriteItemPayload } from "./canvasToFavoriteItems";

export function favoriteToCanvas(favorite: Pick<Favorite, "items">): CanvasState {
  return {
    items: favorite.items.map((i, index): CanvasItem => {
      const manual = i.x !== null && i.y !== null && i.scale !== null;
      return {
        garmentId: i.garment_id,
        slotId: i.slot,
        x: manual ? (i.x as number) : DEFAULT_TRANSFORM.x,
        y: manual ? (i.y as number) : DEFAULT_TRANSFORM.y,
        scale: manual ? (i.scale as number) : DEFAULT_TRANSFORM.scale,
        rotation: i.rotation ?? 0,
        z: i.z ?? SLOTS[i.slot].defaultZ,
        locked: false,
        manual,
        placedAt: index,
      };
    }),
  };
}

export type FavoritePatchBody = { items: FavoriteItemPayload[] };

export function favoritePatch(canvas: CanvasState): FavoritePatchBody {
  return { items: canvasToFavoriteItems(canvas) };
}

function sameItem(a: FavoriteItemPayload, b: FavoriteItemPayload): boolean {
  return (
    a.garment_id === b.garment_id &&
    a.x === b.x &&
    a.y === b.y &&
    a.scale === b.scale &&
    a.rotation === b.rotation &&
    a.z === b.z
  );
}

export function isDirty(saved: CanvasState, current: CanvasState): boolean {
  if (saved === current) return false;
  const a = canvasToFavoriteItems(saved);
  const b = new Map(canvasToFavoriteItems(current).map((i) => [i.garment_id, i]));
  if (a.length !== b.size) return true;
  return a.some((i) => {
    const other = b.get(i.garment_id);
    return !other || !sameItem(i, other);
  });
}

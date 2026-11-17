import { describe, expect, it } from "vitest";
import { bringForward, updateTransform } from "@/features/dresser/model";
import { relayout } from "@/features/dresser/store";
import type { FavoriteItem } from "@/lib/api/types";
import { SLOTS } from "@/lib/domain/slots";
import { favoritePatch, favoriteToCanvas, isDirty } from "./detailLogic";

function fav(over: Partial<FavoriteItem> & { garment_id: string }): FavoriteItem {
  return {
    type_id: "tshirt",
    slot: "base_layer",
    name: null,
    archived: false,
    cutoutUrl: null,
    x: null,
    y: null,
    scale: null,
    rotation: null,
    z: null,
    ...over,
  };
}

const ITEMS: FavoriteItem[] = [
  fav({ garment_id: "top", x: 0.3, y: 0.25, scale: 0.5, rotation: 12, z: 7 }),
  fav({ garment_id: "jeans", type_id: "jeans", slot: "bottom" }),
  fav({ garment_id: "shoes", type_id: "sneakers", slot: "footwear", z: 30 }),
];

const SIZE = { width: 360, height: 480 };

describe("favoriteToCanvas", () => {
  it("con posición guardada → manual y tal cual; sin ella → automático", () => {
    const { items } = favoriteToCanvas({ items: ITEMS });
    expect(items[0]).toMatchObject({
      garmentId: "top",
      manual: true,
      x: 0.3,
      y: 0.25,
      scale: 0.5,
      rotation: 12,
      z: 7,
      locked: false,
      placedAt: 0,
    });
    expect(items[1]).toMatchObject({
      garmentId: "jeans",
      slotId: "bottom",
      manual: false,
      rotation: 0,
      z: SLOTS.bottom.defaultZ,
      placedAt: 1,
    });
    expect(items[2]).toMatchObject({ manual: false, z: 30 });
  });

  it("relayout coloca los automáticos y no toca los guardados", () => {
    const canvas = favoriteToCanvas({ items: ITEMS });
    const laid = relayout(canvas, () => 0.8, SIZE);
    expect(laid.items[0]).toEqual(canvas.items[0]);
    expect(laid.items[1]).not.toEqual(canvas.items[1]);
    expect(laid.items[1].manual).toBe(false);
  });
});

describe("favoritePatch", () => {
  it("posiciones de todas las prendas: null las automáticas, la z siempre", () => {
    const laid = relayout(favoriteToCanvas({ items: ITEMS }), () => 1, SIZE);
    expect(favoritePatch(laid)).toEqual({
      items: [
        { garment_id: "top", x: 0.3, y: 0.25, scale: 0.5, rotation: 12, z: 7 },
        {
          garment_id: "jeans",
          x: null,
          y: null,
          scale: null,
          rotation: null,
          z: SLOTS.bottom.defaultZ,
        },
        { garment_id: "shoes", x: null, y: null, scale: null, rotation: null, z: 30 },
      ],
    });
  });

  it("una prenda movida a mano pasa a guardar su posición", () => {
    const moved = updateTransform(favoriteToCanvas({ items: ITEMS }), "jeans", {
      x: 0.6,
      y: 0.7,
      scale: 0.4,
      rotation: 0,
    });
    expect(favoritePatch(moved).items[1]).toEqual({
      garment_id: "jeans",
      x: 0.6,
      y: 0.7,
      scale: 0.4,
      rotation: 0,
      z: SLOTS.bottom.defaultZ,
    });
  });
});

describe("isDirty", () => {
  const saved = favoriteToCanvas({ items: ITEMS });

  it("recién cargado: sin cambios", () => {
    expect(isDirty(saved, saved)).toBe(false);
  });

  it("la colocación automática (tamaño o aspecto) no cuenta como cambio", () => {
    expect(
      isDirty(
        saved,
        relayout(saved, () => 0.7, SIZE),
      ),
    ).toBe(false);
    expect(
      isDirty(
        saved,
        relayout(saved, () => 1.4, { width: 900, height: 500 }),
      ),
    ).toBe(false);
  });

  it("mover una prenda es un cambio", () => {
    const moved = updateTransform(saved, "top", { x: 0.31 });
    expect(isDirty(saved, moved)).toBe(true);
  });

  it("cambiar el orden es un cambio", () => {
    expect(isDirty(saved, bringForward(saved, "jeans"))).toBe(true);
  });

  it("volver a la posición guardada deja de ser un cambio", () => {
    const moved = updateTransform(saved, "top", { x: 0.9 });
    const back = updateTransform(moved, "top", { x: 0.3 });
    expect(isDirty(saved, back)).toBe(false);
  });
});

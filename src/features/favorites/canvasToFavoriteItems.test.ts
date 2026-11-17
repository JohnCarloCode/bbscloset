import { describe, expect, it } from "vitest";
import type { CanvasItem } from "@/features/dresser/model";
import { canvasToFavoriteItems } from "./canvasToFavoriteItems";

function item(over: Partial<CanvasItem> & { garmentId: string }): CanvasItem {
  return {
    slotId: "base_layer",
    x: 0.5,
    y: 0.4,
    scale: 0.6,
    rotation: 0,
    z: 10,
    locked: false,
    manual: false,
    placedAt: 1,
    ...over,
  };
}

describe("canvasToFavoriteItems", () => {
  it("lienzo vacío → sin items", () => {
    expect(canvasToFavoriteItems({ items: [] })).toEqual([]);
  });

  it("item automático: posiciones a null y su z", () => {
    expect(canvasToFavoriteItems({ items: [item({ garmentId: "a", z: 20 })] })).toEqual([
      { garment_id: "a", x: null, y: null, scale: null, rotation: null, z: 20 },
    ]);
  });

  it("item manual: x, y, scale, rotation y z; sin candado", () => {
    const out = canvasToFavoriteItems({
      items: [
        item({
          garmentId: "a",
          manual: true,
          x: 0.3,
          y: 0.7,
          scale: 0.45,
          rotation: 15,
          z: 3,
          locked: true,
        }),
        item({ garmentId: "b", slotId: "bottom", z: 4 }),
      ],
    });
    expect(out).toEqual([
      { garment_id: "a", x: 0.3, y: 0.7, scale: 0.45, rotation: 15, z: 3 },
      { garment_id: "b", x: null, y: null, scale: null, rotation: null, z: 4 },
    ]);
    expect(out[0]).not.toHaveProperty("locked");
  });

  it("ajusta valores fuera de los rangos de la API", () => {
    const [out] = canvasToFavoriteItems({
      items: [item({ garmentId: "a", manual: true, x: -3, y: 5, scale: 9, rotation: 270, z: 2.6 })],
    });
    expect(out).toEqual({ garment_id: "a", x: -1, y: 2, scale: 2.5, rotation: -90, z: 3 });
  });
});

import { describe, expect, it } from "vitest";
import { autoLayout } from "@/lib/layout/autoLayout";
import {
  composeMiniCollage,
  MINI_COLLAGE_RATIO,
  MINI_COLLAGE_SIZE,
  pieceBox,
  type MiniCollageInput,
} from "./miniCollageLayout";

const AUTO = { x: null, y: null, scale: null, rotation: null } as const;

function item(over: Partial<MiniCollageInput> & Pick<MiniCollageInput, "garment_id" | "slot">) {
  return { ...AUTO, z: null, ...over } as MiniCollageInput;
}

describe("composeMiniCollage", () => {
  it("coloca con autoLayout solo los items sin posición", () => {
    const items = [
      item({ garment_id: "top", slot: "base_layer" }),
      item({ garment_id: "pants", slot: "bottom" }),
      item({ garment_id: "bag", slot: "bag", x: 0.1, y: 0.9, scale: 0.3, rotation: 15, z: 5 }),
    ];
    const pieces = composeMiniCollage(items, { top: 0.8, pants: 0.5 });
    const expected = autoLayout(
      [
        { garmentId: "top", slotId: "base_layer", aspect: 0.8, placedAt: 0 },
        { garmentId: "pants", slotId: "bottom", aspect: 0.5, placedAt: 1 },
      ],
      MINI_COLLAGE_SIZE,
    );
    const byId = Object.fromEntries(pieces.map((p) => [p.garmentId, p]));
    for (const r of expected) {
      expect(byId[r.garmentId]).toMatchObject({ x: r.x, y: r.y, scale: r.scale, manual: false });
    }
    // La guardada se queda tal cual (con su rotación).
    expect(byId.bag).toMatchObject({ x: 0.1, y: 0.9, scale: 0.3, rotation: 15, manual: true });
  });

  it("el aspecto real cambia la colocación automática y sin aspecto vale 1", () => {
    const items = [
      item({ garment_id: "top", slot: "base_layer" }),
      item({ garment_id: "pants", slot: "bottom" }),
    ];
    const before = composeMiniCollage(items);
    expect(before.every((p) => p.aspect === 1)).toBe(true);
    const after = composeMiniCollage(items, { pants: 0.4, top: 1.6 });
    const pantsBefore = before.find((p) => p.garmentId === "pants")!;
    const pantsAfter = after.find((p) => p.garmentId === "pants")!;
    expect(pantsAfter.aspect).toBe(0.4);
    expect(pantsBefore.aspect).toBe(1);
    // Cambia la composición (no solo el aspecto de la pieza).
    const pos = (ps: typeof before) => ps.map((p) => [p.x, p.y, p.scale]);
    expect(pos(after)).not.toEqual(pos(before));
  });

  it("ordena por z (la guardada o la del hueco) de atrás hacia delante", () => {
    const pieces = composeMiniCollage([
      item({ garment_id: "acc", slot: "accessories" }), // 90
      item({ garment_id: "shoes", slot: "footwear" }), // 20
      item({ garment_id: "top", slot: "base_layer", z: 100 }), // traída delante a mano
      item({ garment_id: "pants", slot: "bottom" }), // 30
    ]);
    expect(pieces.map((p) => p.garmentId)).toEqual(["shoes", "pants", "acc", "top"]);
    expect(pieces.map((p) => p.z)).toEqual([20, 30, 90, 100]);
  });

  it("a igualdad de z manda el orden de los items", () => {
    const pieces = composeMiniCollage([
      item({ garment_id: "b", slot: "jewelry" }),
      item({ garment_id: "a", slot: "jewelry" }),
    ]);
    expect(pieces.map((p) => p.garmentId)).toEqual(["b", "a"]);
  });

  it("sin items devuelve vacío y rotación null de una manual es 0", () => {
    expect(composeMiniCollage([])).toEqual([]);
    const [p] = composeMiniCollage([
      item({ garment_id: "x", slot: "bag", x: 0.5, y: 0.5, scale: 0.4 }),
    ]);
    expect(p.rotation).toBe(0);
  });

  it("una posición a medias (sin scale) cuenta como automática", () => {
    const [p] = composeMiniCollage([item({ garment_id: "x", slot: "bag", x: 0.2, y: 0.2 })]);
    expect(p.manual).toBe(false);
  });
});

describe("pieceBox", () => {
  it("en vertical el lado corto es el ancho: scale es fracción del ancho", () => {
    expect(pieceBox({ x: 0.5, y: 0.25, scale: 0.6, aspect: 2 })).toEqual({
      left: 50,
      top: 25,
      width: 60,
    });
    // Vertical (aspecto < 1): el lado mayor es el alto; el ancho sale del aspecto.
    expect(pieceBox({ x: 0, y: 1, scale: 0.6, aspect: 0.5 }).width).toBeCloseTo(30);
    expect(MINI_COLLAGE_RATIO).toBeLessThan(1);
  });

  it("en apaisado el lado corto es el alto", () => {
    // ratio 2: lado corto = alto = mitad del ancho.
    expect(pieceBox({ x: 0.5, y: 0.5, scale: 0.6, aspect: 1 }, 2).width).toBeCloseTo(30);
  });
});

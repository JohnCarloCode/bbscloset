// Tests de la geometría de exportación (plan 6.1). El pintado con Konva se
// prueba en el navegador (vestidor y exportar).
import { describe, expect, it } from "vitest";
import type { CanvasItem } from "@/features/dresser/model";
import {
  EXPORT_MARGIN,
  EXPORT_SIZES,
  EmptyCanvasError,
  exportGeometry,
  rotatedBox,
  unionBounds,
  type ExportRatio,
} from "./exportGeometry";

function item(id: string, over: Partial<CanvasItem> = {}): CanvasItem {
  return {
    garmentId: id,
    slotId: "base_layer",
    x: 0.5,
    y: 0.5,
    scale: 0.4,
    rotation: 0,
    z: 0,
    locked: false,
    manual: false,
    placedAt: 0,
    ...over,
  };
}

const SOURCE = { width: 400, height: 600 };
const RATIOS: ExportRatio[] = ["1:1", "4:5", "9:16"];

const outfit: CanvasItem[] = [
  item("top", { x: 0.5, y: 0.3, scale: 0.5, z: 10, placedAt: 1 }),
  item("bottom", { x: 0.45, y: 0.65, scale: 0.6, z: 5, placedAt: 2 }),
  item("bag", { x: 0.8, y: 0.55, scale: 0.25, rotation: 30, z: 20, placedAt: 3 }),
  item("shoes", { x: 0.4, y: 0.9, scale: 0.2, rotation: -12, z: 1, placedAt: 4 }),
];
const aspects: Record<string, number> = { top: 0.9, bottom: 0.5, bag: 1.2, shoes: 1.6 };
const aspectOf = (id: string) => aspects[id];

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("exportGeometry", () => {
  it("una prenda girada 45° tiene una caja más grande", () => {
    const box = { x: 0, y: 0, width: 100, height: 200, offsetX: 50, offsetY: 100, rotation: 0 };
    const straight = rotatedBox(box);
    const turned = rotatedBox({ ...box, rotation: 45 });
    const w = (b: typeof straight) => b.right - b.left;
    const h = (b: typeof straight) => b.bottom - b.top;
    expect(w(straight)).toBeCloseTo(100);
    expect(h(straight)).toBeCloseTo(200);
    // (100 + 200) · cos 45°
    expect(w(turned)).toBeCloseTo(300 * Math.SQRT1_2);
    expect(h(turned)).toBeCloseTo(300 * Math.SQRT1_2);
    expect(w(turned) * h(turned)).toBeGreaterThan(w(straight) * h(straight));

    // Y en la composición: misma prenda girada → se reduce más para caber.
    const a = exportGeometry([item("a")], () => 0.5, SOURCE, "1:1");
    const b = exportGeometry([item("a", { rotation: 45 })], () => 0.5, SOURCE, "1:1");
    expect(b.scale).toBeLessThan(a.scale);
  });

  it("conserva la composición: distancias relativas, rotación, tamaños y orden", () => {
    for (const ratio of RATIOS) {
      const out = exportGeometry(outfit, aspectOf, SOURCE, ratio);
      const k = out.scale;
      const src = new Map(
        outfit.map((i) => [i.garmentId, { x: i.x * SOURCE.width, y: i.y * SOURCE.height }]),
      );
      const dst = new Map(out.nodes.map((n) => [n.garmentId, n.box]));
      const ids = outfit.map((i) => i.garmentId);
      for (const a of ids)
        for (const b of ids) {
          if (a === b) continue;
          expect(dist(dst.get(a)!, dst.get(b)!)).toBeCloseTo(dist(src.get(a)!, src.get(b)!) * k, 6);
          // Mismo sentido: la de la izquierda sigue a la izquierda.
          expect(Math.sign(dst.get(a)!.x - dst.get(b)!.x)).toBe(
            Math.sign(src.get(a)!.x - src.get(b)!.x),
          );
        }
      for (const i of outfit) {
        const box = dst.get(i.garmentId)!;
        expect(box.rotation).toBe(i.rotation);
        expect(Math.max(box.width, box.height)).toBeCloseTo(
          i.scale * Math.min(SOURCE.width, SOURCE.height) * k,
          6,
        );
        expect(box.width / box.height).toBeCloseTo(aspects[i.garmentId], 6);
      }
      // Orden de pintado por z.
      expect(out.nodes.map((n) => n.garmentId)).toEqual(["shoes", "bottom", "top", "bag"]);
    }
  });

  it("todo cabe en el destino con margen y queda centrado", () => {
    for (const ratio of RATIOS) {
      const out = exportGeometry(outfit, aspectOf, SOURCE, ratio);
      const m = EXPORT_MARGIN * Math.min(out.width, out.height);
      const b = unionBounds(out.nodes.map((n) => rotatedBox(n.box)));
      expect(b.left).toBeGreaterThanOrEqual(m - 1e-6);
      expect(b.top).toBeGreaterThanOrEqual(m - 1e-6);
      expect(b.right).toBeLessThanOrEqual(out.width - m + 1e-6);
      expect(b.bottom).toBeLessThanOrEqual(out.height - m + 1e-6);
      // Toca el margen en al menos un eje (no se queda pequeño sin motivo).
      const touchesX = Math.abs(b.left - m) < 1e-6;
      const touchesY = Math.abs(b.top - m) < 1e-6;
      expect(touchesX || touchesY).toBe(true);
      expect((b.left + b.right) / 2).toBeCloseTo(out.width / 2, 6);
      expect((b.top + b.bottom) / 2).toBeCloseTo(out.height / 2, 6);
    }
  });

  it("las tres proporciones salen con el tamaño exacto", () => {
    expect(EXPORT_SIZES).toEqual({
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
      "9:16": { width: 1080, height: 1920 },
    });
    for (const ratio of RATIOS) {
      const out = exportGeometry(outfit, aspectOf, SOURCE, ratio);
      expect({ width: out.width, height: out.height }).toEqual(EXPORT_SIZES[ratio]);
    }
  });

  it("no depende del tamaño del lienzo de origen si la composición es la misma", () => {
    const a = exportGeometry(outfit, aspectOf, SOURCE, "4:5");
    const b = exportGeometry(outfit, aspectOf, { width: 800, height: 1200 }, "4:5");
    a.nodes.forEach((n, idx) => {
      expect(n.box.x).toBeCloseTo(b.nodes[idx].box.x, 6);
      expect(n.box.y).toBeCloseTo(b.nodes[idx].box.y, 6);
      expect(n.box.width).toBeCloseTo(b.nodes[idx].box.width, 6);
    });
  });

  it("un lienzo vacío da error", () => {
    expect(() => exportGeometry([], aspectOf, SOURCE, "1:1")).toThrow(EmptyCanvasError);
    expect(() => exportGeometry(outfit, aspectOf, { width: 0, height: 0 }, "1:1")).toThrow(
      EmptyCanvasError,
    );
  });
});

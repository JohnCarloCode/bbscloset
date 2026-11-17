import { describe, expect, it } from "vitest";
import { SLOTS, type SlotId } from "@/lib/domain/slots";
import { autoLayout, type CanvasSize, type LayoutInput, type LayoutResult } from "./autoLayout";

// Aspectos realistas (ancho/alto del recorte).
const ASPECT: Record<SlotId, number> = {
  base_layer: 1.1,
  mid_layer: 0.95,
  outer_layer: 0.75,
  bottom: 0.45,
  full_body: 0.5,
  footwear: 1.6,
  bag: 1,
  jewelry: 1,
  accessories: 1.3,
};

let seq = 0;
function it_(slotId: SlotId, id: string = slotId, aspect = ASPECT[slotId]): LayoutInput {
  return { garmentId: id, slotId, aspect, placedAt: ++seq };
}

const MOBILE: CanvasSize = { width: 402, height: 560 };
const DESKTOP: CanvasSize = { width: 900, height: 640 };
const SPLIT: CanvasSize = { width: 402, height: 260 };
const WIDE: CanvasSize = { width: 1280, height: 300 };
const CANVASES = [MOBILE, DESKTOP, SPLIT, WIDE, { width: 500, height: 500 }];

/** Caja en píxeles de un resultado, con el aspecto de su item. */
function rect(r: LayoutResult, input: LayoutInput, c: CanvasSize) {
  const long = r.scale * Math.min(c.width, c.height);
  const a = input.aspect > 0 ? input.aspect : 1;
  const w = a >= 1 ? long : long * a;
  const h = a >= 1 ? long / a : long;
  const cx = r.x * c.width;
  const cy = r.y * c.height;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, cx, cy, w, h };
}

const COMBOS: SlotId[][] = [
  ["base_layer", "bottom", "footwear"],
  ["outer_layer", "base_layer", "bottom", "footwear"],
  ["base_layer", "bottom", "footwear", "bag"],
  ["full_body", "footwear", "bag"],
  ["outer_layer", "mid_layer", "base_layer", "bottom", "footwear", "bag", "accessories"],
  ["outer_layer", "mid_layer", "full_body", "footwear", "bag", "accessories"],
  ["accessories"],
  ["footwear"],
  ["bag"],
  ["bottom"],
  ["bag", "accessories"],
  ["mid_layer", "bottom"],
];

function build(slots: SlotId[], jewels = 0): LayoutInput[] {
  const out = slots.map((s) => it_(s));
  for (let k = 0; k < jewels; k++) out.push(it_("jewelry", `j${k}`));
  return out;
}

describe("autoLayout", () => {
  it("sin items devuelve vacío", () => {
    expect(autoLayout([], MOBILE)).toEqual([]);
  });

  it("ningún item se sale del lienzo (aspecto y escala incluidos)", () => {
    const cases = [...COMBOS.map((c) => build(c)), build([], 3), build([], 10)];
    cases.push(
      build(
        ["outer_layer", "mid_layer", "base_layer", "bottom", "footwear", "bag", "accessories"],
        10,
      ),
    );
    for (const c of CANVASES) {
      for (const items of cases) {
        const res = autoLayout(items, c);
        expect(res).toHaveLength(items.length);
        res.forEach((r, k) => {
          const b = rect(r, items[k], c);
          expect(b.x0).toBeGreaterThanOrEqual(-1e-6);
          expect(b.y0).toBeGreaterThanOrEqual(-1e-6);
          expect(b.x1).toBeLessThanOrEqual(c.width + 1e-6);
          expect(b.y1).toBeLessThanOrEqual(c.height + 1e-6);
          expect(r.scale).toBeGreaterThan(0);
        });
      }
    }
  });

  it("aspectos raros o desconocidos no rompen nada", () => {
    const items = [it_("bottom", "p", 0), it_("footwear", "s", NaN), it_("bag", "b", 50)];
    for (const r of autoLayout(items, MOBILE)) {
      expect(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.scale)).toBe(true);
    }
  });

  it("con y sin bolso el resto se recoloca", () => {
    const base = build(["base_layer", "bottom", "footwear"]);
    const without = autoLayout(base, MOBILE);
    const withBag = autoLayout([...base, it_("bag")], MOBILE);
    // Con bolso el cuerpo se aparta un poco a la izquierda para dejarle sitio
    // (y, si hace falta, encoge); sin él, vuelve al centro.
    expect(withBag.slice(0, 3)).not.toEqual(without);
    expect(withBag[1].x).toBeLessThan(without[1].x);
    expect(withBag[1].scale).toBeLessThanOrEqual(without[1].scale);
    expect(without[1].x).toBeCloseTo(0.5, 6);
    // El bolso queda a la derecha del cuerpo.
    expect(withBag[3].x).toBeGreaterThan(withBag[1].x);
  });

  it("3 joyas caben y no se solapan entre sí", () => {
    for (const c of CANVASES) {
      const items = build(["base_layer", "bottom", "footwear", "bag"], 3);
      const res = autoLayout(items, c);
      const jewels = res
        .map((r, k) => ({ r, b: rect(r, items[k], c) }))
        .filter(({ r }) => r.garmentId.startsWith("j"));
      expect(jewels).toHaveLength(3);
      for (let a = 0; a < 3; a++)
        for (let b = a + 1; b < 3; b++) {
          const A = jewels[a].b;
          const B = jewels[b].b;
          const overlap = A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1;
          expect(overlap).toBe(false);
        }
    }
  });

  it("los huecos vacíos no dejan hueco: lo que hay ocupa el alto", () => {
    for (const c of [MOBILE, DESKTOP]) {
      for (const slots of [
        ["base_layer", "bottom", "footwear"],
        ["base_layer", "footwear"],
        ["full_body", "footwear"],
      ] as SlotId[][]) {
        const items = build(slots);
        const res = autoLayout(items, c);
        const boxes = res.map((r, k) => rect(r, items[k], c));
        const top = Math.min(...boxes.map((b) => b.y0));
        const bottom = Math.max(...boxes.map((b) => b.y1));
        // La composición queda centrada en vertical: no hay hueco arriba ni abajo
        // reservado para lo que falta.
        expect(Math.abs(top - (c.height - bottom))).toBeLessThan(1);
        // Y, sin parte inferior, el calzado queda justo debajo de la parte de arriba.
        if (!slots.includes("bottom")) {
          const upper = boxes[0];
          const shoes = boxes[1];
          expect(shoes.y0 - upper.y1).toBeLessThan(0.1 * c.height);
        }
      }
    }
  });

  it("sin parte inferior el cuerpo se agranda (redistribuye el alto)", () => {
    const full = autoLayout(build(["base_layer", "bottom", "footwear"]), MOBILE);
    const noBottom = autoLayout(build(["base_layer", "footwear"]), MOBILE);
    expect(noBottom[0].scale).toBeGreaterThan(full[0].scale);
  });

  it("orden vertical del cuerpo: arriba, inferior, calzado; centrado", () => {
    for (const c of [MOBILE, DESKTOP]) {
      const items = build(["base_layer", "bottom", "footwear", "bag", "accessories"]);
      const [top, bottom, shoes] = autoLayout(items, c);
      expect(top.y).toBeLessThan(bottom.y);
      expect(bottom.y).toBeLessThan(shoes.y);
      // Casi centrado aunque solo haya bolso a un lado y accesorio al otro.
      expect(Math.abs(bottom.x - 0.5)).toBeLessThan(0.1);
    }
  });

  it("las capas superiores se solapan y la exterior va delante", () => {
    const items = build(["outer_layer", "mid_layer", "base_layer", "bottom"]);
    const res = autoLayout(items, MOBILE);
    const [o, m] = res.map((r, k) => rect(r, items[k], MOBILE));
    expect(o.x1).toBeGreaterThan(m.x0); // se tocan/solapan
    expect(res[0].z).toBeGreaterThan(res[1].z);
    expect(res[1].z).toBeGreaterThan(res[2].z);
  });

  it("z según defaultZ del hueco (también con datos de huecos propios)", () => {
    const items = build(
      ["outer_layer", "base_layer", "bottom", "footwear", "bag", "accessories"],
      2,
    );
    for (const r of autoLayout(items, DESKTOP)) {
      const slot = items.find((i) => i.garmentId === r.garmentId)!.slotId;
      expect(r.z).toBe(SLOTS[slot].defaultZ);
    }
    const custom = { ...SLOTS, bag: { ...SLOTS.bag, defaultZ: 5 } };
    const bag = autoLayout(items, DESKTOP, custom).find((r) => r.garmentId === "bag")!;
    expect(bag.z).toBe(5);
  });

  it("la prenda de más peso sale más grande", () => {
    const items = build(["base_layer", "bottom", "footwear"]);
    const [, bottom, shoes] = autoLayout(items, MOBILE);
    expect(bottom.scale).toBeGreaterThan(shoes.scale);
  });

  it("es determinista y no depende del orden de entrada", () => {
    const items = build(["outer_layer", "base_layer", "bottom", "footwear", "bag"], 3);
    const a = autoLayout(items, MOBILE);
    const b = autoLayout(items, MOBILE);
    expect(a).toEqual(b);
    const reversed = autoLayout([...items].reverse(), MOBILE);
    const byId = (rs: LayoutResult[]) => Object.fromEntries(rs.map((r) => [r.garmentId, r]));
    expect(byId(reversed)).toEqual(byId(a));
  });
});

import { describe, expect, it } from "vitest";
import type { GarmentTypeId } from "@/lib/domain/types";
import { EMPTY_CANVAS, place, toggleLock, updateTransform, type CanvasState } from "./model";
import {
  canSubstitute,
  randomOutfit,
  substitute,
  substituteSlots,
  type GarmentPool,
} from "./random";

const g = (typeId: GarmentTypeId, id: string) => ({ id, typeId });

function build(garments: ReturnType<typeof g>[]): CanvasState {
  return garments.reduce((s, garment, i) => place(s, garment, 3, i + 1).state, EMPTY_CANVAS);
}

/** rng determinista (LCG) para repetir muchas pulsaciones. */
function seeded(seed = 1) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const idOf = (s: CanvasState, slot: string) => s.items.find((i) => i.slotId === slot)?.garmentId;

describe("substitute (Sustituir)", () => {
  it("con 2 camisetas, 10 pulsaciones alternan siempre", () => {
    const pool: GarmentPool = { base_layer: ["t1", "t2"] };
    let s = build([g("tshirt", "t1")]);
    const seen: string[] = [];
    for (let k = 0; k < 10; k++) {
      const r = substitute(s, pool, seeded(k + 7));
      expect(r.changed).toBe(1);
      expect(idOf(r.state, "base_layer")).not.toBe(idOf(s, "base_layer"));
      s = r.state;
      seen.push(idOf(s, "base_layer")!);
    }
    expect(seen).toEqual(["t2", "t1", "t2", "t1", "t2", "t1", "t2", "t1", "t2", "t1"]);
  });

  it("nunca repite la prenda actual con un rng cualquiera", () => {
    const pool: GarmentPool = { base_layer: ["a", "b", "c"], bottom: ["p", "q"] };
    let s = build([g("tshirt", "a"), g("trousers", "p")]);
    const rng = seeded(42);
    for (let k = 0; k < 50; k++) {
      const r = substitute(s, pool, rng);
      expect(idOf(r.state, "base_layer")).not.toBe(idOf(s, "base_layer"));
      expect(idOf(r.state, "bottom")).not.toBe(idOf(s, "bottom"));
      s = r.state;
    }
  });

  it("con una sola prenda en el hueco, se queda", () => {
    const s = build([g("tshirt", "t1")]);
    const r = substitute(s, { base_layer: ["t1"] }, Math.random);
    expect(r.changed).toBe(0);
    expect(r.state).toBe(s);
  });

  it("respeta el candado: con el pantalón bloqueado solo cambia el resto", () => {
    const pool: GarmentPool = {
      base_layer: ["t1", "t2"],
      bottom: ["p1", "p2"],
      footwear: ["f1", "f2"],
    };
    let s = build([g("tshirt", "t1"), g("trousers", "p1"), g("sneakers", "f1")]);
    s = toggleLock(s, "p1");
    expect(substituteSlots(s)).toEqual(["base_layer", "footwear"]);
    const rng = seeded(3);
    for (let k = 0; k < 5; k++) {
      const r = substitute(s, pool, rng);
      expect(r.changed).toBe(2);
      expect(idOf(r.state, "bottom")).toBe("p1");
      expect(r.state.items.find((i) => i.garmentId === "p1")?.locked).toBe(true);
      s = r.state;
    }
  });

  it("todo bloqueado o lienzo vacío: no hay nada que sustituir", () => {
    expect(canSubstitute(EMPTY_CANVAS)).toBe(false);
    const s = toggleLock(build([g("tshirt", "t1")]), "t1");
    expect(canSubstitute(s)).toBe(false);
    expect(substitute(s, { base_layer: ["t1", "t2"] }, Math.random).changed).toBe(0);
  });

  it("joyería: cada joya cambia por otra que no esté ya puesta", () => {
    const pool: GarmentPool = { jewelry: ["j1", "j2", "j3", "j4"] };
    let s = build([g("necklace", "j1"), g("ring", "j2")]);
    const rng = seeded(9);
    for (let k = 0; k < 20; k++) {
      const before = s.items.map((i) => i.garmentId);
      const r = substitute(s, pool, rng);
      const after = r.state.items.map((i) => i.garmentId);
      expect(new Set(after).size).toBe(2);
      after.forEach((id, i) => expect(id).not.toBe(before[i]));
      s = r.state;
    }
  });

  it("joyería sin otra libre: la que no puede cambiar se queda", () => {
    const s = build([g("necklace", "j1"), g("ring", "j2")]);
    const r = substitute(s, { jewelry: ["j1", "j2", "j3"] }, () => 0);
    // La primera coge j3; la segunda ya no tiene ninguna libre.
    expect(r.state.items.map((i) => i.garmentId)).toEqual(["j3", "j2"]);
    expect(r.changed).toBe(1);
  });

  it("hereda x, y, scale, rotation, z y placedAt del item sustituido", () => {
    let s = build([g("tshirt", "t1")]);
    s = updateTransform(s, "t1", { x: 0.2, y: 0.3, scale: 0.7, rotation: 15 });
    const prev = s.items[0];
    const r = substitute(s, { base_layer: ["t1", "t2"] }, () => 0);
    expect(r.state.items[0]).toEqual({ ...prev, garmentId: "t2" });
  });

  it("no cruza huecos: un vestido cambia por otra prenda de cuerpo entero", () => {
    const s = build([g("dress", "d1")]);
    const r = substitute(s, { full_body: ["d1", "m1"], base_layer: ["t1"] }, () => 0);
    expect(r.state.items.map((i) => [i.slotId, i.garmentId])).toEqual([["full_body", "m1"]]);
  });
});

describe("randomOutfit (Outfit aleatorio)", () => {
  const pool: GarmentPool = {
    base_layer: ["t1", "t2"],
    bottom: ["p1"],
    footwear: ["f1"],
    full_body: ["d1"],
    jewelry: ["j1", "j2", "j3"],
  };

  it("una prenda de cada categoría predeterminada, sin candados ni ajustes", () => {
    const r = randomOutfit(pool, ["base_layer", "bottom", "footwear"], 3, () => 0, 100);
    expect(r.state.items.map((i) => i.garmentId)).toEqual(["t1", "p1", "f1"]);
    expect(r.state.items.every((i) => !i.locked && !i.manual)).toBe(true);
    expect(r.state.items.map((i) => i.placedAt)).toEqual([100, 101, 102]);
    expect(r.empty).toEqual([]);
  });

  it("devuelve las categorías sin prendas y monta el outfit con las demás", () => {
    const r = randomOutfit(pool, ["base_layer", "bottom", "footwear", "bag"], 3, () => 0);
    expect(r.empty).toEqual(["bag"]);
    expect(r.state.items.map((i) => i.slotId)).toEqual(["base_layer", "bottom", "footwear"]);
  });

  it("joyería: una sola pieza", () => {
    const r = randomOutfit(pool, ["jewelry"], 3, () => 0.99);
    expect(r.state.items.map((i) => i.garmentId)).toEqual(["j3"]);
  });

  it("vestido al 50 %: sale vestido (sin base ni inferior) o base + inferior", () => {
    const slots = ["base_layer", "bottom", "full_body", "footwear"] as const;
    const dress = randomOutfit(pool, slots, 3, () => 0.1);
    expect(dress.state.items.map((i) => i.slotId)).toEqual(["full_body", "footwear"]);
    const pair = randomOutfit(pool, slots, 3, () => 0.6);
    expect(pair.state.items.map((i) => i.slotId)).toEqual(["base_layer", "bottom", "footwear"]);
  });

  it("vestido al 50 % de verdad con muchos intentos", () => {
    const rng = seeded(5);
    let dresses = 0;
    for (let k = 0; k < 1000; k++) {
      const r = randomOutfit(pool, ["base_layer", "bottom", "full_body"], 3, rng);
      if (r.state.items.some((i) => i.slotId === "full_body")) dresses++;
    }
    expect(dresses).toBeGreaterThan(400);
    expect(dresses).toBeLessThan(600);
  });

  it("sin vestidos sale base + inferior y avisa de cuerpo entero", () => {
    const r = randomOutfit({ ...pool, full_body: [] }, ["base_layer", "full_body"], 3, () => 0);
    expect(r.state.items.map((i) => i.slotId)).toEqual(["base_layer"]);
    expect(r.empty).toEqual(["full_body"]);
  });

  it("solo cuerpo entero (sin base ni inferior): siempre vestido", () => {
    const r = randomOutfit(pool, ["full_body", "footwear"], 3, () => 0.99);
    expect(r.state.items.map((i) => i.slotId)).toEqual(["full_body", "footwear"]);
  });

  it("sin categorías o sin prendas: lienzo vacío", () => {
    expect(randomOutfit(pool, [], 3, Math.random).state.items).toEqual([]);
    const r = randomOutfit({}, ["bag"], 3, Math.random);
    expect(r.state.items).toEqual([]);
    expect(r.empty).toEqual(["bag"]);
  });
});

import { describe, expect, it } from "vitest";
import { SLOTS } from "@/lib/domain/slots";
import type { GarmentTypeId } from "@/lib/domain/types";
import {
  bringForward,
  type CanvasState,
  DEFAULT_TRANSFORM,
  EMPTY_CANVAS,
  hasManual,
  paintOrder,
  place,
  remove,
  resetManual,
  sendBackward,
  toggle,
  toggleLock,
  updateTransform,
} from "./model";

// Prenda de prueba: el id es el propio tipo salvo que se indique otro.
const g = (typeId: GarmentTypeId, id: string = typeId) => ({ id, typeId });

/** Pone varias prendas seguidas con placedAt deterministas (1, 2, 3…). */
function build(garments: ReturnType<typeof g>[], jewelryMax = 3): CanvasState {
  return garments.reduce(
    (s, garment, i) => place(s, garment, jewelryMax, i + 1).state,
    EMPTY_CANVAS,
  );
}

const ids = (s: CanvasState) => s.items.map((i) => i.garmentId).sort();

describe("place: regla de huecos (spec 2.1)", () => {
  it("pantalón + short → solo el short (mismo hueco sustituye)", () => {
    const s = build([g("trousers")]);
    const r = place(s, g("shorts"), 3, 10);
    expect(ids(r.state)).toEqual(["shorts"]);
    expect(r.events.replaced.map((i) => i.garmentId)).toEqual(["trousers"]);
    expect(r.events.removedByFullBody).toEqual([]);
  });

  it("camiseta + jersey → los dos (huecos distintos)", () => {
    const s = build([g("tshirt"), g("sweater")]);
    expect(ids(s)).toEqual(["sweater", "tshirt"]);
  });

  it("el vestido quita la camiseta y el pantalón, pero no la chaqueta ni las botas", () => {
    const s = build([g("tshirt"), g("jeans"), g("jacket"), g("boots")]);
    const r = place(s, g("dress"), 3, 10);
    expect(ids(r.state)).toEqual(["boots", "dress", "jacket"]);
    expect(r.events.removedByFullBody.map((i) => i.garmentId).sort()).toEqual(["jeans", "tshirt"]);
    expect(r.events.replaced).toEqual([]);
  });

  it("la camiseta quita el vestido", () => {
    const s = build([g("dress"), g("sneakers")]);
    const r = place(s, g("tshirt"), 3, 10);
    expect(ids(r.state)).toEqual(["sneakers", "tshirt"]);
    expect(r.events.removedByFullBody.map((i) => i.garmentId)).toEqual(["dress"]);
  });

  it("una parte inferior quita el mono", () => {
    const r = place(build([g("jumpsuit")]), g("skirt"), 3, 10);
    expect(ids(r.state)).toEqual(["skirt"]);
    expect(r.events.removedByFullBody.map((i) => i.garmentId)).toEqual(["jumpsuit"]);
  });

  it("vestido sobre mono: sustituye (mismo hueco), no es exclusión", () => {
    const r = place(build([g("jumpsuit")]), g("dress"), 3, 10);
    expect(ids(r.state)).toEqual(["dress"]);
    expect(r.events.replaced.map((i) => i.garmentId)).toEqual(["jumpsuit"]);
    expect(r.events.removedByFullBody).toEqual([]);
  });

  it("4.ª joya con máximo 3 quita la primera", () => {
    const s = build([g("necklace", "j1"), g("ring", "j2"), g("earrings", "j3")]);
    expect(ids(s)).toEqual(["j1", "j2", "j3"]);
    const r = place(s, g("bracelet", "j4"), 3, 10);
    expect(ids(r.state)).toEqual(["j2", "j3", "j4"]);
    expect(r.events.jewelryDropped?.garmentId).toBe("j1");
    expect(r.events.replaced).toEqual([]);
  });

  it("joyería por debajo del máximo no quita nada; el máximo es configurable", () => {
    const s = build([g("necklace", "j1"), g("ring", "j2"), g("earrings", "j3")], 5);
    const r = place(s, g("bracelet", "j4"), 5, 10);
    expect(ids(r.state)).toEqual(["j1", "j2", "j3", "j4"]);
    expect(r.events.jewelryDropped).toBeNull();
  });

  it("si el máximo bajó, sobran varias joyas: cae la más antigua y las demás van en replaced", () => {
    const s = build([g("necklace", "j1"), g("ring", "j2"), g("earrings", "j3")], 3);
    const r = place(s, g("bracelet", "j4"), 1, 10);
    expect(ids(r.state)).toEqual(["j4"]);
    expect(r.events.jewelryDropped?.garmentId).toBe("j1");
    expect(r.events.replaced.map((i) => i.garmentId)).toEqual(["j2", "j3"]);
  });

  it("el candado no afecta a place: una prenda bloqueada se sustituye igual (spec 3.2)", () => {
    const s = toggleLock(build([g("trousers"), g("tshirt")]), "trousers");
    expect(s.items.find((i) => i.garmentId === "trousers")?.locked).toBe(true);
    const r = place(s, g("shorts"), 3, 10);
    expect(ids(r.state)).toEqual(["shorts", "tshirt"]);
    // Tampoco protege de la exclusión de cuerpo entero.
    const r2 = place(s, g("dress"), 3, 10);
    expect(ids(r2.state)).toEqual(["dress"]);
    // La nueva entra sin candado.
    expect(r.state.items.find((i) => i.garmentId === "shorts")?.locked).toBe(false);
  });

  it("poner una prenda que ya está no cambia nada", () => {
    const s = build([g("tshirt")]);
    const r = place(s, g("tshirt"), 3, 10);
    expect(r.state).toBe(s);
  });

  it("item nuevo: hueco, z por defecto, automático y placedAt creciente", () => {
    const s = build([g("jacket")]);
    const [item] = s.items;
    expect(item).toMatchObject({
      slotId: "outer_layer",
      z: SLOTS.outer_layer.defaultZ,
      manual: false,
      locked: false,
      ...DEFAULT_TRANSFORM,
    });
    // placedAt nunca retrocede aunque el reloj vaya atrás.
    const s2 = place(s, g("boots"), 3, 0).state;
    expect(s2.items[1].placedAt).toBeGreaterThan(s2.items[0].placedAt);
  });
});

describe("toggle (screens 7.3: tocarla otra vez la quita)", () => {
  it("pone y luego quita", () => {
    const r1 = toggle(EMPTY_CANVAS, g("tshirt"), 3, 1);
    expect(ids(r1.state)).toEqual(["tshirt"]);
    expect(r1.removed).toBeNull();
    const r2 = toggle(r1.state, g("tshirt"), 3, 2);
    expect(r2.state.items).toEqual([]);
    expect(r2.removed?.garmentId).toBe("tshirt");
  });

  it("si no está, aplica la regla de huecos", () => {
    const r = toggle(build([g("jeans")]), g("dress"), 3, 10);
    expect(ids(r.state)).toEqual(["dress"]);
    expect(r.events.removedByFullBody.map((i) => i.garmentId)).toEqual(["jeans"]);
  });
});

describe("remove y toggleLock", () => {
  it("remove quita la prenda; si no está devuelve el mismo estado", () => {
    const s = build([g("tshirt"), g("jeans")]);
    expect(ids(remove(s, "jeans"))).toEqual(["tshirt"]);
    expect(remove(s, "nope")).toBe(s);
  });

  it("toggleLock alterna el candado", () => {
    const s = build([g("tshirt")]);
    expect(toggleLock(s, "tshirt").items[0].locked).toBe(true);
    expect(toggleLock(toggleLock(s, "tshirt"), "tshirt").items[0].locked).toBe(false);
  });
});

describe("orden de superposición", () => {
  // base 40 < media 50 < exterior 60
  const s = build([g("tshirt"), g("sweater"), g("jacket")]);
  const order = (st: CanvasState) => paintOrder(st).map((i) => i.garmentId);

  it("por defecto sigue default_z (exterior sobre media sobre base)", () => {
    expect(order(s)).toEqual(["tshirt", "sweater", "jacket"]);
  });

  it("bringForward sube un puesto y deja z estrictamente creciente", () => {
    const s2 = bringForward(s, "tshirt");
    expect(order(s2)).toEqual(["sweater", "tshirt", "jacket"]);
    const zs = paintOrder(s2).map((i) => i.z);
    expect(zs).toEqual([50, 51, 60]);
    // No marca manual.
    expect(hasManual(s2)).toBe(false);
  });

  it("bringForward dos veces lleva al frente; en el frente no hace nada", () => {
    const s3 = bringForward(bringForward(s, "tshirt"), "tshirt");
    expect(order(s3)).toEqual(["sweater", "jacket", "tshirt"]);
    expect(bringForward(s3, "tshirt")).toBe(s3);
  });

  it("sendBackward baja un puesto; al fondo no hace nada", () => {
    expect(order(sendBackward(s, "jacket"))).toEqual(["tshirt", "jacket", "sweater"]);
    expect(sendBackward(s, "tshirt")).toBe(s);
  });

  it("con z empatadas (joyas) desempata por placedAt y reordena bien", () => {
    const j = build([g("necklace", "j1"), g("ring", "j2")]);
    expect(order(j)).toEqual(["j1", "j2"]);
    expect(order(bringForward(j, "j1"))).toEqual(["j2", "j1"]);
  });
});

describe("transformación manual", () => {
  it("updateTransform cambia la posición y marca manual", () => {
    const s = updateTransform(build([g("jeans")]), "jeans", { x: 0.2, rotation: 15 });
    expect(s.items[0]).toMatchObject({
      x: 0.2,
      y: DEFAULT_TRANSFORM.y,
      rotation: 15,
      manual: true,
    });
    expect(hasManual(s)).toBe(true);
  });

  it("resetManual pone todo en automático, sin giro y con la z por defecto; mantiene candados", () => {
    let s = build([g("tshirt"), g("jacket")]);
    s = updateTransform(s, "tshirt", { x: 0.1, y: 0.9, scale: 0.7, rotation: 30 });
    s = bringForward(s, "tshirt");
    s = toggleLock(s, "jacket");
    const r = resetManual(s);
    expect(hasManual(r)).toBe(false);
    const tshirt = r.items.find((i) => i.garmentId === "tshirt")!;
    expect(tshirt.rotation).toBe(0);
    expect(tshirt.z).toBe(SLOTS.base_layer.defaultZ);
    expect(r.items.find((i) => i.garmentId === "jacket")?.locked).toBe(true);
  });

  it("al sustituir una prenda con ajustes manuales, la nueva hereda x, y, scale, rotation", () => {
    const moved = { x: 0.3, y: 0.7, scale: 0.6, rotation: -10 };
    const s = updateTransform(build([g("trousers")]), "trousers", moved);
    const r = place(s, g("shorts"), 3, 10);
    expect(r.state.items[0]).toMatchObject({ garmentId: "shorts", ...moved, manual: true });
  });

  it("si la sustituida no era manual, la nueva entra en automático", () => {
    const r = place(build([g("trousers")]), g("shorts"), 3, 10);
    expect(r.state.items[0]).toMatchObject({ ...DEFAULT_TRANSFORM, manual: false });
  });

  it("la exclusión de cuerpo entero no hereda la posición", () => {
    const s = updateTransform(build([g("tshirt")]), "tshirt", { x: 0.1 });
    const r = place(s, g("dress"), 3, 10);
    expect(r.state.items[0]).toMatchObject({
      garmentId: "dress",
      manual: false,
      x: DEFAULT_TRANSFORM.x,
    });
  });
});

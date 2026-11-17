import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  initHistory,
  mapHistory,
  push,
  redo,
  replacePresent,
  undo,
} from "./history";

describe("historial", () => {
  it("empieza sin pasos", () => {
    const h = initHistory("a");
    expect(h).toEqual({ past: [], present: "a", future: [] });
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("push guarda el presente; undo y redo van y vuelven", () => {
    let h = push(push(initHistory("a"), "b"), "c");
    expect(h).toEqual({ past: ["a", "b"], present: "c", future: [] });
    h = undo(h);
    expect(h).toEqual({ past: ["a"], present: "b", future: ["c"] });
    h = undo(h);
    expect(h).toEqual({ past: [], present: "a", future: ["b", "c"] });
    h = redo(h);
    expect(h).toEqual({ past: ["a"], present: "b", future: ["c"] });
    expect(canUndo(h) && canRedo(h)).toBe(true);
  });

  it("una acción nueva vacía future", () => {
    const h = push(undo(push(push(initHistory("a"), "b"), "c")), "x");
    expect(h).toEqual({ past: ["a", "b"], present: "x", future: [] });
  });

  it("push sin cambio no crea paso", () => {
    const h = push(initHistory("a"), "b");
    expect(push(h, "b")).toBe(h);
  });

  it("respeta el límite de pasos", () => {
    let h = initHistory(0);
    for (let i = 1; i <= 10; i++) h = push(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
    expect(h.present).toBe(10);
  });

  it("replacePresent no crea paso ni toca future", () => {
    const h = undo(push(initHistory("a"), "b"));
    const r = replacePresent(h, "a2");
    expect(r).toEqual({ past: [], present: "a2", future: ["b"] });
    expect(replacePresent(r, "a2")).toBe(r);
  });

  it("mapHistory aplica a todos y funde los pasos que quedan iguales", () => {
    // Quitar la "x" de todos los estados.
    const h = { past: ["a", "ax", "abx"], present: "abxc", future: ["abxcx", "abxcd"] };
    const r = mapHistory(h, (s) => s.replaceAll("x", ""));
    expect(r).toEqual({ past: ["a", "ab"], present: "abc", future: ["abcd"] });
  });
});

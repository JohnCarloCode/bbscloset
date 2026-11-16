import { describe, expect, it } from "vitest";
import { initialToastState, TOAST_DURATION_MS, toastReducer } from "./queue";

describe("toastReducer", () => {
  it("encola en orden con la duración por defecto", () => {
    let s = toastReducer(initialToastState, { type: "push", id: 1, toast: { message: "a" } });
    s = toastReducer(s, { type: "push", id: 2, toast: { message: "b", durationMs: 1000 } });
    expect(s.items.map((t) => [t.id, t.message, t.durationMs])).toEqual([
      [1, "a", TOAST_DURATION_MS],
      [2, "b", 1000],
    ]);
  });

  it("al descartar el visible pasa al siguiente", () => {
    let s = toastReducer(initialToastState, { type: "push", id: 1, toast: { message: "a" } });
    s = toastReducer(s, { type: "push", id: 2, toast: { message: "b" } });
    s = toastReducer(s, { type: "dismiss", id: 1 });
    expect(s.items[0].message).toBe("b");
  });

  it("descartar un id inexistente no cambia el estado", () => {
    const s = toastReducer(initialToastState, { type: "push", id: 1, toast: { message: "a" } });
    expect(toastReducer(s, { type: "dismiss", id: 99 })).toBe(s);
  });

  it("clear vacía la cola", () => {
    let s = toastReducer(initialToastState, { type: "push", id: 1, toast: { message: "a" } });
    s = toastReducer(s, { type: "push", id: 2, toast: { message: "b" } });
    expect(toastReducer(s, { type: "clear" }).items).toEqual([]);
  });
});

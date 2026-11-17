import { afterEach, describe, expect, it, vi } from "vitest";
import { changeOf, emitGarmentChanged, onGarmentChanged } from "./garmentChanged";

describe("garmentChanged (5.5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("emite y escucha en window; sin ids no emite", () => {
    vi.stubGlobal("window", new EventTarget());
    const seen: unknown[] = [];
    const off = onGarmentChanged((d) => seen.push(d));
    emitGarmentChanged(["a"], "deleted");
    emitGarmentChanged([], "archived");
    off();
    emitGarmentChanged(["b"], "updated");
    expect(seen).toEqual([{ ids: ["a"], change: "deleted" }]);
  });

  it("fuera del navegador no hace nada", () => {
    expect(() => emitGarmentChanged(["a"], "deleted")).not.toThrow();
    expect(onGarmentChanged(() => {})).toBeTypeOf("function");
  });

  it("changeOf distingue archivar, desarchivar y editar", () => {
    expect(changeOf({ archived: true }, false)).toBe("archived");
    expect(changeOf({ archived: true })).toBe("archived");
    expect(changeOf({ archived: false }, true)).toBe("unarchived");
    expect(changeOf({ archived: false }, false)).toBe("updated");
    expect(changeOf({ archived: false })).toBe("updated");
  });
});

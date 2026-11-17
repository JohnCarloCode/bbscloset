import { describe, expect, it } from "vitest";
import { fitWithin } from "./shrink";

describe("fitWithin", () => {
  it("reduce el lado mayor a maxSide sin deformar", () => {
    expect(fitWithin(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3024, 4032, 1200)).toEqual({ width: 900, height: 1200 });
    expect(fitWithin(1024, 1024, 320)).toEqual({ width: 320, height: 320 });
  });

  it("no amplía las imágenes pequeñas", () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
  });

  it("nunca baja de 1 px", () => {
    expect(fitWithin(5000, 2, 320)).toEqual({ width: 320, height: 1 });
  });
});

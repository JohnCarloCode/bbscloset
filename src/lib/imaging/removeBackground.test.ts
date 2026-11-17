import { describe, expect, it } from "vitest";
import { downloadFraction, estimateCutFraction } from "./removeBackground";

describe("estimateCutFraction", () => {
  it("avanza con el tiempo y no pasa de 0,9", () => {
    expect(estimateCutFraction(0, 30_000)).toBeCloseTo(0.05);
    expect(estimateCutFraction(15_000, 30_000)).toBeCloseTo(0.475);
    expect(estimateCutFraction(60_000, 30_000)).toBe(0.9);
  });

  it("aguanta duraciones raras", () => {
    expect(estimateCutFraction(-5, 30_000)).toBeCloseTo(0.05);
    expect(estimateCutFraction(1000, 0)).toBeCloseTo(0.05);
  });
});

describe("downloadFraction", () => {
  it("null sin totales; suma de varios archivos", () => {
    expect(downloadFraction(new Map())).toBeNull();
    const files = new Map([
      ["fetch:/models/isnet_quint8", { loaded: 20, total: 40 }],
      ["fetch:/onnxruntime-web/ort-wasm-simd-threaded.wasm", { loaded: 10, total: 10 }],
    ]);
    expect(downloadFraction(files)).toBe(0.6);
  });
});

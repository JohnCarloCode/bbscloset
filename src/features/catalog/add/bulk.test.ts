import { describe, expect, it } from "vitest";
import {
  BULK_MAX,
  asIsWithBackground,
  capBatch,
  commonMode,
  detectedMode,
  fittingIds,
  overLimit,
  type BulkEntry,
} from "./bulk";

const entry = (id: string, over: Partial<BulkEntry> = {}): BulkEntry => ({
  id,
  file: new File(["x"], `${id}.png`),
  check: "ok",
  hasAlpha: false,
  mode: "cut",
  ...over,
});

describe("subida masiva: tope de 30", () => {
  it("coge las 30 primeras y cuenta las que sobran", () => {
    const files = Array.from({ length: 34 }, (_, i) => i);
    const { files: kept, dropped } = capBatch(files);
    expect(BULK_MAX).toBe(30);
    expect(kept).toEqual(files.slice(0, 30));
    expect(dropped).toBe(4);
  });

  it("con 30 o menos no sobra ninguna", () => {
    expect(capBatch([1, 2, 3])).toEqual({ files: [1, 2, 3], dropped: 0 });
    expect(capBatch(Array(30).fill(0)).dropped).toBe(0);
  });
});

describe("subida masiva: reparto según el límite de 500", () => {
  const entries = [
    entry("a"),
    entry("b", { check: "invalid", error: "not_image" }),
    entry("c"),
    entry("d", { check: "pending" }),
    entry("e"),
  ];

  it("entran las válidas, en orden, hasta el sitio libre", () => {
    expect([...fittingIds(entries, 2)]).toEqual(["a", "c"]);
    expect(overLimit(entries, 2)).toBe(1);
  });

  it("sin saber el sitio (null) entran todas las válidas", () => {
    expect([...fittingIds(entries, null)]).toEqual(["a", "c", "e"]);
    expect(overLimit(entries, null)).toBe(0);
  });

  it("con sitio de sobra no sobra ninguna; con 0 no entra ninguna", () => {
    expect(fittingIds(entries, 100).size).toBe(3);
    expect(overLimit(entries, 100)).toBe(0);
    expect(fittingIds(entries, 0).size).toBe(0);
    expect(overLimit(entries, 0)).toBe(3);
  });
});

describe("subida masiva: modos", () => {
  it("propone según lo detectado", () => {
    expect(detectedMode(true)).toBe("as-is");
    expect(detectedMode(false)).toBe("cut");
  });

  it("modo común de las usables (las no válidas no cuentan)", () => {
    expect(commonMode([entry("a"), entry("b", { check: "invalid", mode: "as-is" })])).toBe("cut");
    expect(commonMode([entry("a"), entry("b", { mode: "as-is" })])).toBeNull();
    expect(commonMode([])).toBeNull();
  });

  it("avisa de las que irán tal cual con fondo (solo las que entran)", () => {
    const list = [
      entry("a", { mode: "as-is" }),
      entry("b", { mode: "as-is", hasAlpha: true }),
      entry("c", { mode: "as-is" }),
    ];
    expect(asIsWithBackground(list, new Set(["a", "b", "c"]))).toBe(2);
    expect(asIsWithBackground(list, new Set(["a", "b"]))).toBe(1);
  });
});

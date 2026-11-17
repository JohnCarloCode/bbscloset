import { describe, expect, it, vi } from "vitest";
import { GARMENT_TAG_MAX } from "@/lib/api/types";
import { checkTagRename, clampJewelryMax, createLatestSaver, normalizeTagName } from "./logic";

describe("clampJewelryMax", () => {
  it("acota a 1–10 y redondea", () => {
    expect(clampJewelryMax(0)).toBe(1);
    expect(clampJewelryMax(1)).toBe(1);
    expect(clampJewelryMax(5)).toBe(5);
    expect(clampJewelryMax(10)).toBe(10);
    expect(clampJewelryMax(11)).toBe(10);
    expect(clampJewelryMax(3.6)).toBe(4);
    expect(clampJewelryMax(Number.NaN)).toBe(1);
  });
});

describe("checkTagRename", () => {
  const tags = [
    { id: "a", name: "curro" },
    { id: "b", name: "Fiesta" },
  ];

  it("normaliza espacios", () => {
    expect(normalizeTagName("  para   el  curro ")).toBe("para el curro");
    expect(checkTagRename(tags[0], "  trabajo  ", tags)).toEqual({ ok: true, name: "trabajo" });
  });

  it("rechaza vacío y demasiado largo", () => {
    expect(checkTagRename(tags[0], "   ", tags)).toEqual({ ok: false, reason: "empty" });
    expect(checkTagRename(tags[0], "x".repeat(GARMENT_TAG_MAX + 1), tags)).toEqual({
      ok: false,
      reason: "tooLong",
    });
  });

  it("choque con otra etiqueta sin distinguir mayúsculas", () => {
    expect(checkTagRename(tags[0], "fiesta", tags)).toEqual({ ok: false, reason: "duplicate" });
    expect(checkTagRename(tags[0], "FIESTA ", tags)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("el mismo nombre no cambia nada; solo mayúsculas de la propia sí vale", () => {
    expect(checkTagRename(tags[0], " curro ", tags)).toEqual({ ok: false, reason: "unchanged" });
    expect(checkTagRename(tags[0], "Curro", tags)).toEqual({ ok: true, name: "Curro" });
  });
});

describe("createLatestSaver", () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("aplica al momento y envía solo el último valor tras la petición en vuelo", async () => {
    const calls: { value: number; d: ReturnType<typeof deferred<number>> }[] = [];
    const apply = vi.fn();
    const saver = createLatestSaver({
      initial: 3,
      save: (value) => {
        const d = deferred<number>();
        calls.push({ value, d });
        return d.promise;
      },
      apply,
      onError: vi.fn(),
    });

    const first = saver.set(4);
    void saver.set(5);
    void saver.set(6);
    expect(apply.mock.calls.map((c) => c[0])).toEqual([4, 5, 6]);
    expect(calls.map((c) => c.value)).toEqual([4]);

    calls[0].d.resolve(4);
    await vi.waitFor(() => expect(calls.map((c) => c.value)).toEqual([4, 6]));
    calls[1].d.resolve(6);
    await first;
    expect(saver.value).toBe(6);
  });

  it("si falla, vuelve al último valor confirmado y avisa", async () => {
    const apply = vi.fn();
    const onError = vi.fn();
    const saver = createLatestSaver({
      initial: 3,
      save: async () => {
        throw new Error("boom");
      },
      apply,
      onError,
    });
    await saver.set(5);
    expect(apply.mock.calls.map((c) => c[0])).toEqual([5, 3]);
    expect(onError).toHaveBeenCalledOnce();
    expect(saver.value).toBe(3);
  });
});

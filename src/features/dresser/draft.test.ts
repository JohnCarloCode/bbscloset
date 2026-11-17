import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_VERSION,
  draftKey,
  parseDraft,
  readDraft,
  serializeDraft,
  writeDraft,
} from "./draft";
import type { CanvasItem } from "./model";

const A = "6f1c2a4e-0b7d-4a51-9c3e-2d8f5b6a7c10";
const B = "0e2d4f6a-8b1c-4d3e-a5f7-9b0c2d4e6f81";

function item(garmentId: string, over: Partial<CanvasItem> = {}): CanvasItem {
  return {
    garmentId,
    slotId: "base_layer",
    x: 0.5,
    y: 0.3,
    scale: 0.4,
    rotation: 0,
    z: 10,
    locked: false,
    manual: false,
    placedAt: 1,
    ...over,
  };
}

describe("borrador", () => {
  it("clave por usuario", () => {
    expect(draftKey("u1")).toBe("bbscloset:draft:u1");
  });

  it("ida y vuelta: ids, posiciones, tipo y aspecto; sin nada más", () => {
    const items = [
      item(A, { manual: true, x: 0.2, rotation: 12, locked: true }),
      item(B, { slotId: "footwear", placedAt: 2 }),
    ];
    const raw = serializeDraft({ items }, (id) =>
      id === A ? { typeId: "tshirt", aspect: 0.8 } : undefined,
    );
    const json = JSON.parse(raw);
    expect(json.v).toBe(DRAFT_VERSION);
    expect(Object.keys(json.items[1]).sort()).toEqual(
      [
        "garmentId",
        "slotId",
        "x",
        "y",
        "scale",
        "rotation",
        "z",
        "locked",
        "manual",
        "placedAt",
      ].sort(),
    );
    expect(parseDraft(raw)).toEqual({
      canvas: { items },
      garments: { [A]: { typeId: "tshirt", aspect: 0.8 }, [B]: {} },
    });
  });

  it("vacío, ilegible u otra versión → null", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("{nope")).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 99, items: [] }))).toBeNull();
    expect(parseDraft(JSON.stringify({ items: [] }))).toBeNull();
  });

  it("descarta los items rotos o repetidos y conserva el resto", () => {
    const good = item(A);
    const raw = JSON.stringify({
      v: DRAFT_VERSION,
      items: [
        good,
        { ...item(B), garmentId: "no-uuid" },
        { ...item(B), x: "0.5" },
        { ...item(B), slotId: "nope" },
        { ...item(B), scale: 0 },
        // Tipo que no es de su hueco.
        { ...item(B), typeId: "jeans" },
        { ...good, x: 0.9 },
      ],
    });
    expect(parseDraft(raw)?.canvas.items).toEqual([good]);
  });
});

describe("localStorage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sin almacenamiento (modo privado, lleno) no rompe nada", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    expect(readDraft("u1")).toBeNull();
    expect(() => writeDraft("u1", "{}")).not.toThrow();
  });

  it("escribe y lee con la clave del usuario", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    });
    writeDraft(
      "u1",
      serializeDraft({ items: [item(A)] }, () => undefined),
    );
    expect([...store.keys()]).toEqual(["bbscloset:draft:u1"]);
    expect(readDraft("u1")?.canvas.items).toEqual([item(A)]);
    expect(readDraft("u2")).toBeNull();
  });
});

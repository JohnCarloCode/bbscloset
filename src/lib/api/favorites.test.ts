import { describe, expect, it } from "vitest";
import {
  createFavoriteSchema,
  favoriteId,
  normalizeItem,
  parseFavoriteListQuery,
  patchFavoriteSchema,
  sameGarments,
} from "./favorites";
import { FAVORITE_ITEMS_MAX, FAVORITE_NAME_MAX } from "./types";

const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const G3 = "33333333-3333-4333-8333-333333333333";

const manual = { x: 0.5, y: 0.4, scale: 0.3, rotation: 10, z: 40 };

describe("normalizeItem", () => {
  it("con x, y y scale guarda la posición; rotation por defecto 0", () => {
    expect(normalizeItem({ garment_id: G1, x: 0.2, y: 0.3, scale: 0.4 })).toEqual({
      garment_id: G1,
      x: 0.2,
      y: 0.3,
      scale: 0.4,
      rotation: 0,
      z: null,
    });
  });

  it("si falta alguno de x/y/scale, todo a null (también rotation); z se conserva", () => {
    expect(normalizeItem({ garment_id: G1, x: 0.2, y: 0.3, rotation: 30, z: 5 })).toEqual({
      garment_id: G1,
      x: null,
      y: null,
      scale: null,
      rotation: null,
      z: 5,
    });
    expect(normalizeItem({ garment_id: G1, x: null, y: 0.3, scale: 0.4 }).y).toBeNull();
  });

  it("normaliza la rotación a (-180, 180]", () => {
    expect(normalizeItem({ garment_id: G1, ...manual, rotation: 270 }).rotation).toBe(-90);
    expect(normalizeItem({ garment_id: G1, ...manual, rotation: -180 }).rotation).toBe(180);
  });
});

describe("createFavoriteSchema", () => {
  const parse = (body: unknown) => createFavoriteSchema.safeParse(body);

  it("acepta nombre opcional, items automáticos y manuales, e ignora locked", () => {
    const r = parse({
      name: "  Look   de  domingo ",
      items: [
        { garment_id: G1, ...manual, locked: true },
        { garment_id: G2 },
        { garment_id: G3, x: null, y: null, scale: null, rotation: null, z: null },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.data!.name).toBe("Look de domingo");
    expect(r.data!.items[0]).toEqual({ garment_id: G1, ...manual });
    expect(r.data!.items[1]).toEqual({
      garment_id: G2,
      x: null,
      y: null,
      scale: null,
      rotation: null,
      z: null,
    });
  });

  it("nombre vacío → null; demasiado largo → error", () => {
    expect(parse({ name: "   ", items: [{ garment_id: G1 }] }).data?.name).toBeNull();
    expect(parse({ items: [{ garment_id: G1 }] }).data?.name).toBeUndefined();
    expect(
      parse({ name: "a".repeat(FAVORITE_NAME_MAX + 1), items: [{ garment_id: G1 }] }).success,
    ).toBe(false);
  });

  it("entre 1 y el máximo de items, sin prendas repetidas", () => {
    expect(parse({ items: [] }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    const many = Array.from({ length: FAVORITE_ITEMS_MAX + 1 }, () => ({
      garment_id: crypto.randomUUID(),
    }));
    expect(parse({ items: many }).success).toBe(false);
    expect(parse({ items: many.slice(0, FAVORITE_ITEMS_MAX) }).success).toBe(true);
    expect(parse({ items: [{ garment_id: G1 }, { garment_id: G1, ...manual }] }).success).toBe(
      false,
    );
  });

  it("rechaza ids que no son uuid, campos desconocidos y valores fuera de rango", () => {
    expect(parse({ items: [{ garment_id: "x" }] }).success).toBe(false);
    expect(parse({ items: [{ garment_id: G1, foo: 1 }] }).success).toBe(false);
    expect(parse({ items: [{ garment_id: G1 }], extra: true }).success).toBe(false);
    const bad = [
      { x: 3 },
      { y: -2 },
      { scale: 0 },
      { scale: 10 },
      { rotation: 400 },
      { z: 1.5 },
      { z: 1e9 },
      { x: "0.5" },
    ];
    for (const b of bad) {
      expect(
        parse({ items: [{ garment_id: G1, ...manual, ...b }] }).success,
        JSON.stringify(b),
      ).toBe(false);
    }
    // NaN e Infinity no llegan por JSON, pero tampoco pasan.
    expect(parse({ items: [{ garment_id: G1, ...manual, x: Number.NaN }] }).success).toBe(false);
    expect(parse({ items: [{ garment_id: G1, ...manual, y: Infinity }] }).success).toBe(false);
  });
});

describe("patchFavoriteSchema", () => {
  const parse = (body: unknown) => patchFavoriteSchema.safeParse(body);

  it("exige nombre o items", () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ name: null }).data).toEqual({ name: null });
    expect(parse({ items: [{ garment_id: G1, ...manual }] }).success).toBe(true);
  });

  it("valida los items igual que al crear", () => {
    expect(parse({ items: [] }).success).toBe(false);
    expect(parse({ items: [{ garment_id: G1 }, { garment_id: G1 }] }).success).toBe(false);
  });
});

describe("sameGarments", () => {
  it("compara conjuntos sin importar el orden", () => {
    expect(sameGarments([G1, G2], [G2, G1])).toBe(true);
    expect(sameGarments([G1, G2], [G1])).toBe(false);
    expect(sameGarments([G1, G2], [G1, G3])).toBe(false);
    expect(sameGarments([G1, G2], [G1, G1])).toBe(false);
  });
});

describe("favoriteId y parseFavoriteListQuery", () => {
  it("un id que no es uuid da 404", () => {
    expect(favoriteId({ id: G1 })).toBe(G1);
    expect(() => favoriteId({ id: "nope" })).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("limit por defecto 24, máximo 100; cursor opcional", () => {
    expect(parseFavoriteListQuery(new URLSearchParams())).toEqual({ limit: 24 });
    expect(parseFavoriteListQuery(new URLSearchParams("limit=5&cursor=abc"))).toEqual({
      limit: 5,
      cursor: "abc",
    });
    expect(() => parseFavoriteListQuery(new URLSearchParams("limit=500"))).toThrow(
      expect.objectContaining({ status: 400, code: "invalid_query" }),
    );
  });
});

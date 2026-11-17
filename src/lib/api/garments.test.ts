import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  cleanTagNames,
  createGarmentSchema,
  DEFAULT_PAGE_SIZE,
  garmentId,
  garmentPaths,
  parseListQuery,
  patchGarmentSchema,
  resolveColor,
} from "./garments";

const UUID = "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const UUID2 = "7f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";

describe("resolveColor", () => {
  it("hex → normalizado y con familia", () => {
    expect(resolveColor("#C62828", undefined)).toEqual({
      color_hex: "#c62828",
      color_family: "red",
    });
    expect(resolveColor("fff", undefined)).toEqual({ color_hex: "#ffffff", color_family: "white" });
  });

  it("multicolor explícito, sin hex", () => {
    expect(resolveColor(undefined, "multicolor")).toEqual({
      color_hex: null,
      color_family: "multicolor",
    });
    expect(resolveColor(null, "multicolor")).toEqual({
      color_hex: null,
      color_family: "multicolor",
    });
    expect(() => resolveColor("#fff", "multicolor")).toThrow(ApiError);
  });

  it("null quita el color; nada no lo toca; hex inválido → 400", () => {
    expect(resolveColor(null, undefined)).toEqual({ color_hex: null, color_family: null });
    expect(resolveColor(undefined, null)).toEqual({ color_hex: null, color_family: null });
    expect(resolveColor(undefined, undefined)).toBeUndefined();
    expect(() => resolveColor("azul", undefined)).toThrow(
      expect.objectContaining({ status: 400, code: "invalid_body" }),
    );
  });
});

describe("cleanTagNames", () => {
  it("recorta, quita vacíos y deduplica sin distinguir mayúsculas (se queda la primera)", () => {
    expect(
      cleanTagNames([" Elegante ", "elegante", "", "  ", "para  curro", "ÉPICO", "épico"]),
    ).toEqual(["Elegante", "para curro", "ÉPICO"]);
  });
});

describe("createGarmentSchema / patchGarmentSchema", () => {
  it("valores por defecto y limpieza", () => {
    const out = createGarmentSchema.parse({
      id: UUID,
      type_id: "jeans",
      name: "  ",
      brand: " Zara ",
      seasons: ["winter", "spring", "winter"],
      tags: ["a", "A"],
    });
    expect(out).toMatchObject({
      name: null,
      brand: "Zara",
      seasons: ["spring", "winter"],
      tags: ["a"],
    });
    expect(createGarmentSchema.parse({ id: UUID, type_id: "jeans" })).toMatchObject({
      seasons: [],
      tags: [],
    });
  });

  it("rechaza tipos, temporadas, familias y campos desconocidos", () => {
    const base = { id: UUID, type_id: "jeans" };
    for (const bad of [
      { ...base, type_id: "pijama" },
      { ...base, seasons: ["monsoon"] },
      { ...base, color_family: "red" },
      { ...base, slot: "bottom" },
      { ...base, name: "x".repeat(81) },
      { ...base, tags: ["x".repeat(41)] },
      { id: "no-uuid", type_id: "jeans" },
    ]) {
      expect(createGarmentSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("PATCH exige algún campo", () => {
    expect(patchGarmentSchema.safeParse({}).success).toBe(false);
    expect(patchGarmentSchema.safeParse({ archived: true }).success).toBe(true);
    expect(patchGarmentSchema.safeParse({ name: null }).success).toBe(true);
  });
});

describe("parseListQuery", () => {
  const parse = (qs: string) => parseListQuery(new URLSearchParams(qs));

  it("valores por defecto", () => {
    expect(parse("")).toEqual({
      archived: false,
      type: [],
      brand: [],
      color: [],
      tags: [],
      limit: DEFAULT_PAGE_SIZE,
      count: false,
      ids: false,
      include: [],
    });
  });

  it("varios valores repetidos o con comas", () => {
    const q = parse(`type=jeans,skirt&type=dress&tags=${UUID}&tags=${UUID2}&include=cutout`);
    expect(q.type).toEqual(["jeans", "skirt", "dress"]);
    expect(q.tags).toEqual([UUID, UUID2]);
    expect(q.include).toEqual(["cutout"]);
  });

  it("booleanos, límite y filtros simples", () => {
    expect(
      parse("archived=true&limit=0&count=true&slot=bag&color=multicolor&brand=Zara"),
    ).toMatchObject({
      archived: true,
      limit: 0,
      count: true,
      slot: "bag",
      color: ["multicolor"],
      brand: ["Zara"],
    });
  });

  it("varias familias de color: repetidas o con comas", () => {
    expect(parse("color=red,blue&color=multicolor").color).toEqual(["red", "blue", "multicolor"]);
    expect(parse("").color).toEqual([]);
  });

  it("varias marcas: solo repetidas (una marca puede llevar comas)", () => {
    expect(parse("brand=Zara&brand=Mango, Inc.").brand).toEqual(["Zara", "Mango, Inc."]);
    expect(parse("").brand).toEqual([]);
  });

  it("parámetros inválidos → 400 invalid_query", () => {
    for (const qs of [
      "limit=101",
      "limit=-1",
      "slot=x",
      "type=pijama",
      "tags=1",
      "color=navy",
      "color=red,navy",
      "archived=1",
    ]) {
      expect(() => parse(qs), qs).toThrow(
        expect.objectContaining({ status: 400, code: "invalid_query" }),
      );
    }
  });
});

describe("garmentPaths / garmentId", () => {
  it("rutas de Storage", () => {
    expect(garmentPaths("u", "g")).toEqual({ cutout: "u/g/cutout.webp", thumb: "u/g/thumb.webp" });
  });

  it("un id que no es uuid → 404", () => {
    expect(garmentId({ id: UUID })).toBe(UUID);
    expect(() => garmentId({ id: "1 or 1=1" })).toThrow(
      expect.objectContaining({ status: 404, code: "not_found" }),
    );
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { renameTagSchema, tagId } from "./tags";
import { GARMENT_TAG_MAX } from "./types";

describe("renameTagSchema", () => {
  const parse = (body: unknown) => renameTagSchema.safeParse(body);

  it("recorta y colapsa espacios; respeta mayúsculas", () => {
    expect(parse({ name: "  Para   curro " }).data).toEqual({ name: "Para curro" });
    expect(parse({ name: "Curro" }).data).toEqual({ name: "Curro" });
  });

  it(`acepta de 1 a ${GARMENT_TAG_MAX} caracteres tras recortar`, () => {
    expect(parse({ name: "a" }).success).toBe(true);
    expect(parse({ name: "x".repeat(GARMENT_TAG_MAX) }).success).toBe(true);
    expect(parse({ name: ` ${"x".repeat(GARMENT_TAG_MAX)}  ` }).success).toBe(true);
    expect(parse({ name: "x".repeat(GARMENT_TAG_MAX + 1) }).success).toBe(false);
  });

  it("rechaza vacío, solo espacios, tipo erróneo, falta de nombre y campos extra", () => {
    expect(parse({ name: "" }).success).toBe(false);
    expect(parse({ name: "   " }).success).toBe(false);
    expect(parse({ name: 3 }).success).toBe(false);
    expect(parse({ name: null }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ name: "ok", count: 3 }).success).toBe(false);
  });
});

describe("tagId", () => {
  it("devuelve un uuid válido", () => {
    const id = "6f1d2c1e-8f1a-4b2c-9d3e-1a2b3c4d5e6f";
    expect(tagId({ id })).toBe(id);
  });

  it("un id que no es uuid → 404 not_found", () => {
    try {
      tagId({ id: "curro" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).code).toBe("not_found");
    }
  });
});

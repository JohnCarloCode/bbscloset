import { describe, expect, it } from "vitest";
import { checkValues, migration } from "@/test/migrations";
import {
  COLOR_FAMILY_IDS,
  COLOR_SWATCHES,
  colorSwatchBackground,
  isColorFamilyId,
  multicolorGradient,
} from "./colors";
import { isSeasonId, SEASON_IDS } from "./seasons";

const sql0002 = migration("0002_user_tables.sql");

describe("temporadas", () => {
  it("coinciden con la restricción de garments.seasons", () => {
    expect([...SEASON_IDS]).toEqual(checkValues(sql0002, "seasons"));
  });

  it("isSeasonId", () => {
    expect(isSeasonId("winter")).toBe(true);
    expect(isSeasonId("fall")).toBe(false);
  });
});

describe("familias de color", () => {
  it("son 13 y coinciden con la restricción de garments.color_family", () => {
    expect(COLOR_FAMILY_IDS).toHaveLength(13);
    expect([...COLOR_FAMILY_IDS]).toEqual(checkValues(sql0002, "color_family"));
  });

  it("todas menos multicolor tienen muestra, en formato #aabbcc", () => {
    const withSwatch = COLOR_FAMILY_IDS.filter((f) => f !== "multicolor");
    expect(Object.keys(COLOR_SWATCHES).sort()).toEqual([...withSwatch].sort());
    for (const hex of Object.values(COLOR_SWATCHES)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("colorSwatchBackground: hex de la muestra o degradado en multicolor", () => {
    expect(colorSwatchBackground("red")).toBe(COLOR_SWATCHES.red);
    expect(colorSwatchBackground("multicolor")).toBe(multicolorGradient());
    expect(multicolorGradient()).toMatch(/^conic-gradient\(/);
  });

  it("isColorFamilyId", () => {
    expect(isColorFamilyId("multicolor")).toBe(true);
    expect(isColorFamilyId("grey")).toBe(false);
  });
});

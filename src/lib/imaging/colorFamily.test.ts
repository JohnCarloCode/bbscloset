import { describe, expect, it } from "vitest";
import { COLOR_SWATCHES, type SolidColorFamilyId } from "@/lib/domain/colors";
import { colorFamily, normalizeHex } from "./colorFamily";

describe("normalizeHex", () => {
  it("pasa a #aabbcc en minúsculas", () => {
    expect(normalizeHex("#1E3A8A")).toBe("#1e3a8a");
    expect(normalizeHex("1e3a8a")).toBe("#1e3a8a");
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
  });

  it("rechaza lo que no es un hex", () => {
    for (const bad of ["", "#", "#12345", "#1234567", "#gggggg", "red", "#12 345"]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("colorFamily", () => {
  const cases: [string, SolidColorFamilyId][] = [
    ["#000000", "black"],
    ["#1e3a8a", "blue"],
    ["#f5deb3", "beige"],
    ["#ffffff", "white"],
    ["#808080", "gray"],
    ["#ff0000", "red"],
    ["#00a000", "green"],
    ["#f0d7d7", "pink"],
    ["#8b4513", "brown"],
    ["#ffeb3b", "yellow"],
    ["#ff8000", "orange"],
    ["#6a1b9a", "purple"],
    // Casos límite habituales en ropa
    ["#f5f5f5", "white"],
    ["#2b2b2b", "black"],
    ["#1a1a2e", "black"], // negro con un leve tinte azul
    ["#36454f", "gray"], // gris marengo
    ["#191970", "blue"], // azul marino
    ["#722f37", "red"], // granate
    ["#d2b48c", "beige"], // tostado
    ["#808000", "green"], // oliva
  ];

  for (const [hex, family] of cases) {
    it(`${hex} → ${family}`, () => expect(colorFamily(hex)).toBe(family));
  }

  it("acepta mayúsculas y formato corto", () => {
    expect(colorFamily("#1E3A8A")).toBe("blue");
    expect(colorFamily("#FFF")).toBe("white");
  });

  it("hex inválido → null", () => {
    expect(colorFamily("azul")).toBeNull();
    expect(colorFamily("#12345")).toBeNull();
  });

  it("cada muestra de familia se clasifica en su propia familia", () => {
    for (const [family, hex] of Object.entries(COLOR_SWATCHES)) {
      expect(colorFamily(hex)).toBe(family);
    }
  });

  it("nunca devuelve multicolor", () => {
    for (let i = 0; i < 4096; i++) {
      const hex = `#${i.toString(16).padStart(3, "0")}`;
      expect(colorFamily(hex)).not.toBe("multicolor");
    }
  });
});

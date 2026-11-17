import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/api/types";
import {
  addTag,
  brandSuggestions,
  canonicalBrand,
  colorFamilyOf,
  displayName,
  emptyGarmentForm,
  formChanged,
  formValuesFromGarment,
  isGarmentFormValid,
  mergeVocabulary,
  normalizeTag,
  tagChoices,
  toGarmentData,
  toGarmentPatch,
  validateGarmentForm,
} from "./logic";

const withType = { ...emptyGarmentForm(), typeId: "shirt" as const };

describe("validación", () => {
  it("el tipo es obligatorio y lo demás opcional", () => {
    expect(validateGarmentForm(emptyGarmentForm())).toEqual({ type: "required" });
    expect(isGarmentFormValid(emptyGarmentForm())).toBe(false);
    expect(isGarmentFormValid(withType)).toBe(true);
  });

  it("topes de longitud de nombre y marca (tras limpiar espacios)", () => {
    expect(validateGarmentForm({ ...withType, name: "a".repeat(81) })).toEqual({
      name: "tooLong",
    });
    expect(validateGarmentForm({ ...withType, name: ` ${"a".repeat(80)}   ` })).toEqual({});
    expect(validateGarmentForm({ ...withType, brand: "b".repeat(61) })).toEqual({
      brand: "tooLong",
    });
  });
});

describe("nombre por defecto", () => {
  it("vacío o solo espacios → el nombre del tipo", () => {
    expect(displayName("", "Camisa")).toBe("Camisa");
    expect(displayName("   ", "Camisa")).toBe("Camisa");
    expect(displayName(null, "Camisa")).toBe("Camisa");
    expect(displayName("  la  de flores ", "Camisa")).toBe("la de flores");
  });
});

describe("etiquetas", () => {
  it("normaliza: espacios, # y minúsculas", () => {
    expect(normalizeTag("  Para   Curro ")).toBe("para curro");
    expect(normalizeTag("#Fiesta")).toBe("fiesta");
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("#")).toBeNull();
    expect(normalizeTag("x".repeat(41))).toBeNull();
  });

  it("reutiliza la grafía de una etiqueta existente", () => {
    expect(normalizeTag("ELEGANTE", ["Elegante", "cómodo"])).toBe("Elegante");
    expect(normalizeTag("Cómodo", ["elegante", "cómodo"])).toBe("cómodo");
  });

  it("addTag no duplica sin distinguir mayúsculas", () => {
    expect(addTag(["fiesta"], "Fiesta")).toEqual(["fiesta"]);
    expect(addTag(["fiesta"], "findes")).toEqual(["fiesta", "findes"]);
    expect(addTag(["fiesta"], "  ")).toEqual(["fiesta"]);
  });

  it("tagChoices: orden estable, filtro por prefijo y las nuevas al final", () => {
    const vocab = ["elegante", "cómodo", "Fiesta", "fiesta", "findes"];
    expect(tagChoices(["curro"], vocab, "")).toEqual([
      "elegante",
      "cómodo",
      "Fiesta",
      "findes",
      "curro",
    ]);
    expect(tagChoices(["curro", "cómodo"], vocab, "#fi")).toEqual([
      "cómodo",
      "Fiesta",
      "findes",
      "curro",
    ]);
    expect(tagChoices(["fiesta"], vocab, "")).toEqual(["elegante", "cómodo", "fiesta", "findes"]);
    expect(tagChoices([], vocab, "", 2)).toEqual(["elegante", "cómodo"]);
  });

  it("mergeVocabulary une sin duplicados respetando el orden", () => {
    expect(mergeVocabulary(["Zara", "Mango"], ["zara", "Bershka"], [""])).toEqual([
      "Zara",
      "Mango",
      "Bershka",
    ]);
  });
});

describe("marca", () => {
  it("sugerencias por prefijo, sin la exacta", () => {
    const brands = ["Zara", "Zadig", "Mango"];
    expect(brandSuggestions(brands, "")).toEqual(brands);
    expect(brandSuggestions(brands, "za")).toEqual(["Zara", "Zadig"]);
    expect(brandSuggestions(brands, "zara")).toEqual([]);
  });

  it("canonicalBrand usa la grafía ya usada", () => {
    expect(canonicalBrand("  zara ", ["Zara"])).toBe("Zara");
    expect(canonicalBrand("Nueva  marca", ["Zara"])).toBe("Nueva marca");
    expect(canonicalBrand("  ")).toBe("");
  });
});

describe("color", () => {
  it("familia en vivo del hex; multicolor explícito; sin color", () => {
    expect(colorFamilyOf({ kind: "hex", hex: "#1e3a8a" })).toBe("blue");
    expect(colorFamilyOf({ kind: "multicolor" })).toBe("multicolor");
    expect(colorFamilyOf({ kind: "none" })).toBeNull();
    expect(colorFamilyOf({ kind: "hex", hex: "nope" })).toBeNull();
  });
});

describe("toGarmentData", () => {
  it("limpia y quita lo vacío", () => {
    expect(
      toGarmentData({
        ...withType,
        name: "  ",
        brand: " ",
        seasons: ["winter", "spring"],
        color: { kind: "hex", hex: "#ABCDEF" },
        tags: ["fiesta"],
      }),
    ).toEqual({
      type_id: "shirt",
      seasons: ["spring", "winter"],
      color_hex: "#abcdef",
      color_family: null,
      tags: ["fiesta"],
    });
  });

  it("multicolor va sin hex (decisión 2)", () => {
    const data = toGarmentData({ ...withType, name: "Flores", color: { kind: "multicolor" } });
    expect(data).toMatchObject({ name: "Flores", color_hex: null, color_family: "multicolor" });
  });

  it("sin tipo lanza", () => {
    expect(() => toGarmentData(emptyGarmentForm())).toThrow();
  });

  it("ida y vuelta desde una prenda guardada", () => {
    const g = {
      type_id: "jeans",
      name: null,
      seasons: ["autumn"],
      color_hex: null,
      color_family: "multicolor",
      brand: "Levi's",
      tags: [{ id: "t1", name: "findes" }],
    } as unknown as Garment;
    const v = formValuesFromGarment(g);
    expect(v).toEqual({
      typeId: "jeans",
      name: "",
      seasons: ["autumn"],
      color: { kind: "multicolor" },
      brand: "Levi's",
      tags: ["findes"],
    });
  });
});

describe("toGarmentPatch y formChanged (ficha, 3.10)", () => {
  it("los vacíos van como null para borrarlos", () => {
    expect(toGarmentPatch({ ...withType, name: " ", brand: "" })).toEqual({
      type_id: "shirt",
      name: null,
      seasons: [],
      color_hex: null,
      color_family: null,
      brand: null,
      tags: [],
    });
  });

  it("color: hex, multicolor o ninguno", () => {
    expect(toGarmentPatch({ ...withType, color: { kind: "hex", hex: "#FFF" } })).toMatchObject({
      color_hex: "#ffffff",
      color_family: null,
    });
    expect(toGarmentPatch({ ...withType, color: { kind: "multicolor" } })).toMatchObject({
      color_hex: null,
      color_family: "multicolor",
    });
  });

  it("formChanged solo mira lo que se guarda", () => {
    const base = { ...withType, name: "Flores", tags: ["fiesta"] };
    expect(formChanged(base, { ...base, name: " Flores  " })).toBe(false);
    expect(formChanged(base, { ...base, name: "Rayas" })).toBe(true);
    expect(formChanged(base, { ...base, tags: ["fiesta", "curro"] })).toBe(true);
    expect(formChanged(base, { ...base, typeId: null })).toBe(true);
  });
});

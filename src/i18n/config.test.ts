import { describe, expect, it } from "vitest";
import { primaryLanguage, resolveLocale } from "./config";

describe("resolveLocale", () => {
  it("la cookie válida manda sobre el navegador", () => {
    expect(resolveLocale("en", "es-ES")).toBe("en");
    expect(resolveLocale("es", "en-US")).toBe("es");
  });

  it("sin cookie (o inválida) usa el idioma principal del navegador si es es/en", () => {
    expect(resolveLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale("fr", "es-ES,es;q=0.9")).toBe("es");
    expect(resolveLocale(null, "es-419")).toBe("es");
  });

  it("en cualquier otro caso, castellano", () => {
    expect(resolveLocale(undefined, "fr")).toBe("es");
    expect(resolveLocale(undefined, "fr-FR,en;q=0.8")).toBe("es");
    expect(resolveLocale(undefined, null)).toBe("es");
    expect(resolveLocale(undefined, "*")).toBe("es");
  });
});

describe("primaryLanguage", () => {
  it("elige el de mayor q y, ante empate, el primero", () => {
    expect(primaryLanguage("fr;q=0.5,en;q=0.9")).toBe("en");
    expect(primaryLanguage("EN-gb, es")).toBe("en");
    expect(primaryLanguage("")).toBeNull();
  });
});

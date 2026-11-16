// Los dos idiomas tienen las mismas claves y las listas cerradas coinciden
// con las semillas de las migraciones (huecos y tipos en 0001; temporadas y
// familias de color en las restricciones de 0002).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";

const migration = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)),
    "utf8",
  );

/** Rutas "a.b.c" de todas las hojas de un objeto de mensajes. */
function leafKeys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === "object" ? [path + "/", ...leafKeys(v, path)] : [path];
  });
}

/** Primer valor entre comillas de cada fila del INSERT INTO <table> ... values (...). */
function insertedIds(sql: string, table: string): string[] {
  const start = sql.indexOf(`insert into public.${table}`);
  const end = sql.indexOf("on conflict", start);
  expect(start).toBeGreaterThanOrEqual(0);
  return [...sql.slice(start, end).matchAll(/^\s*\('([a-z_]+)'/gm)].map((m) => m[1]);
}

/** Valores de un array['a','b'] o de un in ('a','b') tras la columna indicada. */
function checkValues(sql: string, column: string): string[] {
  const at = sql.search(new RegExp(`^\\s*${column}\\s`, "m"));
  expect(at).toBeGreaterThanOrEqual(0);
  const body = sql.slice(at).match(/(?:array\[|in \()([^\])]*)/)?.[1] ?? "";
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const sorted = (xs: string[]) => [...xs].sort();

describe("mensajes", () => {
  it("es.json y en.json tienen exactamente las mismas claves", () => {
    expect(sorted(leafKeys(en))).toEqual(sorted(leafKeys(es)));
  });

  it("ningún texto está vacío", () => {
    for (const messages of [es, en]) {
      const empty = leafKeys(messages).filter((k) => {
        if (k.endsWith("/")) return false;
        const value = k
          .split(".")
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], messages);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });

  const sql0001 = migration("0001_closed_lists.sql");
  const sql0002 = migration("0002_user_tables.sql");
  const lists = {
    slots: insertedIds(sql0001, "slots"),
    types: insertedIds(sql0001, "garment_types"),
    seasons: checkValues(sql0002, "seasons"),
    colors: checkValues(sql0002, "color_family"),
  };

  it("las migraciones tienen 9 huecos, 33 tipos, 4 temporadas y 13 familias de color", () => {
    expect(lists.slots).toHaveLength(9);
    expect(lists.types).toHaveLength(33);
    expect(lists.seasons).toHaveLength(4);
    expect(lists.colors).toHaveLength(13);
  });

  for (const [ns, ids] of Object.entries(lists)) {
    it(`${ns}: mismos ids que la base de datos en los dos idiomas`, () => {
      expect(sorted(Object.keys(es[ns as keyof typeof es]))).toEqual(sorted(ids));
      expect(sorted(Object.keys(en[ns as keyof typeof en]))).toEqual(sorted(ids));
    });
  }

  it("traduce huecos y plurales con ICU", () => {
    const tEs = createTranslator({ locale: "es", messages: es });
    const tEn = createTranslator({ locale: "en", messages: en });
    expect(tEs("slots.jewelry")).toBe("Joyería");
    expect(tEn("slots.jewelry")).toBe("Jewelry");
    expect(tEs("favorites.savedCount", { count: 3 })).toBe("3 outfits guardados");
    expect(tEs("favorites.savedCount", { count: 1 })).toBe("1 outfit guardado");
    expect(tEn("favorites.savedCount", { count: 0 })).toBe("No saved outfits");
  });
});

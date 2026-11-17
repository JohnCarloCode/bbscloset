// Los dos idiomas tienen las mismas claves y las listas cerradas coinciden
// con las semillas de las migraciones (huecos y tipos en 0001; temporadas y
// familias de color en las restricciones de 0002).
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { checkValues, insertedIds, migration } from "../test/migrations";

/** Rutas "a.b.c" de todas las hojas de un objeto de mensajes. */
function leafKeys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === "object" ? [path + "/", ...leafKeys(v, path)] : [path];
  });
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

describe("avisos del vestidor (screens 7.2)", () => {
  const es_t = createTranslator({ locale: "es", messages: es, namespace: "dresser" });
  const en_t = createTranslator({ locale: "en", messages: en, namespace: "dresser" });

  it("textos de screens 7.2 en castellano", () => {
    const list = `${es_t("toast.refTo", { type: "tshirt", name: "" })} y ${es_t("toast.ref", { type: "trousers", name: "" })}`;
    expect(
      es_t("toast.replacedBy", {
        name: es_t("toast.ref", { type: "dress", name: "" }),
        subject: "dress",
        list,
      }),
    ).toBe("el vestido ha sustituido a la camiseta y el pantalón.");
    expect(es_t("toast.refTo", { type: "dress", name: "" })).toBe("al vestido");
    expect(
      es_t("toast.replacedBy", { name: "los vaqueros", subject: "jeans", list: "al vestido" }),
    ).toBe("los vaqueros han sustituido al vestido.");
    expect(
      es_t("toast.jewelryDropped", {
        max: 3,
        type: "necklace",
        name: es_t("toast.ref", { type: "necklace", name: "" }),
      }),
    ).toBe("Hasta 3 joyas. Se ha quitado el collar.");
    expect(es_t("random.missing", { list: es_t("random.slotPlural", { slot: "bag" }) })).toBe(
      "Todavía no tienes bolsos",
    );
    expect(es_t("random.addOne", { slot: "bag" })).toBe("Añadir uno");
    expect(es_t("toast.ref", { type: "named", name: "la de los domingos" })).toBe(
      "la de los domingos",
    );
  });

  it("textos en inglés", () => {
    expect(en_t("toast.ref", { type: "tshirt", name: "" })).toBe("the T-shirt");
    expect(en_t("random.addOne", { slot: "bag" })).toBe("Add one");
  });
});

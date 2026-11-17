import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { insertedRows, migration } from "@/test/migrations";
import { isSlotId, SLOT_IDS, SLOTS } from "./slots";

describe("huecos", () => {
  it("son los 9 huecos de 0001, sin repetir", () => {
    expect(SLOT_IDS).toHaveLength(9);
    expect(new Set(SLOT_IDS).size).toBe(9);
    expect(Object.keys(SLOTS)).toEqual([...SLOT_IDS]);
  });

  it("coinciden con la semilla de public.slots (orden, z, peso y multi)", () => {
    const rows = insertedRows(migration("0001_closed_lists.sql"), "slots");
    const fromSql = rows.map(([id, sortOrder, defaultZ, sizeWeight, multi]) => ({
      id,
      sortOrder: Number(sortOrder),
      defaultZ: Number(defaultZ),
      sizeWeight: Number(sizeWeight),
      multi: multi === "true",
    }));
    expect(SLOT_IDS.map((id) => SLOTS[id])).toEqual(fromSql);
  });

  it("solo joyería admite varias prendas", () => {
    expect(SLOT_IDS.filter((id) => SLOTS[id].multi)).toEqual(["jewelry"]);
  });

  it("SLOT_IDS va en orden de sort_order", () => {
    expect(SLOT_IDS.map((id) => SLOTS[id].sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("coinciden con las claves slots.* de los mensajes", () => {
    expect(Object.keys(es.slots).sort()).toEqual([...SLOT_IDS].sort());
    expect(Object.keys(en.slots).sort()).toEqual([...SLOT_IDS].sort());
  });

  it("isSlotId", () => {
    expect(isSlotId("bag")).toBe(true);
    expect(isSlotId("hat")).toBe(false);
    expect(isSlotId("toString")).toBe(false);
    expect(isSlotId(1)).toBe(false);
  });
});

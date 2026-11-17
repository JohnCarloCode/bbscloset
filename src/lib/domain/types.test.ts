import { describe, expect, it } from "vitest";
import { insertedRows, migration } from "@/test/migrations";
import { isSlotId, SLOT_IDS } from "./slots";
import {
  GARMENT_TYPE_IDS,
  GARMENT_TYPE_SLOT,
  isGarmentTypeId,
  slotOfType,
  typesOfSlot,
} from "./types";

describe("tipos de prenda", () => {
  it("son 33 y coinciden (id y hueco, en orden) con la semilla de public.garment_types", () => {
    const rows = insertedRows(migration("0001_closed_lists.sql"), "garment_types");
    expect(GARMENT_TYPE_IDS).toHaveLength(33);
    expect(Object.entries(GARMENT_TYPE_SLOT)).toEqual(rows);
  });

  it("cada tipo tiene un hueco válido", () => {
    for (const type of GARMENT_TYPE_IDS) expect(isSlotId(slotOfType(type))).toBe(true);
  });

  it("todos los huecos tienen al menos un tipo", () => {
    for (const slot of SLOT_IDS) expect(typesOfSlot(slot).length).toBeGreaterThan(0);
    expect(typesOfSlot("full_body")).toEqual(["dress", "jumpsuit"]);
  });

  it("isGarmentTypeId", () => {
    expect(isGarmentTypeId("jeans")).toBe(true);
    expect(isGarmentTypeId("bottom")).toBe(false);
    expect(isGarmentTypeId("constructor")).toBe(false);
    expect(isGarmentTypeId(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { isSlotId, SLOT_IDS } from "./slots";

describe("SLOT_IDS", () => {
  it("son los 9 huecos de 0001, sin repetir", () => {
    expect(SLOT_IDS).toHaveLength(9);
    expect(new Set(SLOT_IDS).size).toBe(9);
  });

  it("coinciden con las claves slots.* de los mensajes", () => {
    expect(Object.keys(es.slots).sort()).toEqual([...SLOT_IDS].sort());
    expect(Object.keys(en.slots).sort()).toEqual([...SLOT_IDS].sort());
  });

  it("isSlotId", () => {
    expect(isSlotId("bag")).toBe(true);
    expect(isSlotId("hat")).toBe(false);
    expect(isSlotId(1)).toBe(false);
  });
});

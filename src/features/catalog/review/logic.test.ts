import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/features/queue/types";
import {
  advance,
  currentId,
  isToReview,
  nextIndex,
  reviewCount,
  startSession,
  toReview,
  type ReviewSession,
} from "./logic";

const item = (localId: string, createdAt: number, over: Partial<QueueItem> = {}) =>
  ({ localId, createdAt, kind: "garment", needsReview: true, ...over }) as QueueItem;

describe("franja por revisar", () => {
  it("cuenta solo las prendas de la subida masiva sin datos ni subir", () => {
    const items = [
      item("a", 1),
      item("b", 2, { garmentData: { type_id: "shirt", seasons: [], tags: [] } }),
      item("c", 3, { needsReview: false }),
      item("d", 4, { uploaded: true }),
      item("e", 5, { kind: "batch" }),
      item("f", 6, { kind: "replace" }),
      item("g", 7, { status: "error" }),
    ];
    expect(items.filter(isToReview).map((i) => i.localId)).toEqual(["a", "g"]);
    expect(reviewCount(items)).toBe(2);
    expect(reviewCount([])).toBe(0);
  });

  it("orden de revisión: por llegada", () => {
    const items = [item("late", 30), item("first", 10), item("mid", 20)];
    expect(toReview(items).map((i) => i.localId)).toEqual(["first", "mid", "late"]);
  });
});

describe("pasada de revisión", () => {
  const items = ["a", "b", "c", "d", "e"].map((id, i) => item(id, i + 1));
  const ids = (s: ReviewSession) => currentId(s);

  it("empieza por la primera; sin nada por revisar no hay pasada", () => {
    const s = startSession(items)!;
    expect(s.order).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(s)).toBe("a");
    expect(startSession([])).toBeNull();
  });

  it("revisar 3 y saltar 2: acaba con 3 añadidas y las 2 saltadas siguen por revisar", () => {
    let s = startSession(items)!;
    let pending = new Set(s.order);
    const act = (action: "save" | "skip" | "discard") => {
      const id = currentId(s)!;
      if (action !== "skip") pending = new Set([...pending].filter((x) => x !== id));
      s = advance(s, pending, action);
    };
    act("save");
    expect(ids(s)).toBe("b");
    act("skip");
    expect(ids(s)).toBe("c");
    act("save");
    act("skip");
    expect(ids(s)).toBe("e");
    act("save");
    // Solo quedan las saltadas: la pasada acaba.
    expect(s.index).toBe(-1);
    expect(s.added).toBe(3);
    expect(s.skipped).toEqual(["b", "d"]);
    expect([...pending]).toEqual(["b", "d"]);
  });

  it("descartar no cuenta como añadida", () => {
    let s = startSession(items.slice(0, 2))!;
    s = advance(s, new Set(["b"]), "discard");
    expect(ids(s)).toBe("b");
    expect(s.added).toBe(0);
  });

  it("da la vuelta a las que quedaron antes sin ver (p. ej. quitada desde fuera)", () => {
    const s: ReviewSession = { order: ["a", "b", "c"], index: 2, skipped: [], added: 1 };
    expect(nextIndex(s, new Set(["a", "c"]))).toBe(0);
    expect(nextIndex(s, new Set(["c"]))).toBe(-1);
    const gone = advance({ ...s, index: 1 }, new Set(["a", "c"]), "gone");
    expect(ids(gone)).toBe("c");
    expect(gone.added).toBe(1);
  });
});

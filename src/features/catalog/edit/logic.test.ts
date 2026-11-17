import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/features/queue/types";
import { deleteNotices, pendingReplaceOf } from "./logic";

const item = (localId: string, extra: Partial<QueueItem>): QueueItem => ({
  localId,
  userId: "u",
  kind: "replace",
  createdAt: 1,
  status: "queued",
  progress: 0,
  mode: "cut",
  source: new Blob(),
  garmentId: "g1",
  ...extra,
});

describe("pendingReplaceOf", () => {
  it("el cambio de foto más reciente sin subir de esa prenda", () => {
    const items = [
      item("old", { createdAt: 1 }),
      item("new", { createdAt: 5 }),
      item("done", { createdAt: 9, uploaded: true }),
      item("other", { createdAt: 10, garmentId: "g2" }),
      item("garment", { createdAt: 11, kind: "garment" }),
    ];
    expect(pendingReplaceOf(items, "g1")?.localId).toBe("new");
    expect(pendingReplaceOf(items, "g3")).toBeUndefined();
  });
});

describe("deleteNotices", () => {
  it("sin favoritos: solo que no se puede deshacer", () => {
    expect(deleteNotices({ favorites: 0, wouldEmpty: 0 })).toEqual([{ key: "irreversible" }]);
  });

  it("en favoritos que no se vacían: aparece en N y se quitará de ellos", () => {
    expect(deleteNotices({ favorites: 3, wouldEmpty: 0 })).toEqual([
      { key: "usage", count: 3 },
      { key: "kept", count: 3 },
      { key: "irreversible" },
    ]);
  });

  it("alguno se queda vacío: avisa de que también se eliminará", () => {
    expect(deleteNotices({ favorites: 2, wouldEmpty: 1 })).toEqual([
      { key: "usage", count: 2 },
      { key: "empty", count: 1 },
      { key: "irreversible" },
    ]);
  });
});

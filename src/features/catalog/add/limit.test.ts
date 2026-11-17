import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/features/queue/types";
import { localPendingGarments, roomLeft } from "./limit";

const item = (over: Partial<QueueItem>) => ({ kind: "garment", ...over }) as QueueItem;

describe("límite de 500 (decisión 3)", () => {
  it("cuenta como pendientes solo las prendas nuevas aún no subidas", () => {
    const items = [
      item({}),
      item({ needsReview: true }),
      item({ uploaded: true }),
      item({ kind: "replace" }),
      item({ kind: "batch" }),
    ];
    expect(localPendingGarments(items)).toBe(2);
  });

  it("sitio libre = límite − servidor − pendientes, nunca negativo", () => {
    expect(roomLeft(497, 2)).toBe(1);
    expect(roomLeft(498, 2)).toBe(0);
    expect(roomLeft(500, 3)).toBe(0);
    expect(roomLeft(0, 0)).toBe(500);
  });
});

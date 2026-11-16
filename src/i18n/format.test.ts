import { describe, expect, it } from "vitest";
import { formatShortDate } from "./format";

describe("formatShortDate", () => {
  const date = new Date("2026-11-14T10:00:00Z");

  it("castellano: 14 nov 2026", () => {
    expect(formatShortDate(date, "es")).toBe("14 nov 2026");
  });

  it("inglés: Nov 14, 2026", () => {
    expect(formatShortDate(date, "en")).toBe("Nov 14, 2026");
  });

  it("usa la zona horaria de la app (Europe/Madrid)", () => {
    // 23:30 UTC del 14 ya es día 15 en Madrid.
    expect(formatShortDate("2026-11-14T23:30:00Z", "es")).toBe("15 nov 2026");
    expect(formatShortDate("2026-11-14T23:30:00Z", "es", "UTC")).toBe("14 nov 2026");
  });
});

import { describe, expect, it } from "vitest";
import { canSubmitEmail, waitlistBodySchema } from "./email";

describe("waitlistBodySchema", () => {
  it("recorta y conserva mayúsculas", () => {
    expect(waitlistBodySchema.parse({ email: "  Ana@Example.com " })).toEqual({
      email: "Ana@Example.com",
    });
  });

  it.each(["", "ana", "ana@", "@example.com", "ana @example.com"])("rechaza %j", (email) => {
    expect(waitlistBodySchema.safeParse({ email }).success).toBe(false);
  });

  it("rechaza campos de más y emails demasiado largos", () => {
    expect(waitlistBodySchema.safeParse({ email: "a@b.co", x: 1 }).success).toBe(false);
    expect(waitlistBodySchema.safeParse({ email: `${"a".repeat(250)}@b.co` }).success).toBe(false);
  });
});

describe("canSubmitEmail", () => {
  it("exige una @", () => {
    expect(canSubmitEmail("ana")).toBe(false);
    expect(canSubmitEmail("ana@")).toBe(true);
  });
});

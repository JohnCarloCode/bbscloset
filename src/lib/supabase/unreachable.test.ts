import { describe, expect, it } from "vitest";
import { isSupabaseUnreachable } from "./unreachable";

describe("isSupabaseUnreachable", () => {
  it("auth-js: AuthRetryableFetchError", () => {
    const err = Object.assign(new Error("fetch failed"), {
      name: "AuthRetryableFetchError",
      status: 0,
    });
    expect(isSupabaseUnreachable(err)).toBe(true);
  });

  it("postgrest-js: objeto con el mensaje del fetch y code vacío", () => {
    expect(
      isSupabaseUnreachable({
        message: "TypeError: fetch failed",
        details: "",
        hint: "",
        code: "",
      }),
    ).toBe(true);
    expect(
      isSupabaseUnreachable({
        message: "TimeoutError: The operation was aborted due to timeout",
        code: "",
      }),
    ).toBe(true);
  });

  it("fetch de Node sin respuesta (TypeError con causa ECONNREFUSED)", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:55621"), {
      code: "ECONNREFUSED",
    });
    expect(isSupabaseUnreachable(new TypeError("fetch failed", { cause }))).toBe(true);
  });

  it("storage-js: StorageUnknownError con el error del fetch dentro", () => {
    const err = Object.assign(new Error("fetch failed"), {
      name: "StorageUnknownError",
      originalError: new TypeError("fetch failed"),
    });
    expect(isSupabaseUnreachable(err)).toBe(true);
  });

  it("tiempo agotado (DOMException TimeoutError)", () => {
    expect(isSupabaseUnreachable(new DOMException("timeout", "TimeoutError"))).toBe(true);
  });

  it("pasarela caída: 502/503/504/52x/540", () => {
    for (const status of [502, 503, 504, 522, 540]) {
      expect(isSupabaseUnreachable({ name: "StorageApiError", message: "x", status })).toBe(true);
    }
  });

  it("errores normales de la BD o de la API no cuentan", () => {
    expect(isSupabaseUnreachable({ message: "duplicate key", code: "23505" })).toBe(false);
    expect(isSupabaseUnreachable({ message: "JWT expired", code: "PGRST301" })).toBe(false);
    expect(isSupabaseUnreachable({ name: "StorageApiError", message: "x", status: 400 })).toBe(
      false,
    );
    expect(isSupabaseUnreachable(new Error("boom"))).toBe(false);
    expect(isSupabaseUnreachable(null)).toBe(false);
    expect(isSupabaseUnreachable("fetch failed")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  isRecoveryClaims,
  parseRecoveryLink,
  stripRecoveryParams,
  validateNewPassword,
} from "./recovery";

const base = "http://localhost:3100/reset-password";

describe("parseRecoveryLink", () => {
  it("token_hash de recuperación", () => {
    expect(parseRecoveryLink(`${base}?token_hash=abc&type=recovery`)).toEqual({
      kind: "tokenHash",
      tokenHash: "abc",
    });
  });
  it("token_hash de otro tipo no vale", () => {
    expect(parseRecoveryLink(`${base}?token_hash=abc&type=signup`)).toEqual({ kind: "error" });
  });
  it("código PKCE", () => {
    expect(parseRecoveryLink(`${base}?code=xyz`)).toEqual({ kind: "code" });
  });
  it("errores en la query o en el hash", () => {
    expect(parseRecoveryLink(`${base}?error=access_denied&error_code=otp_expired`).kind).toBe(
      "error",
    );
    expect(parseRecoveryLink(`${base}#error=access_denied&error_code=otp_expired`).kind).toBe(
      "error",
    );
  });
  it("sin parámetros", () => {
    expect(parseRecoveryLink(base)).toEqual({ kind: "none" });
  });
});

describe("stripRecoveryParams", () => {
  it("quita los parámetros del enlace y el hash", () => {
    expect(stripRecoveryParams(`${base}?token_hash=a&type=recovery&x=1#error=y`)).toBe(
      "/reset-password?x=1",
    );
    expect(stripRecoveryParams(`${base}?code=a`)).toBe("/reset-password");
  });
});

describe("validateNewPassword", () => {
  it("mínimo de 6 y que coincidan", () => {
    expect(validateNewPassword("12345", "12345")).toEqual({ password: "tooShort" });
    expect(validateNewPassword("123456", "123457")).toEqual({ confirm: "mismatch" });
    expect(validateNewPassword("123456", "123456")).toEqual({});
  });
});

describe("isRecoveryClaims", () => {
  it("acepta otp y recovery, no password", () => {
    expect(isRecoveryClaims({ amr: [{ method: "otp", timestamp: 1 }] })).toBe(true);
    expect(isRecoveryClaims({ amr: [{ method: "recovery", timestamp: 1 }] })).toBe(true);
    expect(isRecoveryClaims({ amr: [{ method: "password", timestamp: 1 }] })).toBe(false);
    expect(isRecoveryClaims(null)).toBe(false);
  });
});

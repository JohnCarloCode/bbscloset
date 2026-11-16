import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("deja pasar hasta el límite y corta el siguiente", () => {
    const rl = createRateLimiter({ limit: 5, windowMs: 60_000, now: () => 0 });
    const results = Array.from({ length: 6 }, () => rl.hit("1.2.3.4"));
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("cuenta cada clave por separado", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    expect(rl.hit("a")).toBe(true);
    expect(rl.hit("b")).toBe(true);
    expect(rl.hit("a")).toBe(false);
  });

  it("vuelve a abrir al pasar la ventana", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.hit("a")).toBe(true);
    expect(rl.hit("a")).toBe(false);
    t = 60_000;
    expect(rl.hit("a")).toBe(true);
  });

  it("no crece sin límite de claves", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t, maxKeys: 3 });
    rl.hit("a");
    rl.hit("b");
    rl.hit("c");
    t = 2000;
    // Las tres ventanas han caducado: se limpian y "d" entra.
    expect(rl.hit("d")).toBe(true);
    expect(rl.hit("a")).toBe(true);
  });
});

describe("clientIp", () => {
  it("usa el primer valor de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });

  it("cae a x-real-ip y luego a unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

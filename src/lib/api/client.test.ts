import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiFetch, resetApiClientForTests } from "./client";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetApiClientForTests();
  fetchMock = vi.fn();
  assign = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { pathname: "/catalog", assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("200 → devuelve el JSON y envía el cuerpo como JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: 1 }));
    await expect(
      apiFetch("/api/me", { method: "PATCH", json: { language: "en" } }),
    ).resolves.toEqual({ ok: 1 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/me");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"language":"en"}');
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(assign).not.toHaveBeenCalled();
  });

  it("204 → undefined", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("400 con código → ApiClientError con status, code, message y details", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: { code: "invalid_body", message: "Invalid request body", details: [{ path: "n" }] },
      }),
    );
    const err = await apiFetch("/api/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({
      status: 400,
      code: "invalid_body",
      message: "Invalid request body",
      details: [{ path: "n" }],
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("error sin cuerpo JSON → code unknown", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 502, code: "unknown" });
  });

  it("401 → navega a /login?expired=1 (una sola vez) y lanza unauthorized", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(401, { error: { code: "unauthorized", message: "Authentication required" } }),
    );
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    await expect(apiFetch("/api/garments")).rejects.toMatchObject({ code: "unauthorized" });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login?expired=1");
  });

  it("401 estando ya en /login → no navega", async () => {
    vi.stubGlobal("window", { location: { pathname: "/login", assign } });
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(assign).not.toHaveBeenCalled();
  });

  it("error de red → ApiClientError network con status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await apiFetch("/api/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 0, code: "network" });
    expect(assign).not.toHaveBeenCalled();
  });

  it("fetch abortado → se relanza el AbortError", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ name: "AbortError" });
  });
});

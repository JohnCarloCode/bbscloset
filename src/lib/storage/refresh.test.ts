import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiClientForTests } from "@/lib/api/client";
import {
  refreshSignedUrl,
  resetSignedUrlRefreshForTests,
  storagePathFromSignedUrl,
} from "./refresh";

const BASE = "http://127.0.0.1:55621/storage/v1/object/sign/garments";
const UID = "11111111-1111-1111-1111-111111111111";

describe("storagePathFromSignedUrl", () => {
  it("saca la ruta de una URL firmada del bucket", () => {
    expect(storagePathFromSignedUrl(`${BASE}/${UID}/g1/thumb.webp?token=abc`)).toBe(
      `${UID}/g1/thumb.webp`,
    );
    expect(storagePathFromSignedUrl(`${BASE}/${UID}/g%201/cutout.webp?token=x`)).toBe(
      `${UID}/g 1/cutout.webp`,
    );
  });

  it("null si no es una URL firmada de prendas", () => {
    expect(storagePathFromSignedUrl(null)).toBeNull();
    expect(storagePathFromSignedUrl("blob:http://localhost/123")).toBeNull();
    expect(storagePathFromSignedUrl("http://x/storage/v1/object/sign/other/a.webp")).toBeNull();
    expect(storagePathFromSignedUrl(`${BASE}/`)).toBeNull();
  });
});

describe("refreshSignedUrl", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetApiClientForTests();
    resetSignedUrlRefreshForTests();
    fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { paths } = JSON.parse(String(init.body)) as { paths: string[] };
      return Response.json({
        urls: Object.fromEntries(
          paths.filter((p) => !p.includes("missing")).map((p) => [p, `${BASE}/${p}?token=new`]),
        ),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/catalog", assign: vi.fn() } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("junta varias imágenes en una sola petición y devuelve la URL nueva de cada una", async () => {
    const a = refreshSignedUrl(`${BASE}/${UID}/a/thumb.webp?token=old`);
    const b = refreshSignedUrl(`${BASE}/${UID}/b/thumb.webp?token=old`);
    const missing = refreshSignedUrl(`${BASE}/${UID}/missing/thumb.webp?token=old`);
    await vi.runAllTimersAsync();
    await expect(a).resolves.toBe(`${BASE}/${UID}/a/thumb.webp?token=new`);
    await expect(b).resolves.toBe(`${BASE}/${UID}/b/thumb.webp?token=new`);
    await expect(missing).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/images/sign");
  });

  it("reutiliza una URL renovada hace poco para la misma ruta", async () => {
    const first = refreshSignedUrl(`${BASE}/${UID}/a/thumb.webp?token=old`);
    await vi.runAllTimersAsync();
    await first;
    await expect(refreshSignedUrl(`${BASE}/${UID}/a/thumb.webp?token=old`)).resolves.toBe(
      `${BASE}/${UID}/a/thumb.webp?token=new`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si falla la petición o no es una URL firmada → null", async () => {
    await expect(refreshSignedUrl("blob:http://localhost/1")).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const r = refreshSignedUrl(`${BASE}/${UID}/a/thumb.webp?token=old`);
    await vi.runAllTimersAsync();
    await expect(r).resolves.toBeNull();
  });
});

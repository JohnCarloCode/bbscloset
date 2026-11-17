import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiClientForTests } from "./client";
import { getMe, invalidateMe, ME_CACHE_TTL_MS } from "./me";

const me = {
  user_id: "u1",
  language: "es",
  jewelry_max: 3,
  random_slots: [],
  created_at: "",
  email: null,
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetApiClientForTests();
  invalidateMe();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(me), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { pathname: "/dresser", assign: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMe", () => {
  it("dos llamadas seguidas → una sola petición", async () => {
    let t = 1_000;
    const now = () => t;
    const [a, b] = await Promise.all([getMe(now), getMe(now)]);
    expect(a).toEqual(me);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    t += ME_CACHE_TTL_MS; // pasada la vida de la caché, se vuelve a pedir
    await getMe(now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un fallo no se queda en caché", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getMe(() => 0)).rejects.toMatchObject({ code: "network" });
    await expect(getMe(() => 0)).resolves.toEqual(me);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidateMe → la siguiente llamada pide de nuevo", async () => {
    await getMe(() => 0);
    invalidateMe();
    await getMe(() => 0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

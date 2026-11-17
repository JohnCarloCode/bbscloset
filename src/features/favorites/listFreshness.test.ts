import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** El módulo escucha GARMENT_CHANGED_EVENT al cargarse: se importa con window. */
async function load() {
  vi.stubGlobal("window", new EventTarget());
  const freshness = await import("./listFreshness");
  const events = await import("@/features/catalog/garmentChanged");
  return { ...freshness, ...events };
}

describe("listFreshness (5.5)", () => {
  it("needsReload: nunca cargado, sin terminar, con cambios o caducado", async () => {
    const { needsReload, LIST_TTL_MS } = await load();
    const ok = { loadedAt: 1000, loadedVersion: 3, status: "ready" as const };
    expect(needsReload(ok, 3, 2000)).toBe(false);
    expect(needsReload({ ...ok, loadedAt: 0 }, 3, 2000)).toBe(true);
    expect(needsReload({ ...ok, status: "loading" }, 3, 2000)).toBe(true);
    expect(needsReload({ ...ok, status: "error" }, 3, 2000)).toBe(true);
    expect(needsReload(ok, 4, 2000)).toBe(true);
    expect(needsReload(ok, 3, 1000 + LIST_TTL_MS + 1)).toBe(true);
  });

  it("sube la versión al guardar favoritos y al borrar o editar prendas, no al archivar", async () => {
    const { favoritesVersion, markFavoritesChanged, emitGarmentChanged } = await load();
    const v0 = favoritesVersion();
    markFavoritesChanged();
    expect(favoritesVersion()).toBe(v0 + 1);
    emitGarmentChanged(["a"], "archived");
    emitGarmentChanged(["a"], "unarchived");
    expect(favoritesVersion()).toBe(v0 + 1);
    emitGarmentChanged(["a"], "deleted");
    emitGarmentChanged(["a"], "updated");
    expect(favoritesVersion()).toBe(v0 + 3);
  });
});

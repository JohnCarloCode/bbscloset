// Tests de integración de la API de favoritos (paso 5.1) contra el Supabase
// LOCAL y `npx next dev -p 3100`. Solo corren con INTEGRATION=1:
//   INTEGRATION=1 npx vitest run src/app/api/favorites
// Con `npm test` normal se saltan (no necesitan nada arrancado).
// Usan prendas existentes del usuario de prueba (scripts/seed-garments.mjs) y
// una prenda temporal propia; al acabar borran sus favoritos y esa prenda.
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Favorite, FavoriteListResponse, Garment, GarmentListResponse } from "@/lib/api/types";
import { api, createGarments, sessionCookie } from "../../../../scripts/lib/local.mjs";

const RUN = process.env.INTEGRATION === "1";
const DB_URL =
  process.env.BBS_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55622/postgres";
// Prefijo único de los nombres de esta ejecución.
const P = `it${Date.now().toString(36)}`;

function sql(query: string): string {
  return execFileSync("psql", [DB_URL, "-Atqc", query], { encoding: "utf8" }).trim();
}

const itemsCount = (favoriteId: string) =>
  Number(sql(`select count(*) from public.favorite_items where favorite_id = '${favoriteId}'`));
const favoriteExists = (id: string) =>
  sql(`select count(*) from public.favorites where id = '${id}'`) === "1";

describe.skipIf(!RUN)("API de favoritos (integración)", { timeout: 60_000 }, () => {
  let c1: string;
  let c2: string;
  // Tres prendas en uso y una archivada del usuario 1.
  let g: Garment[];
  let archived: Garment;
  let temp: Garment | undefined;
  let fav: Favorite;

  beforeAll(async () => {
    c1 = await sessionCookie(1);
    c2 = await sessionCookie(2);
    g = ((await api(c1, "/api/garments?limit=3")).body as GarmentListResponse).items;
    archived = ((await api(c1, "/api/garments?archived=true&limit=1")).body as GarmentListResponse)
      .items[0];
    expect(g).toHaveLength(3);
    expect(archived).toBeDefined();
  });

  afterAll(async () => {
    if (temp) await api(c1, `/api/garments/${temp.id}`, { method: "DELETE" });
    sql(`delete from public.favorites where name like '${P}%'`);
  });

  it("crea un favorito con 3 prendas y una posición nula; GET lo devuelve", async () => {
    const res = await api(c1, "/api/favorites", {
      method: "POST",
      json: {
        name: `${P}-a`,
        items: [
          { garment_id: g[0].id, x: 0.3, y: 0.4, scale: 0.5, rotation: 15, z: 40, locked: true },
          { garment_id: g[1].id },
          // Incompleto (falta scale): se guarda como automático.
          { garment_id: g[2].id, x: 0.7, y: 0.2, z: 70 },
        ],
      },
    });
    expect(res.status).toBe(201);
    fav = res.body as Favorite;
    expect(fav.name).toBe(`${P}-a`);
    expect(fav.items).toHaveLength(3);
    const byId = (f: Favorite, id: string) => f.items.find((i) => i.garment_id === id)!;
    expect(byId(fav, g[0].id)).toMatchObject({ x: 0.3, y: 0.4, scale: 0.5, rotation: 15, z: 40 });
    expect(byId(fav, g[1].id)).toMatchObject({ x: null, y: null, scale: null, rotation: null });
    expect(byId(fav, g[2].id)).toMatchObject({ x: null, y: null, scale: null, z: 70 });
    expect(byId(fav, g[0].id).cutoutUrl).toMatch(/^http/);
    expect(byId(fav, g[0].id).slot).toBe(g[0].slot);

    const get = await api(c1, `/api/favorites/${fav.id}`);
    expect(get.status).toBe(200);
    expect(get.body).toEqual({ ...fav, items: expect.any(Array) });
    expect((get.body as Favorite).items.map((i) => i.garment_id).sort()).toEqual(
      g.map((x) => x.id).sort(),
    );

    const list = (await api(c1, "/api/favorites")).body as FavoriteListResponse;
    const summary = list.items.find((f) => f.id === fav.id)!;
    expect(summary).toMatchObject({ name: `${P}-a`, garmentCount: 3 });
    expect(summary.items[0].thumbUrl).toMatch(/^http/);
    expect(list.total).toBeGreaterThanOrEqual(1);
  });

  it("valida el cuerpo: vacío, duplicados, fuera de rango", async () => {
    const post = (json: unknown) => api(c1, "/api/favorites", { method: "POST", json });
    for (const body of [
      { items: [] },
      { items: [{ garment_id: g[0].id }, { garment_id: g[0].id }] },
      { items: [{ garment_id: g[0].id, x: 5, y: 0, scale: 0.4 }] },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "invalid_body" } });
    }
    const unknown = await post({ items: [{ garment_id: crypto.randomUUID() }] });
    expect(unknown.status).toBe(400);
    expect(unknown.body).toMatchObject({ error: { code: "invalid_garments" } });
  });

  it("lista por created_at desc con cursor", async () => {
    const second = await api(c1, "/api/favorites", {
      method: "POST",
      json: { name: `${P}-b`, items: [{ garment_id: g[0].id }] },
    });
    expect(second.status).toBe(201);
    const page1 = (await api(c1, "/api/favorites?limit=1")).body as FavoriteListResponse;
    expect(page1.items[0].id).toBe((second.body as Favorite).id);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = (await api(c1, `/api/favorites?limit=1&cursor=${page1.nextCursor}`))
      .body as FavoriteListResponse;
    expect(page2.items[0].id).toBe(fav.id);
  });

  it("PATCH cambia nombre y posiciones y el favorito sigue existiendo", async () => {
    const res = await api(c1, `/api/favorites/${fav.id}`, {
      method: "PATCH",
      json: {
        name: `${P}-a2`,
        items: [
          { garment_id: g[2].id, x: 0.1, y: 0.2, scale: 0.3, rotation: -30, z: 99 },
          { garment_id: g[0].id },
          { garment_id: g[1].id, x: 0.5, y: 0.5, scale: 0.6 },
        ],
      },
    });
    expect(res.status).toBe(200);
    const updated = res.body as Favorite;
    expect(updated.name).toBe(`${P}-a2`);
    expect(updated.created_at).toBe(fav.created_at);
    const byId = (id: string) => updated.items.find((i) => i.garment_id === id)!;
    expect(byId(g[2].id)).toMatchObject({ x: 0.1, y: 0.2, scale: 0.3, rotation: -30, z: 99 });
    expect(byId(g[0].id)).toMatchObject({ x: null, scale: null, z: null });
    expect(byId(g[1].id)).toMatchObject({ x: 0.5, y: 0.5, scale: 0.6, rotation: 0 });
    expect(favoriteExists(fav.id)).toBe(true);
    expect(itemsCount(fav.id)).toBe(3);

    // Solo el nombre (null = sin nombre) no toca los items.
    const rename = await api(c1, `/api/favorites/${fav.id}`, {
      method: "PATCH",
      json: { name: null },
    });
    expect(rename.status).toBe(200);
    expect((rename.body as Favorite).name).toBeNull();
    expect(itemsCount(fav.id)).toBe(3);
    // Se vuelve a poner el prefijo para que afterAll lo limpie si algo falla.
    await api(c1, `/api/favorites/${fav.id}`, { method: "PATCH", json: { name: `${P}-a3` } });
  });

  it("PATCH no permite añadir ni quitar prendas", async () => {
    for (const items of [
      [{ garment_id: g[0].id }, { garment_id: g[1].id }],
      [{ garment_id: g[0].id }, { garment_id: g[1].id }, { garment_id: archived.id }],
      [
        { garment_id: g[0].id },
        { garment_id: g[1].id },
        { garment_id: g[2].id },
        { garment_id: archived.id },
      ],
    ]) {
      const res = await api(c1, `/api/favorites/${fav.id}`, { method: "PATCH", json: { items } });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "invalid_garments" } });
    }
    expect(itemsCount(fav.id)).toBe(3);
  });

  it("una prenda archivada se sigue mostrando, marcada", async () => {
    const res = await api(c1, "/api/favorites", {
      method: "POST",
      json: { name: `${P}-arch`, items: [{ garment_id: archived.id }] },
    });
    expect(res.status).toBe(201);
    expect((res.body as Favorite).items[0]).toMatchObject({ archived: true });
  });

  it("el usuario 2: 404 en favoritos del 1 y 400 con prendas del 1", async () => {
    expect((await api(c2, `/api/favorites/${fav.id}`)).status).toBe(404);
    expect(
      (await api(c2, `/api/favorites/${fav.id}`, { method: "PATCH", json: { name: "x" } })).status,
    ).toBe(404);
    expect(
      (
        await api(c2, `/api/favorites/${fav.id}`, {
          method: "PATCH",
          json: { items: g.map((x) => ({ garment_id: x.id })) },
        })
      ).status,
    ).toBe(404);
    expect((await api(c2, `/api/favorites/${fav.id}`, { method: "DELETE" })).status).toBe(404);
    const list = (await api(c2, "/api/favorites")).body as FavoriteListResponse;
    expect(list.items.some((f) => f.id === fav.id)).toBe(false);

    const res = await api(c2, "/api/favorites", {
      method: "POST",
      json: { name: `${P}-u2`, items: [{ garment_id: g[0].id }] },
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "invalid_garments" } });
    expect(favoriteExists(fav.id)).toBe(true);
  });

  it("un id mal formado o inexistente da 404", async () => {
    expect((await api(c1, "/api/favorites/nope")).status).toBe(404);
    expect((await api(c1, `/api/favorites/${crypto.randomUUID()}`)).status).toBe(404);
  });

  it("DELETE → 204 y deja favorite_items vacío para ese favorito", async () => {
    const del = await api(c1, `/api/favorites/${fav.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);
    expect(itemsCount(fav.id)).toBe(0);
    expect(favoriteExists(fav.id)).toBe(false);
    expect((await api(c1, `/api/favorites/${fav.id}`)).status).toBe(404);
    expect((await api(c1, `/api/favorites/${fav.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("borrar la única prenda de un favorito borra el favorito (trigger)", async () => {
    const [created] = (await createGarments(c1, [
      { type_id: "tshirt", name: `${P}-temp` },
    ])) as Garment[];
    temp = created;
    const res = await api(c1, "/api/favorites", {
      method: "POST",
      json: { name: `${P}-solo`, items: [{ garment_id: created.id }] },
    });
    expect(res.status).toBe(201);
    const solo = res.body as Favorite;
    expect((await api(c1, `/api/garments/${created.id}/usage`)).body).toEqual({
      favorites: 1,
      wouldEmpty: 1,
    });

    expect((await api(c1, `/api/garments/${created.id}`, { method: "DELETE" })).status).toBe(204);
    temp = undefined;
    expect(favoriteExists(solo.id)).toBe(false);
    expect((await api(c1, `/api/favorites/${solo.id}`)).status).toBe(404);
  });
});

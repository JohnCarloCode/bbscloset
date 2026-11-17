// Tests de integración de la API de prendas (paso 3.2) contra el Supabase
// LOCAL y `npx next dev -p 3100`. Solo corren con INTEGRATION=1:
//   INTEGRATION=1 npx vitest run src/app/api/garments
// Con `npm test` normal se saltan (no necesitan nada arrancado).
// Crean sus propias prendas y lo borran todo al acabar (también las filas
// falsas del límite de 500, que se insertan por SQL).
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  Garment,
  GarmentCountsResponse,
  GarmentListResponse,
  GarmentUploadsResponse,
  TagsResponse,
} from "@/lib/api/types";
import {
  api,
  createGarments,
  putSigned,
  samplePhotos,
  sessionCookie,
  TEST_USERS,
  webpFrom,
} from "../../../../scripts/lib/local.mjs";

const RUN = process.env.INTEGRATION === "1";
const DB_URL =
  process.env.BBS_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55622/postgres";
const USER_1 = TEST_USERS[1].id;
// Prefijo único de las etiquetas de esta ejecución.
const P = `it${Date.now().toString(36)}`;
const FAKE_NAME = "__integration_fake__";

function sql(query: string): string {
  return execFileSync("psql", [DB_URL, "-Atqc", query], { encoding: "utf8" }).trim();
}

function storageObjects(prefix: string): number {
  return Number(
    sql(
      `select count(*) from storage.objects where bucket_id = 'garments' and name like '${prefix}%'`,
    ),
  );
}

describe.skipIf(!RUN)("API de prendas (integración)", { timeout: 60_000 }, () => {
  let c1: string;
  let c2: string;
  // Prendas creadas: A [x, y] · B [x] · C [y, z]
  let a: Garment;
  let b: Garment;
  let c: Garment;
  const tagId = (g: Garment, name: string) =>
    g.tags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;

  beforeAll(async () => {
    c1 = await sessionCookie(1);
    c2 = await sessionCookie(2);
    [a, b, c] = await createGarments(c1, [
      { type_id: "tshirt", tags: [`${P}-x`, `${P}-y`], color_hex: "#C62828", seasons: ["summer"] },
      { type_id: "jeans", tags: [` ${P}-X `, `${P}-x`], brand: `${P}-brand` },
      { type_id: "sneakers", tags: [`${P}-y`, `${P}-z`], color_family: "multicolor" },
    ]);
  });

  afterAll(async () => {
    sql(`delete from public.garments where name = '${FAKE_NAME}'`);
    for (const g of [a, b, c]) {
      if (g) await api(c1, `/api/garments/${g.id}`, { method: "DELETE" });
    }
    sql(`delete from public.favorites where name like '${P}%'`);
    sql(`delete from public.tags where name like '${P}%'`);
  });

  it("crea con etiquetas únicas sin distinguir mayúsculas, color y hueco", () => {
    expect(a.slot).toBe("base_layer");
    expect(a.color_hex).toBe("#c62828");
    expect(a.color_family).toBe("red");
    expect(c.color_hex).toBeNull();
    expect(c.color_family).toBe("multicolor");
    expect(b.tags).toHaveLength(1);
    expect(tagId(b, `${P}-x`)).toBe(tagId(a, `${P}-x`));
    expect(a.thumbUrl).toMatch(/^http/);
    expect(a.cutoutUrl).toMatch(/^http/);
  });

  it("filtra por etiquetas con Y (y cuenta igual)", async () => {
    const x = tagId(a, `${P}-x`)!;
    const y = tagId(a, `${P}-y`)!;
    const z = tagId(c, `${P}-z`)!;
    const ids = async (qs: string) =>
      ((await api(c1, `/api/garments?${qs}`)).body as GarmentListResponse).items.map((g) => g.id);

    expect(await ids(`tags=${x},${y}`)).toEqual([a.id]);
    expect(await ids(`tags=${x}&tags=${y}`)).toEqual([a.id]);
    expect((await ids(`tags=${x}`)).sort()).toEqual([a.id, b.id].sort());
    expect(await ids(`tags=${x},${z}`)).toEqual([]);
    expect((await ids(`tags=${y}`)).sort()).toEqual([a.id, c.id].sort());
    // Combinado con hueco, tipo, color y marca.
    expect(await ids(`tags=${y}&slot=footwear`)).toEqual([c.id]);
    expect(await ids(`tags=${y}&type=tshirt,jeans`)).toEqual([a.id]);
    expect(await ids(`tags=${y}&color=multicolor`)).toEqual([c.id]);
    // Varias familias de color en O, repetidas o con comas.
    expect((await ids(`tags=${y}&color=red,multicolor`)).sort()).toEqual([a.id, c.id].sort());
    expect((await ids(`tags=${y}&color=red&color=multicolor`)).sort()).toEqual([a.id, c.id].sort());
    expect(await ids(`tags=${y}&color=white`)).toEqual([]);
    expect(await ids(`brand=${P}-brand`)).toEqual([b.id]);
    expect(await ids(`brand=${P}-brand&brand=${P}-otra`)).toEqual([b.id]);
    expect(await ids(`slot=bag&type=tshirt`)).toEqual([]);
    // Ids concretos en O (borrador del vestidor); los del usuario 2 no salen.
    expect((await ids(`id=${a.id},${c.id}`)).sort()).toEqual([a.id, c.id].sort());
    expect(await ids(`id=${a.id}&slot=footwear`)).toEqual([]);
    expect((await api(c2, `/api/garments?id=${a.id}`)).body).toMatchObject({ items: [] });

    expect((await api(c1, `/api/garments?tags=${x},${y}&count=true`)).body).toEqual({ count: 1 });
    expect((await api(c1, `/api/garments?tags=${y}&limit=0`)).body).toEqual({ count: 2 });
    const all = await api(c1, `/api/garments?tags=${y}&ids=true`);
    expect((all.body as { ids: string[] }).ids.sort()).toEqual([a.id, c.id].sort());
  });

  it("pagina con cursor", async () => {
    const y = tagId(a, `${P}-y`)!;
    const p1 = (await api(c1, `/api/garments?tags=${y}&limit=1`)).body as GarmentListResponse;
    expect(p1.items).toHaveLength(1);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await api(c1, `/api/garments?tags=${y}&limit=1&cursor=${p1.nextCursor}`))
      .body as GarmentListResponse;
    expect(p2.items).toHaveLength(1);
    expect(p2.items[0].id).not.toBe(p1.items[0].id);
    expect(p2.nextCursor).toBeNull();
    expect(p1.items[0].cutoutUrl).toBeUndefined();
  });

  it("valida los parámetros", async () => {
    for (const qs of ["limit=101", "slot=nope", "tags=no-uuid", "archived=si", "cursor=xx"]) {
      const res = await api(c1, `/api/garments?${qs}`);
      expect(res.status, qs).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "invalid_query" } });
    }
  });

  it("PATCH reemplaza etiquetas y cambia color; archive en lote; counts", async () => {
    const patched = await api(c1, `/api/garments/${b.id}`, {
      method: "PATCH",
      json: { tags: [`${P}-z`, `${P}-new`], color_hex: "#FFF", name: "  vaqueros  " },
    });
    expect(patched.status).toBe(200);
    const g = patched.body as Garment;
    expect(g.tags.map((t) => t.name).sort()).toEqual([`${P}-new`, `${P}-z`]);
    expect(g).toMatchObject({ color_hex: "#ffffff", color_family: "white", name: "vaqueros" });

    const before = (await api(c1, "/api/garments/counts")).body as GarmentCountsResponse;
    const arch = await api(c1, "/api/garments/archive", {
      method: "POST",
      json: { ids: [a.id, b.id], archived: true },
    });
    expect(arch.body).toEqual({ updated: 2 });
    const after = (await api(c1, "/api/garments/counts")).body as GarmentCountsResponse;
    expect(after.inUse).toBe(before.inUse - 2);
    expect(after.archived).toBe(before.archived + 2);
    expect(after.bySlot.base_layer).toBe(before.bySlot.base_layer - 1);
    expect(after.archivedBySlot.base_layer).toBe(before.archivedBySlot.base_layer + 1);
    expect(after.byColor.red ?? 0).toBe((before.byColor.red ?? 0) - 1);
    expect(after.byColor.white ?? 0).toBe((before.byColor.white ?? 0) - 1);
    expect(after.archivedByColor.red ?? 0).toBe((before.archivedByColor.red ?? 0) + 1);

    const archivedIds = (await api(c1, "/api/garments?archived=true&ids=true")).body as {
      ids: string[];
    };
    expect(archivedIds.ids).toEqual(expect.arrayContaining([a.id, b.id]));
    await api(c1, "/api/garments/archive", {
      method: "POST",
      json: { ids: [a.id, b.id], archived: false },
    });

    const tags = (await api(c1, "/api/tags")).body as TagsResponse;
    expect(tags.tags.find((t) => t.name === `${P}-x`)?.count).toBe(1);
    expect(tags.tags.find((t) => t.name === `${P}-y`)?.count).toBe(2);
    const brands = (await api(c1, `/api/brands?q=${P}`)).body as { brands: string[] };
    expect(brands.brands).toEqual([`${P}-brand`]);
  });

  it("RLS: el usuario 2 no ve ni toca las prendas del 1 (404)", async () => {
    for (const [method, path] of [
      ["GET", `/api/garments/${a.id}`],
      ["PATCH", `/api/garments/${a.id}`],
      ["DELETE", `/api/garments/${a.id}`],
      ["GET", `/api/garments/${a.id}/usage`],
      ["POST", `/api/garments/${a.id}/image`],
    ] as const) {
      const res = await api(c2, path, {
        method,
        json: method === "PATCH" ? { name: "mío" } : method === "POST" ? {} : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const list = (await api(c2, "/api/garments?ids=true")).body as { ids: string[] };
    expect(list.ids).not.toContain(a.id);
    const arch = await api(c2, "/api/garments/archive", {
      method: "POST",
      json: { ids: [a.id], archived: true },
    });
    expect(arch.body).toEqual({ updated: 0 });
    // Sigue intacta para su dueña.
    expect((await api(c1, `/api/garments/${a.id}`)).status).toBe(200);
    expect(storageObjects(`${USER_1}/${a.id}/`)).toBe(2);
    // Un id que no es uuid también es 404.
    expect((await api(c1, "/api/garments/nope")).status).toBe(404);
  });

  it("POST sin haber subido los archivos → 409 upload_missing", async () => {
    const res = await api(c1, "/api/garments/uploads", { method: "POST", json: { count: 1 } });
    const { id } = (res.body as GarmentUploadsResponse).uploads[0];
    const create = await api(c1, "/api/garments", { method: "POST", json: { id, type_id: "top" } });
    expect(create.status).toBe(409);
    expect(create.body).toMatchObject({ error: { code: "upload_missing" } });
    // Repetir con un id que ya es prenda → 409 conflict y sus archivos siguen.
    const dup = await api(c1, "/api/garments", {
      method: "POST",
      json: { id: a.id, type_id: "top" },
    });
    expect(dup.body).toMatchObject({ error: { code: "conflict" } });
    expect(storageObjects(`${USER_1}/${a.id}/`)).toBe(2);
  });

  it("cambiar la foto: URLs con upsert y confirmación", async () => {
    const res = await api(c1, `/api/garments/${a.id}/image`, { method: "POST" });
    expect(res.status).toBe(200);
    const { cutout, thumb } = res.body as {
      cutout: { signedUrl: string };
      thumb: { signedUrl: string };
    };
    const photo = samplePhotos()[5];
    await putSigned(cutout.signedUrl, await webpFrom(photo, 500));
    await putSigned(thumb.signedUrl, await webpFrom(photo, 200));
    const confirm = await api(c1, `/api/garments/${a.id}/image`, {
      method: "POST",
      json: { confirm: true },
    });
    expect(confirm.status).toBe(200);
    expect((confirm.body as Garment).cutoutUrl).toMatch(/^http/);
    expect(storageObjects(`${USER_1}/${a.id}/`)).toBe(2);
  });

  it("usage cuenta favoritos y los que se quedarían vacíos; DELETE limpia Storage", async () => {
    // Favoritos por SQL (aún no hay API): F1 = A + C, F2 = solo A.
    sql(`
      with f1 as (insert into public.favorites (user_id, name) values ('${USER_1}', '${P}-f1') returning id),
           f2 as (insert into public.favorites (user_id, name) values ('${USER_1}', '${P}-f2') returning id)
      insert into public.favorite_items (favorite_id, garment_id, user_id)
      select id, '${a.id}'::uuid, '${USER_1}'::uuid from f1 union all
      select id, '${c.id}'::uuid, '${USER_1}'::uuid from f1 union all
      select id, '${a.id}'::uuid, '${USER_1}'::uuid from f2`);
    expect((await api(c1, `/api/garments/${a.id}/usage`)).body).toEqual({
      favorites: 2,
      wouldEmpty: 1,
    });
    expect((await api(c1, `/api/garments/${b.id}/usage`)).body).toEqual({
      favorites: 0,
      wouldEmpty: 0,
    });

    const del = await api(c1, `/api/garments/${a.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);
    expect(storageObjects(`${USER_1}/${a.id}/`)).toBe(0);
    expect((await api(c1, `/api/garments/${a.id}`)).status).toBe(404);
    expect((await api(c1, `/api/garments/${a.id}`, { method: "DELETE" })).status).toBe(404);
    // F2 se ha borrado sola (trigger de 0005); F1 sigue con C.
    expect(
      sql(
        `select string_agg(name, ',' order by name) from public.favorites where name like '${P}%'`,
      ),
    ).toBe(`${P}-f1`);
  });

  it("límite de 500 en uploads y otra vez al crear (borra los archivos)", async () => {
    const current = (await api(c1, "/api/garments/counts")).body as GarmentCountsResponse;
    const total = current.inUse + current.archived;
    // Hasta 499 con filas falsas.
    sql(`insert into public.garments (user_id, type_id, name, image_path, thumb_path)
         select '${USER_1}', 'tshirt', '${FAKE_NAME}', 'x', 'x' from generate_series(1, ${499 - total})`);

    const two = await api(c1, "/api/garments/uploads", { method: "POST", json: { count: 2 } });
    expect(two.status).toBe(409);
    expect(two.body).toMatchObject({
      error: { code: "limit_reached", details: { limit: 500, current: 499 } },
    });

    const one = await api(c1, "/api/garments/uploads", { method: "POST", json: { count: 1 } });
    expect(one.status).toBe(200);
    const slot = (one.body as GarmentUploadsResponse).uploads[0];
    const photo = samplePhotos()[0];
    await putSigned(slot.cutout.signedUrl, await webpFrom(photo, 300));
    await putSigned(slot.thumb.signedUrl, await webpFrom(photo, 100));
    expect(storageObjects(`${USER_1}/${slot.id}/`)).toBe(2);

    // Otra prenda "entra" mientras tanto: ya hay 500.
    sql(`insert into public.garments (user_id, type_id, name, image_path, thumb_path)
         values ('${USER_1}', 'tshirt', '${FAKE_NAME}', 'x', 'x')`);
    const create = await api(c1, "/api/garments", {
      method: "POST",
      json: { id: slot.id, type_id: "tshirt" },
    });
    expect(create.status).toBe(409);
    expect(create.body).toMatchObject({ error: { code: "limit_reached" } });
    expect(storageObjects(`${USER_1}/${slot.id}/`)).toBe(0);

    sql(`delete from public.garments where name = '${FAKE_NAME}'`);
  });
});

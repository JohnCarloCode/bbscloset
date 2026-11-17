// Tests de integración de la API de etiquetas (paso 7.1) contra el Supabase
// LOCAL y `npx next dev -p 3100`. Solo corren con INTEGRATION=1:
//   INTEGRATION=1 npx vitest run src/app/api/tags
// Con `npm test` normal se saltan (no necesitan nada arrancado).
// Tocan las etiquetas "curro" y "fiesta" del seed (scripts/seed-garments.mjs):
// antes guardan todas las etiquetas del usuario 1 y sus enlaces, y al acabar
// borran la prenda temporal y las dejan como estaban (mismos ids).
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Garment, GarmentListResponse, TagWithCount, TagsResponse } from "@/lib/api/types";
import { api, createGarments, sessionCookie, TEST_USERS } from "../../../../scripts/lib/local.mjs";

const RUN = process.env.INTEGRATION === "1";
const DB_URL =
  process.env.BBS_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55622/postgres";
const U1 = TEST_USERS[1].id;
const P = `it${Date.now().toString(36)}`;

function sql(query: string): string {
  return execFileSync("psql", [DB_URL, "-Atqc", query], { encoding: "utf8" }).trim();
}

const linksOf = (tagId: string) =>
  Number(sql(`select count(*) from public.garment_tags where tag_id = '${tagId}'`));

describe.skipIf(!RUN)("API de etiquetas (integración)", { timeout: 60_000 }, () => {
  let c1: string;
  let c2: string;
  let snapshot: string;
  let temp: Garment | undefined;
  let curro: TagWithCount;
  let fiesta: TagWithCount;

  const tags = async (cookie: string) =>
    ((await api(cookie, "/api/tags")).body as TagsResponse).tags;
  const byName = (list: TagWithCount[], name: string) => list.find((t) => t.name === name);

  beforeAll(async () => {
    c1 = await sessionCookie(1);
    c2 = await sessionCookie(2);
    // Foto de las etiquetas del usuario 1 y sus enlaces, para restaurarlas.
    snapshot = sql(`select json_build_object(
        'tags', coalesce((select json_agg(t) from (select id, user_id, name from public.tags where user_id = '${U1}') t), '[]'),
        'links', coalesce((select json_agg(l) from (select garment_id, tag_id, user_id from public.garment_tags where user_id = '${U1}') l), '[]'))`);
    const before = await tags(c1);
    expect(byName(before, "curro")).toBeDefined();
    expect(byName(before, "fiesta")).toBeDefined();
  });

  afterAll(async () => {
    if (temp) await api(c1, `/api/garments/${temp.id}`, { method: "DELETE" });
    if (!snapshot) return;
    const j = `$j$${snapshot}$j$::json`;
    sql(`begin;
      delete from public.tags where user_id = '${U1}'
        and id not in (select (x->>'id')::uuid from json_array_elements((${j})->'tags') x);
      insert into public.tags (id, user_id, name)
        select (x->>'id')::uuid, (x->>'user_id')::uuid, x->>'name' from json_array_elements((${j})->'tags') x
        on conflict (id) do update set name = excluded.name;
      insert into public.garment_tags (garment_id, tag_id, user_id)
        select (x->>'garment_id')::uuid, (x->>'tag_id')::uuid, (x->>'user_id')::uuid
        from json_array_elements((${j})->'links') x
        where exists (select 1 from public.garments g where g.id = (x->>'garment_id')::uuid)
        on conflict do nothing;
      commit;`);
  });

  it("crea una prenda temporal con 'curro' y 'fiesta' (reutiliza las existentes)", async () => {
    const before = await tags(c1);
    [temp] = (await createGarments(c1, [
      { type_id: "tshirt", name: `${P}-temp`, tags: ["Curro", "fiesta"] },
    ])) as Garment[];
    expect(temp.tags.map((t) => t.name).sort()).toEqual(["curro", "fiesta"]);
    const after = await tags(c1);
    curro = byName(after, "curro")!;
    fiesta = byName(after, "fiesta")!;
    expect(curro.count).toBe(byName(before, "curro")!.count + 1);
    expect(fiesta.count).toBe(byName(before, "fiesta")!.count + 1);
  });

  it("renombrar 'curro' → 'trabajo' cambia el nombre en todas sus prendas", async () => {
    const res = await api(c1, `/api/tags/${curro.id}`, {
      method: "PATCH",
      json: { name: "  trabajo " },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: curro.id, name: "trabajo", count: curro.count });

    // Todas las prendas (en uso y archivadas) con esa etiqueta la ven renombrada.
    let seen = 0;
    for (const archived of [false, true]) {
      const list = (await api(c1, `/api/garments?tags=${curro.id}&archived=${archived}&limit=100`))
        .body as GarmentListResponse;
      for (const g of list.items) {
        expect(g.tags.find((t) => t.id === curro.id)?.name).toBe("trabajo");
        expect(g.tags.some((t) => t.name === "curro")).toBe(false);
      }
      seen += list.items.length;
    }
    expect(seen).toBe(curro.count);
    const one = (await api(c1, `/api/garments/${temp!.id}`)).body as Garment;
    expect(one.tags.map((t) => t.name).sort()).toEqual(["fiesta", "trabajo"]);
    expect(byName(await tags(c1), "curro")).toBeUndefined();
  });

  it("renombrar 'trabajo' → 'Fiesta' choca con 'fiesta': 409 y no guarda nada", async () => {
    const res = await api(c1, `/api/tags/${curro.id}`, {
      method: "PATCH",
      json: { name: "Fiesta" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
    expect(sql(`select name from public.tags where id = '${curro.id}'`)).toBe("trabajo");
  });

  it("cambiar solo las mayúsculas de la misma etiqueta sí se permite", async () => {
    const up = await api(c1, `/api/tags/${curro.id}`, {
      method: "PATCH",
      json: { name: "Trabajo" },
    });
    expect(up.status).toBe(200);
    expect(up.body.name).toBe("Trabajo");
    const down = await api(c1, `/api/tags/${curro.id}`, {
      method: "PATCH",
      json: { name: "trabajo" },
    });
    expect(down.status).toBe(200);
    expect(down.body.name).toBe("trabajo");
  });

  it("nombre vacío o de más de 40 → 400 invalid_body", async () => {
    for (const name of ["   ", "x".repeat(41)]) {
      const res = await api(c1, `/api/tags/${curro.id}`, { method: "PATCH", json: { name } });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_body");
    }
  });

  it("el usuario 2 recibe 404 al renombrar o borrar una etiqueta ajena; también ids inexistentes", async () => {
    const patch = await api(c2, `/api/tags/${fiesta.id}`, {
      method: "PATCH",
      json: { name: `${P}` },
    });
    expect(patch.status).toBe(404);
    const del = await api(c2, `/api/tags/${fiesta.id}`, { method: "DELETE" });
    expect(del.status).toBe(404);
    expect(sql(`select name from public.tags where id = '${fiesta.id}'`)).toBe("fiesta");
    expect(linksOf(fiesta.id)).toBe(fiesta.count);

    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await api(c1, `/api/tags/${missing}`, { method: "DELETE" })).status).toBe(404);
    expect((await api(c1, "/api/tags/no-es-uuid", { method: "DELETE" })).status).toBe(404);
  });

  it("borrar 'fiesta' devuelve affected y quita sus filas de garment_tags", async () => {
    expect(linksOf(fiesta.id)).toBe(fiesta.count);
    const res = await api(c1, `/api/tags/${fiesta.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ affected: fiesta.count });
    expect(linksOf(fiesta.id)).toBe(0);
    expect(sql(`select count(*) from public.tags where id = '${fiesta.id}'`)).toBe("0");
    const one = (await api(c1, `/api/garments/${temp!.id}`)).body as Garment;
    expect(one.tags.map((t) => t.name)).toEqual(["trabajo"]);
    // Ya no existe: un segundo borrado da 404.
    expect((await api(c1, `/api/tags/${fiesta.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

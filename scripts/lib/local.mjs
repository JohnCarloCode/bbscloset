// Utilidades para scripts y tests de integración contra el Supabase LOCAL y
// el servidor de desarrollo (npx next dev -p 3100). Nunca contra el remoto:
// leen .env.development.local (local) y las contraseñas del usuario de prueba
// del comentario de supabase/seed.sql.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export const TEST_USERS = {
  1: { id: "11111111-1111-1111-1111-111111111111", email: "test@bbscloset.test" },
  2: { id: "22222222-2222-2222-2222-222222222222", email: "test2@bbscloset.test" },
};

export const BASE_URL = process.env.BBS_BASE_URL ?? "http://localhost:3100";

/** URL y clave anon del Supabase local (.env.development.local). */
export function localSupabaseEnv() {
  const text = readFileSync(join(ROOT, ".env.development.local"), "utf8");
  const get = (key) => text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Falta .env.development.local con el Supabase local");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Solo contra el Supabase local (URL: ${url})`);
  }
  return { url, anonKey };
}

/** Contraseña de un usuario de prueba, leída del comentario de supabase/seed.sql. */
function localPassword(email) {
  const seed = readFileSync(join(ROOT, "supabase/seed.sql"), "utf8");
  const after = seed.slice(seed.indexOf(`email:      ${email}`));
  const password = after.match(/contraseña:\s*(\S+)/)?.[1];
  if (!password) throw new Error(`No encuentro la contraseña de ${email} en seed.sql`);
  return password;
}

/**
 * Cookie de sesión (formato de @supabase/ssr) del usuario de prueba `n`
 * (1 = test@, 2 = test2@), para llamar a la API como haría el navegador.
 */
export async function sessionCookie(n = 1) {
  const { url, anonKey } = localSupabaseEnv();
  const { email } = TEST_USERS[n];
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: localPassword(email) }),
  });
  if (!res.ok) throw new Error(`Login de ${email} fallido: ${res.status}`);
  const session = await res.text();
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(session).toString("base64url")}`;
}

/**
 * Llama a la API propia con la cookie. Devuelve { status, body }.
 * @param {string} cookie
 * @param {string} path
 * @param {{ method?: string; json?: unknown }} [init]
 * @returns {Promise<{ status: number; body: any }>}
 */
export async function api(cookie, path, { method = "GET", json } = {}) {
  const headers = { Cookie: cookie };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/** Fotos de prueba (pruebas-fotos/streetwear, fuera del repo). */
export function samplePhotos() {
  const dir = join(ROOT, "pruebas-fotos/streetwear");
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/**
 * WebP pequeño (lado mayor `size`) a partir de una foto. Usa `sharp`, que
 * llega con Next.js (dependencia opcional para optimizar imágenes).
 */
export async function webpFrom(photoPath, size) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("Hace falta `sharp` (viene con next en node_modules) para generar los WebP");
  }
  return sharp(photoPath).resize(size, size, { fit: "inside" }).webp({ quality: 70 }).toBuffer();
}

/** Sube un archivo a una URL firmada de subida (lo mismo que hará el navegador). */
export async function putSigned(signedUrl, buffer) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Subida fallida (${res.status}): ${await res.text()}`);
}

/**
 * Crea `fields.length` prendas por la API: reserva ids, sube recorte y
 * miniatura generados desde las fotos de prueba y llama a POST /api/garments.
 * Devuelve las prendas creadas.
 */
export async function createGarments(cookie, fields, { photos = samplePhotos() } = {}) {
  const created = [];
  for (let start = 0; start < fields.length; start += 30) {
    const batch = fields.slice(start, start + 30);
    const reserve = await api(cookie, "/api/garments/uploads", {
      method: "POST",
      json: { count: batch.length },
    });
    if (reserve.status !== 200) {
      throw new Error(`uploads → ${reserve.status} ${JSON.stringify(reserve.body)}`);
    }
    for (const [i, slot] of reserve.body.uploads.entries()) {
      const photo = photos[(start + i) % photos.length];
      await putSigned(slot.cutout.signedUrl, await webpFrom(photo, 600));
      await putSigned(slot.thumb.signedUrl, await webpFrom(photo, 240));
      const res = await api(cookie, "/api/garments", {
        method: "POST",
        json: { id: slot.id, ...batch[i] },
      });
      if (res.status !== 201) throw new Error(`create → ${res.status} ${JSON.stringify(res.body)}`);
      created.push(res.body);
    }
  }
  return created;
}

/** Borra por la API (archivos + fila) todas las prendas del usuario. Devuelve cuántas. */
export async function deleteAllGarments(cookie) {
  let deleted = 0;
  for (const archived of [false, true]) {
    const res = await api(cookie, `/api/garments?ids=true&archived=${archived}`);
    if (res.status !== 200) throw new Error(`ids → ${res.status} ${JSON.stringify(res.body)}`);
    for (const id of res.body.ids) {
      const del = await api(cookie, `/api/garments/${id}`, { method: "DELETE" });
      if (del.status !== 204) throw new Error(`delete ${id} → ${del.status}`);
      deleted++;
    }
  }
  return deleted;
}

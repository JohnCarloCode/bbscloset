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

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    throw new Error("Hace falta `sharp` (viene con next en node_modules) para generar los WebP");
  }
}

/**
 * Quita el fondo casi liso de una foto de prueba: estima su color con los
 * píxeles del borde, rellena por inundación desde los bordes lo que se le
 * parece (distancia RGB < `tolerance`), se queda con la mayor mancha que
 * queda (fuera marcas de agua), suaviza 1 px el borde del alfa y recorta a
 * su caja con un pequeño margen. Devuelve un PNG RGBA.
 */
export async function removeBackground(photoPath, { tolerance = 36, margin = 8 } = {}) {
  const sharp = await loadSharp();
  const { data, info } = await sharp(photoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;

  // Color de fondo: mediana por canal de los píxeles del borde.
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map((c) => {
    const v = border.map((i) => data[i * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const tol2 = tolerance * tolerance;
  const isBg = (i) => {
    const dr = data[i * 4] - bg[0];
    const dg = data[i * 4 + 1] - bg[1];
    const db = data[i * 4 + 2] - bg[2];
    return dr * dr + dg * dg + db * db < tol2;
  };

  // Relleno por inundación desde el borde (0 = sin visitar, 1 = fondo).
  const mask = new Uint8Array(n);
  const stack = border.filter(isBg);
  for (const i of stack) mask[i] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < n && !mask[j] && isBg(j)) {
        mask[j] = 1;
        stack.push(j);
      }
    }
  }

  // Mayor componente conexa del primer plano (2 = elegida).
  const label = new Int32Array(n);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (mask[s] || label[s]) continue;
    next++;
    let size = 0;
    const st = [s];
    label[s] = next;
    while (st.length) {
      const i = st.pop();
      size++;
      const x = i % w;
      for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n && !mask[j] && !label[j]) {
          label[j] = next;
          st.push(j);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }

  const alpha = Buffer.alloc(n);
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let i = 0; i < n; i++) {
    if (label[i] !== best || !best) continue;
    alpha[i] = 255;
    const x = i % w;
    const y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return sharp(photoPath).png().toBuffer(); // nada que separar

  // Alfa suavizado ~1 px y unido al RGB original.
  const softAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(0.8)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const rgba = Buffer.from(data);
  for (let i = 0; i < n; i++) rgba[i * 4 + 3] = softAlpha[i];

  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({
      left,
      top,
      width: Math.min(w, x1 + margin + 1) - left,
      height: Math.min(h, y1 + margin + 1) - top,
    })
    .png()
    .toBuffer();
}

// Recortes ya calculados por foto (cada foto se repite varias veces).
const cutouts = new Map();

/**
 * WebP pequeño (lado mayor `size`) con fondo transparente a partir de una
 * foto. Usa `sharp`, que llega con Next.js (dependencia opcional para
 * optimizar imágenes).
 */
export async function webpFrom(photoPath, size) {
  const sharp = await loadSharp();
  if (!cutouts.has(photoPath)) cutouts.set(photoPath, await removeBackground(photoPath));
  return sharp(cutouts.get(photoPath))
    .resize(size, size, { fit: "inside" })
    .webp({ quality: 70, alphaQuality: 90 })
    .toBuffer();
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

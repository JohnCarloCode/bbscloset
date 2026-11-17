// URLs firmadas caducadas (1 h) en el navegador (paso 7.6). Si una imagen no
// carga, se pide una URL nueva con POST /api/images/sign y se reintenta una
// vez. La ruta de Storage ({user_id}/{id}/thumb.webp…) sale de la propia URL
// firmada (…/storage/v1/object/sign/garments/<ruta>?token=…): así ninguna
// respuesta de la API tiene que cambiar.
//
// Las peticiones se juntan: si caducan a la vez las 50 miniaturas del
// catálogo, sale una sola llamada (hasta 200 rutas, el máximo de la API).
// Cada URL nueva se recuerda un rato, para que dos pantallas con la misma
// prenda no la vuelvan a pedir.
import { apiFetch } from "@/lib/api/client";
import { GARMENTS_BUCKET } from "./sign";

const SIGN_MARKER = `/storage/v1/object/sign/${GARMENTS_BUCKET}/`;

/** Ruta en Storage de una URL firmada del bucket de prendas; null si no lo es. */
export function storagePathFromSignedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url, "http://x").pathname;
  } catch {
    return null;
  }
  const at = pathname.indexOf(SIGN_MARKER);
  if (at < 0) return null;
  const rest = pathname.slice(at + SIGN_MARKER.length);
  if (!rest) return null;
  try {
    return rest.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

/** Máximo de rutas por llamada (el de /api/images/sign). */
const MAX_PATHS = 200;
/** Espera para juntar peticiones de varias imágenes. */
const BATCH_DELAY_MS = 30;
/** Una URL renovada se reutiliza durante 50 min (caducan a la hora). */
const FRESH_MS = 50 * 60 * 1000;

type Waiter = (url: string | null) => void;

const fresh = new Map<string, { url: string; at: number }>();
let pending = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = pending;
  pending = new Map();
  const paths = [...batch.keys()];
  for (let i = 0; i < paths.length; i += MAX_PATHS) {
    const chunk = paths.slice(i, i + MAX_PATHS);
    let urls: Record<string, string> = {};
    try {
      ({ urls } = await apiFetch<{ urls: Record<string, string> }>("/api/images/sign", {
        method: "POST",
        json: { paths: chunk },
      }));
    } catch {
      // Sin red, sin sesión o sin Supabase: la imagen se queda sin pintar.
    }
    for (const path of chunk) {
      const url = urls[path] ?? null;
      if (url) fresh.set(path, { url, at: Date.now() });
      batch.get(path)?.forEach((resolve) => resolve(url));
    }
  }
}

/**
 * URL firmada nueva para la misma imagen que `url` (una que no ha cargado).
 * null si no es una URL firmada de prendas o no se ha podido renovar.
 */
export function refreshSignedUrl(url: string): Promise<string | null> {
  const path = storagePathFromSignedUrl(url);
  if (!path) return Promise.resolve(null);
  const known = fresh.get(path);
  // Una renovada hace poco y distinta de la que ha fallado: vale esa.
  if (known && known.url !== url && Date.now() - known.at < FRESH_MS) {
    return Promise.resolve(known.url);
  }
  return new Promise((resolve) => {
    const waiters = pending.get(path);
    if (waiters) waiters.push(resolve);
    else pending.set(path, [resolve]);
    timer ??= setTimeout(() => void flush(), BATCH_DELAY_MS);
  });
}

/** Solo para tests: olvida lo renovado y lo pendiente. */
export function resetSignedUrlRefreshForTests() {
  fresh.clear();
  pending = new Map();
  if (timer) clearTimeout(timer);
  timer = null;
}

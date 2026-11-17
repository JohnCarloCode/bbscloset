// Supabase no responde (paso 7.6): error de red, tiempo agotado o pasarela
// caída (p. ej. el proyecto Free pausado tras ~1 semana sin uso). Las rutas de
// /api lo convierten en 503 `service_unavailable` (with-user.ts) y el proxy no
// lo confunde con "sin sesión" (no manda al login).
//
// Cada librería de Supabase envuelve el fallo a su manera:
// - auth-js: AuthRetryableFetchError (sin respuesta o 5xx/52x).
// - postgrest-js: objeto { message: "TypeError: fetch failed", code: "" } o
//   "AbortError: …"/"TimeoutError: …" si se agota el tiempo.
// - storage-js: StorageUnknownError con `originalError` (el error del fetch)
//   o StorageApiError con `status` 5xx.

/** Tiempo máximo de cada llamada del servidor a Supabase. */
export const SUPABASE_TIMEOUT_MS = 10_000;

/** Respuestas de pasarela: el servicio de detrás no está (502/503/504, 52x de Cloudflare, 540). */
function isGatewayStatus(status: unknown): boolean {
  return (
    typeof status === "number" &&
    (status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 540))
  );
}

// Mensajes de fetch sin respuesta (undici en Node, navegadores) y de corte por tiempo.
const NETWORK_MESSAGE =
  /^(TypeError: )?(fetch failed|Failed to fetch|NetworkError|Load failed)|^(AbortError|TimeoutError)\b|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT/;

const NETWORK_ERROR_NAMES = new Set(["AuthRetryableFetchError", "TimeoutError", "AbortError"]);

/** ¿El error dice que no se ha podido hablar con Supabase? */
export function isSupabaseUnreachable(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 3) return false;
  const e = err as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    code?: unknown;
    cause?: unknown;
    originalError?: unknown;
  };
  if (typeof e.name === "string" && NETWORK_ERROR_NAMES.has(e.name)) return true;
  if (e.name === "TypeError" && typeof e.message === "string" && NETWORK_MESSAGE.test(e.message))
    return true;
  // Objeto de error de postgrest-js (sin `name`): el mensaje lleva el del fetch.
  if (typeof e.message === "string" && e.code === "" && NETWORK_MESSAGE.test(e.message))
    return true;
  if (typeof e.code === "string" && NETWORK_MESSAGE.test(e.code)) return true;
  if (isGatewayStatus(e.status) || isGatewayStatus(Number(e.status))) return true;
  return (
    isSupabaseUnreachable(e.cause, depth + 1) || isSupabaseUnreachable(e.originalError, depth + 1)
  );
}

/**
 * fetch para los clientes de Supabase del servidor: corta a los
 * SUPABASE_TIMEOUT_MS (un proyecto que no contesta no deja la petición
 * colgada) y respeta la señal que ya traiga la llamada.
 */
export const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

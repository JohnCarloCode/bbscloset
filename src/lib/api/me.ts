// GET /api/me compartido (paso 7.6): al entrar lo piden a la vez la cola de
// recorte (QueueProvider) y el vestidor (y Ajustes); con esta caché de la
// promesa, unos segundos, sale una sola petición. Un fallo no se guarda (el
// siguiente intento vuelve a pedir) y los PATCH de /api/me la invalidan.
import { apiFetch } from "./client";
import type { Me } from "./types";

/** Vida de la promesa compartida: lo justo para juntar las peticiones del arranque. */
export const ME_CACHE_TTL_MS = 5_000;

let cached: { at: number; promise: Promise<Me> } | null = null;

export function getMe(now: () => number = Date.now): Promise<Me> {
  if (cached && now() - cached.at < ME_CACHE_TTL_MS) return cached.promise;
  const entry = { at: now(), promise: apiFetch<Me>("/api/me") };
  cached = entry;
  entry.promise.catch(() => {
    if (cached === entry) cached = null;
  });
  return entry.promise;
}

/** Olvida la respuesta compartida (tras cambiar el perfil, o en tests). */
export function invalidateMe(): void {
  cached = null;
}

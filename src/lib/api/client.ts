// Cliente de la API para el navegador: todas las pantallas llaman a /api con
// apiFetch. Envía y recibe JSON y convierte cualquier fallo en ApiClientError:
//   - respuesta con error → { status, code, message } de { error: { … } };
//   - 401 → la sesión ha caducado: navega a /login?expired=1 (el login enseña
//     un toast) y lanza el error con code "unauthorized" (la UI no debe
//     enseñar nada más: la página se va);
//   - sin red → status 0 y code "network".
// Un fetch abortado (AbortController) se relanza tal cual.
import type { ApiErrorCode } from "./errors";

/** Marca en la URL del login para avisar de que la sesión ha caducado. */
export const SESSION_EXPIRED_PARAM = "expired";

export type ApiClientErrorCode = ApiErrorCode | "network" | "unknown";

export class ApiClientError extends Error {
  constructor(
    /** Código HTTP; 0 si no hubo respuesta (sin red). */
    readonly status: number,
    readonly code: ApiClientErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}

export type ApiFetchInit = Omit<RequestInit, "body"> & {
  /** Cuerpo que se envía como JSON (añade Content-Type). */
  json?: unknown;
  /** Cuerpo sin transformar (p. ej. FormData). No se usa junto con `json`. */
  body?: BodyInit | null;
};

// Varias llamadas pueden recibir 401 a la vez: se navega solo una vez.
let redirectingToLogin = false;

function redirectToLogin() {
  if (redirectingToLogin || typeof window === "undefined") return;
  // Ya en el login (p. ej. una llamada desde allí): no hay a dónde ir.
  if (window.location.pathname === "/login") return;
  redirectingToLogin = true;
  // Navegación completa a propósito: se descarta el estado de la app.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?${SESSION_EXPIRED_PARAM}=1`);
}

/** Solo para tests: vuelve a permitir la redirección al login. */
export function resetApiClientForTests() {
  redirectingToLogin = false;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

function toError(res: Response, body: unknown): ApiClientError {
  const error = (body as { error?: unknown } | undefined)?.error;
  if (error && typeof error === "object") {
    const { code, message, details } = error as Record<string, unknown>;
    if (typeof code === "string") {
      return new ApiClientError(
        res.status,
        code as ApiErrorCode,
        typeof message === "string" ? message : res.statusText,
        details,
      );
    }
  }
  return new ApiClientError(res.status, "unknown", `HTTP ${res.status}`);
}

/**
 * Llama a la API propia (`path` relativo, p. ej. "/api/me") y devuelve el
 * JSON de la respuesta (undefined si viene vacía, p. ej. 204).
 */
export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...rest, headers, body });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError(0, "network", err instanceof Error ? err.message : "Network error");
  }

  const data = await readJson(res);
  if (res.ok) return data as T;

  if (res.status === 401) {
    redirectToLogin();
    const { message, details } = toError(res, data);
    throw new ApiClientError(401, "unauthorized", message, details);
  }
  throw toError(res, data);
}

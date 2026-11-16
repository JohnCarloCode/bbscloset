// Rate-limit básico en memoria por clave (la IP): N peticiones por ventana
// fija. Vive en la memoria de cada instancia del servidor, así que en Vercel
// es aproximado (cada función tiene su propio contador); basta para frenar
// abusos simples en el plan Hobby sin añadir servicios.

export type RateLimiter = {
  /** Cuenta un intento de `key`; devuelve false si ya ha pasado del límite. */
  hit(key: string): boolean;
  /** Solo para tests. */
  reset(): void;
};

export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  /** Reloj inyectable para los tests. */
  now?: () => number;
  /** A partir de cuántas claves se limpian las ventanas caducadas. */
  maxKeys?: number;
};

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = 10_000,
}: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  function prune(t: number) {
    for (const [key, w] of windows) {
      if (t - w.start >= windowMs) windows.delete(key);
    }
    // Si aun así hay demasiadas claves, se vacía: mejor perder contadores
    // que dejar crecer la memoria sin límite.
    if (windows.size >= maxKeys) windows.clear();
  }

  return {
    hit(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        if (!w && windows.size >= maxKeys) prune(t);
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= limit;
    },
    reset() {
      windows.clear();
    },
  };
}

/**
 * IP del cliente para el rate-limit. En Vercel, `x-forwarded-for` la pone la
 * propia plataforma (el primer valor es el cliente); en local puede faltar.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

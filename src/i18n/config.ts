// Configuración de idiomas sin prefijo en la URL (doc-ai/plan.md 1.3).
// El idioma sale de la cookie `locale`; si no hay, del idioma principal del
// navegador (Accept-Language) cuando es es/en; en cualquier otro caso, es.
// Este archivo no importa nada de servidor: lo usan también el cliente y los tests.

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

/** Nombre de la cookie que guarda el idioma elegido. */
export const LOCALE_COOKIE = "locale";

/** Un año: el idioma se recuerda entre visitas. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Opciones con las que se escribe la cookie `locale` (server action y API). */
export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: LOCALE_COOKIE_MAX_AGE,
  sameSite: "lax",
} as const;

/** Zona horaria para formatear fechas igual en servidor y cliente. */
export const timeZone = "Europe/Madrid";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * Idioma principal de una cabecera Accept-Language (el de mayor q), solo
 * la parte de idioma y en minúsculas: "en-US,es;q=0.8" → "en".
 */
export function primaryLanguage(acceptLanguage: string | null | undefined): string | null {
  if (!acceptLanguage) return null;
  let best: { lang: string; q: number } | null = null;
  for (const part of acceptLanguage.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    if (!tag || tag === "*") continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) continue;
    // Ante empate gana el primero de la lista.
    if (!best || q > best.q) best = { lang: tag.split("-")[0].toLowerCase(), q };
  }
  return best?.lang ?? null;
}

/** Decide el idioma: cookie válida > idioma principal del navegador si es es/en > es. */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const lang = primaryLanguage(acceptLanguage);
  return isLocale(lang) ? lang : defaultLocale;
}

/**
 * Script en línea para <head>: pone <html lang> antes del primer pintado con
 * la misma regla que el servidor (cookie > navigator.language > es). Así el
 * layout raíz no lee cookies y su cascarón sigue siendo estático
 * (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
 */
export const localeDetectScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/),l=m&&decodeURIComponent(m[1]);if(l!=="es"&&l!=="en"){var n=((navigator.languages&&navigator.languages[0])||navigator.language||"").split("-")[0].toLowerCase();l=n==="en"||n==="es"?n:"${defaultLocale}"}document.documentElement.lang=l}catch(e){}})()`;

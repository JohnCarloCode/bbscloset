"use server";

// Fija el idioma en la cookie `locale`. Lo usan el conmutador de idioma
// (Ajustes, paso 7.2) y el login al leer profiles.language (paso 2.1).
// Al cambiar una cookie en una server action, Next vuelve a renderizar la ruta.
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, type Locale } from "./config";

export async function setLocaleCookie(locale: Locale): Promise<void> {
  // Llega del cliente: se valida aunque el tipo diga Locale.
  if (!isLocale(locale)) throw new Error(`Idioma no soportado: ${String(locale)}`);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
}

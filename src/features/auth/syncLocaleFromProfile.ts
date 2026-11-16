// Copia profiles.language a la cookie `locale` tras entrar (login o contraseña
// nueva). Si falla, se sigue con el idioma actual: no bloquea la entrada.
import { setLocaleCookie } from "@/i18n/actions";
import { isLocale } from "@/i18n/config";

export async function syncLocaleFromProfile(): Promise<void> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return;
    const profile: { language?: unknown } = await res.json();
    if (isLocale(profile.language)) await setLocaleCookie(profile.language);
  } catch {
    // Sin idioma del perfil no se bloquea la entrada.
  }
}

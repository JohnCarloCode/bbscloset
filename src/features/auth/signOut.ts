// Cerrar sesión (screens.md 12, Cuenta). Lo usa Ajustes (paso 7.2).
// signOut del cliente de navegador: revoca la sesión en Supabase y borra las
// cookies `sb-…` (las escribe el propio cliente con document.cookie). Si no
// hay red, signOut devuelve error sin borrar nada, así que se repite en modo
// `local`, que no llama al servidor y solo borra la sesión del dispositivo.
// La cookie `locale` se conserva: es una preferencia del dispositivo.
import { createClient } from "@/lib/supabase/browser";

export async function signOut(): Promise<void> {
  const auth = createClient().auth;
  try {
    const { error } = await auth.signOut();
    if (error) await auth.signOut({ scope: "local" });
  } catch {
    await auth.signOut({ scope: "local" }).catch(() => {});
  }
  // Navegación completa: el servidor deja de ver la sesión y se descarta el
  // estado en memoria de la app.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

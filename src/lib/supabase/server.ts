// Cliente de Supabase para el servidor (rutas de /api, páginas, server actions).
// Usa las cookies de la petición: habla con Supabase con la sesión del usuario
// y la RLS aplica. Crear uno por petición; nunca compartirlo entre peticiones.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./types";
import { fetchWithTimeout } from "./unreachable";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    // Con tiempo máximo: un Supabase que no contesta da 503, no una espera eterna.
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No pasa
          // nada: el proxy (src/proxy.ts) ya refresca la sesión en cada petición.
        }
      },
    },
  });
}

// Cliente de Supabase para el navegador. Solo para auth (login, logout,
// contraseña) y para subir archivos a URLs firmadas: los datos van por /api.
// Guarda la sesión en cookies, que el servidor lee con server.ts.
import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./types";

export function createClient() {
  // createBrowserClient ya reutiliza una única instancia en el navegador.
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}

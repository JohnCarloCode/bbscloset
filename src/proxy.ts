// Proxy (antes "middleware") de Next.js 16: refresca la sesión de Supabase en
// cada petición y corta el paso sin sesión. Es solo la primera barrera: cada
// ruta de /api vuelve a comprobar el usuario y la RLS hace el resto.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

// Rutas abiertas sin sesión (con sus subrutas). Todo lo demás exige sesión,
// así que una pantalla nueva de la app nace protegida.
const PUBLIC_PATHS = [
  "/login",
  "/waitlist",
  "/reset-password",
  "/api/waitlist",
  "/dev", // Páginas temporales de desarrollo; se borran en el paso 7.5.
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // La petición que sigue hacia la página/API ve las cookies nuevas,
        // y la respuesta las devuelve al navegador.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cabeceras anti-caché: una respuesta con la sesión no debe cachearse.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No meter código entre createServerClient y getClaims: getClaims valida el
  // JWT (y lo renueva si ha caducado), que es lo que refresca la sesión.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  if (signedIn || isPublicPath(pathname)) return response;

  const denied = pathname.startsWith("/api/")
    ? NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 },
      )
    : NextResponse.redirect(new URL("/login", request.url));

  // Conserva las cookies que haya escrito Supabase (p. ej. borrar una sesión caducada).
  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  return denied;
}

export const config = {
  // Fuera: recursos de Next, manifest, iconos y archivos estáticos con extensión.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};

// Proxy (antes "middleware") de Next.js 16: refresca la sesión de Supabase en
// cada petición y corta el paso sin sesión. Es solo la primera barrera: cada
// ruta de /api vuelve a comprobar el usuario y la RLS hace el resto.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";
import { fetchWithTimeout, isSupabaseUnreachable } from "@/lib/supabase/unreachable";

// Rutas abiertas sin sesión (con sus subrutas). Todo lo demás exige sesión,
// así que una pantalla nueva de la app nace protegida.
const PUBLIC_PATHS = ["/login", "/waitlist", "/reset-password", "/api/waitlist"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    global: { fetch: fetchWithTimeout },
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
  const { data, error } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;

  // Supabase no responde (p. ej. proyecto pausado, 7.6) y hay cookie de
  // sesión: no se puede saber si vale, así que no se manda al login. La API
  // contesta 503 y las pantallas enseñan "No se puede conectar" con reintento.
  if (!signedIn && error && isSupabaseUnreachable(error) && hasSessionCookie(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "service_unavailable", message: "Supabase is unreachable" } },
        { status: 503 },
      );
    }
    return response;
  }

  // Con sesión, el login no tiene sentido: directo al Vestidor. Solo al pedir
  // la página (GET/HEAD): el formulario, ya con sesión, llama a la server
  // action setLocaleCookie con un POST a /login que no se debe desviar.
  const isPageRequest = request.method === "GET" || request.method === "HEAD";
  if (signedIn && pathname === "/login" && isPageRequest) {
    return withSupabaseCookies(NextResponse.redirect(new URL("/dresser", request.url)), response);
  }
  if (signedIn || isPublicPath(pathname)) return response;

  const denied = pathname.startsWith("/api/")
    ? NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 },
      )
    : NextResponse.redirect(new URL("/login", request.url));

  return withSupabaseCookies(denied, response);
}

/** Cookie de sesión de Supabase (`sb-<ref>-auth-token`, quizá en trozos `.0`, `.1`…). */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
}

/**
 * Copia a una respuesta nueva las cookies que haya escrito Supabase en
 * `response` (sesión renovada o borrado de una sesión caducada).
 */
function withSupabaseCookies(target: NextResponse, response: NextResponse): NextResponse {
  response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export const config = {
  // Fuera: recursos de Next, manifest, iconos y archivos estáticos con extensión.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};

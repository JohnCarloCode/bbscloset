// Envoltorio común de las rutas de /api: crea el cliente de Supabase con la
// sesión de la petición, exige usuario (o 401) y captura excepciones (500
// `internal` sin detalles; ApiError → su respuesta).
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, apiError } from "./errors";

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type ApiUser = { id: string; email?: string };

export type ApiContext<P> = {
  supabase: ServerSupabase;
  user: ApiUser;
  request: NextRequest;
  /** Parámetros dinámicos de la ruta, ya resueltos (en Next 16 llegan como Promise). */
  params: P;
};

// Segundo argumento de un Route Handler de Next 16: `params` es una Promise.
type RouteSegment<P> = { params: Promise<P> };

export function withUser<P extends Record<string, string | string[]> = Record<string, never>>(
  handler: (ctx: ApiContext<P>) => Promise<Response>,
) {
  return async (request: NextRequest, segment: RouteSegment<P>): Promise<Response> => {
    try {
      const supabase = await createClient();

      // getClaims valida el JWT de la sesión (el proxy ya lo ha refrescado).
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (!claims?.sub) return apiError(401, "unauthorized", "Authentication required");

      const params = ((await segment?.params) ?? {}) as P;
      const user: ApiUser = { id: claims.sub, email: claims.email };
      return await handler({ supabase, user, request, params });
    } catch (err) {
      if (err instanceof ApiError) return err.toResponse();
      console.error("[api] unhandled error", request.method, request.nextUrl.pathname, err);
      return apiError(500, "internal", "Internal server error");
    }
  };
}

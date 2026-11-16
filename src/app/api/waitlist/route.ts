// POST /api/waitlist: apunta un email a la lista de espera (pública, sin
// sesión; el proxy la deja pasar). No envía ningún correo (spec 3.8).
//   200 { ok: true } → apuntado, o ya lo estaba (no se revela quién está).
//   400 invalid_body · 413 payload_too_large · 429 rate_limited · 500 internal.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ApiError, apiError, parseBody } from "@/lib/api";
import { clientIp, createRateLimiter } from "@/lib/api/rateLimit";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";
import { waitlistBodySchema } from "@/features/waitlist/email";

/** El cuerpo es solo { email }: 1 KB sobra. */
const MAX_BODY_BYTES = 1024;

// 5 intentos por minuto e IP (en memoria de cada instancia; ver rateLimit.ts).
const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

// Violación de un índice único en Postgres: el email ya estaba apuntado.
const UNIQUE_VIOLATION = "23505";

export async function POST(request: NextRequest) {
  if (!limiter.hit(clientIp(request.headers))) {
    return apiError(429, "rate_limited", "Too many requests");
  }

  try {
    const { email } = await parseBody(request, waitlistBodySchema, { maxBytes: MAX_BODY_BYTES });

    // Cliente anónimo sin sesión ni cookies: la RLS de anon solo permite
    // insertar. Sin .select(): devolver la fila exigiría permiso de lectura.
    const supabase = createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await supabase.from("waitlist").insert({ email });

    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("[api] waitlist insert failed", error.code, error.message);
      return apiError(500, "internal", "Internal server error");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return err.toResponse();
    console.error("[api] unhandled error", request.method, request.nextUrl.pathname, err);
    return apiError(500, "internal", "Internal server error");
  }
}

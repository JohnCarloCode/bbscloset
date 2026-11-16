// /api/me: perfil del usuario de la sesión.
//   GET   → el perfil.
//   PATCH → cambia idioma, máximo de joyería y huecos del outfit aleatorio;
//           devuelve el perfil actualizado. Si cambia el idioma, fija también
//           la cookie `locale`.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/lib/api";
import { SLOT_IDS } from "@/lib/domain/slots";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, locales } from "@/i18n/config";

const PROFILE_COLUMNS = "user_id, language, jewelry_max, random_slots, created_at";

// Mismas restricciones que public.profiles (supabase/migrations/0002_user_tables.sql).
const patchSchema = z
  .strictObject({
    language: z.enum(locales).optional(),
    jewelry_max: z.int().min(1).max(10).optional(),
    random_slots: z
      .array(z.enum(SLOT_IDS))
      .refine((slots) => new Set(slots).size === slots.length, {
        message: "Duplicated slots",
      })
      .optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export const GET = withUser(async ({ supabase, user }) => {
  // La RLS ya limita profiles a la fila propia; el filtro deja clara la intención.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return apiError(404, "not_found", "Profile not found");
  return NextResponse.json(profile);
});

export const PATCH = withUser(async ({ supabase, user, request }) => {
  const changes = await parseBody(request, patchSchema);

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("user_id", user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return apiError(404, "not_found", "Profile not found");

  const response = NextResponse.json(profile);
  if (changes.language) {
    response.cookies.set(LOCALE_COOKIE, profile.language, LOCALE_COOKIE_OPTIONS);
  }
  return response;
});

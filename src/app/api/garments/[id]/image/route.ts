// POST /api/garments/[id]/image: cambiar la foto (sobrescribe recorte y
// miniatura en sus mismas rutas). Dos llamadas:
//   1. Cuerpo {} (o vacío) → { cutout, thumb }: URLs firmadas de subida con
//      upsert. El navegador sube los dos archivos con PUT.
//   2. Cuerpo { confirm: true } → comprueba que los dos archivos están y
//      devuelve la prenda (Garment) con URLs firmadas nuevas. Cada firma lleva
//      un token distinto, así que la URL cambia y el navegador no reutiliza la
//      imagen vieja de su caché (la tabla no tiene `updated_at`).
//   404 si no es una prenda propia · 409 upload_missing si falta algún archivo.
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { confirmImageReplacement, garmentId, signImageReplacement } from "@/lib/api/garments";

const bodySchema = z.strictObject({ confirm: z.boolean().optional() });

export const POST = withUser<{ id: string }>(async ({ supabase, params, request }) => {
  const id = garmentId(params);
  const hasBody = (await request.clone().text()).trim() !== "";
  const { confirm } = hasBody ? await parseBody(request, bodySchema, { maxBytes: 1024 }) : {};
  if (confirm) return NextResponse.json(await confirmImageReplacement(supabase, id));
  return NextResponse.json(await signImageReplacement(supabase, id));
});

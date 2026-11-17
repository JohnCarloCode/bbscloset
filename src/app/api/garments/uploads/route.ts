// POST /api/garments/uploads: reserva ids de prenda para subir sus fotos.
// Cuerpo { count } (1..30) → { uploads: [{ id, cutout, thumb }] }, donde
// cutout y thumb son URLs firmadas de subida (2 h) a
// {user_id}/{id}/cutout.webp y thumb.webp. El navegador sube cada archivo con
// PUT a `signedUrl` (Content-Type: image/webp) y después crea la prenda con
// POST /api/garments { id, … }. Los ids no se guardan: un id reservado y no
// usado no cuenta para nada.
//   409 limit_reached si las prendas actuales + count superan 500.
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { MAX_UPLOADS_PER_REQUEST, reserveUploads } from "@/lib/api/garments";

const bodySchema = z.strictObject({ count: z.int().min(1).max(MAX_UPLOADS_PER_REQUEST) });

export const POST = withUser(async ({ supabase, user, request }) => {
  const { count } = await parseBody(request, bodySchema, { maxBytes: 1024 });
  return NextResponse.json({ uploads: await reserveUploads(supabase, user.id, count) });
});

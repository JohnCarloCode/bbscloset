// POST /api/images/sign: URLs firmadas (1 h) de fotos del bucket `garments`,
// en lote. Cuerpo { paths: string[] } → { urls: { [path]: signedUrl } }.
// Solo se aceptan rutas de la carpeta del propio usuario ({user_id}/…): si
// llega alguna ajena, se rechaza la petición entera con 400.
// Las rutas que no existen no aparecen en `urls`.
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { createSignedUrls } from "@/lib/storage/sign";

/** Máximo de rutas por petición (una página larga del catálogo cabe de sobra). */
const MAX_PATHS = 200;

const bodySchema = z.strictObject({
  paths: z.array(z.string().min(1).max(512)).max(MAX_PATHS),
});

export const POST = withUser(async ({ supabase, user, request }) => {
  const { paths } = await parseBody(request, bodySchema);

  const prefix = `${user.id}/`;
  const foreign = paths.filter(
    (p) => !p.startsWith(prefix) || p.split("/").some((part) => part === ".." || part === "."),
  );
  if (foreign.length > 0) {
    throw new ApiError(400, "invalid_body", "Paths must be inside the user's folder", {
      paths: foreign,
    });
  }

  const urls = await createSignedUrls(supabase, [...new Set(paths)]);
  return NextResponse.json({ urls });
});

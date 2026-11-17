// /api/favorites/[id]: un favorito. Un id ajeno, inexistente o mal formado → 404.
//   GET    → el favorito con sus items: tipo, hueco, nombre, si está archivada,
//            recorte firmado y posiciones (Favorite).
//   PATCH  → { name?, items? }: nombre (null = sin nombre) y/o posiciones de
//            TODAS sus prendas (mismo formato que POST). No se pueden añadir ni
//            quitar prendas: si cambia el conjunto, 400 invalid_garments.
//            Devuelve el favorito.
//   DELETE → borra el favorito y sus items → 204.
import { NextResponse } from "next/server";
import { ApiError, parseBody, withUser } from "@/lib/api";
import {
  deleteFavorite,
  favoriteId,
  getFavorite,
  patchFavoriteSchema,
  updateFavorite,
} from "@/lib/api/favorites";

type Params = { id: string };

export const GET = withUser<Params>(async ({ supabase, params }) => {
  const favorite = await getFavorite(supabase, favoriteId(params));
  if (!favorite) throw new ApiError(404, "not_found", "Favorite not found");
  return NextResponse.json(favorite);
});

export const PATCH = withUser<Params>(async ({ supabase, params, request }) => {
  const id = favoriteId(params);
  const input = await parseBody(request, patchFavoriteSchema, { maxBytes: 32 * 1024 });
  return NextResponse.json(await updateFavorite(supabase, id, input));
});

export const DELETE = withUser<Params>(async ({ supabase, params }) => {
  await deleteFavorite(supabase, favoriteId(params));
  return new NextResponse(null, { status: 204 });
});

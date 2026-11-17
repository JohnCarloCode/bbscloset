// /api/favorites
//   GET  → favoritos por created_at desc con cursor (cursor, limit: 24; máx. 100)
//          → { items, nextCursor, total } (FavoriteListResponse). Cada favorito
//          lleva nombre, fecha, nº de prendas y sus items (tipo, hueco,
//          miniatura firmada y posiciones) para el mini collage. 400 invalid_query.
//   POST → { name?, items: [{ garment_id, x?, y?, scale?, rotation?, z?, locked? }] }
//          (1–30 items, sin prendas repetidas; x/y/scale juntos o ninguno,
//          null = colocación automática; `locked` se ignora) → 201 con el
//          favorito (Favorite). 400 invalid_body · 400 invalid_garments (prenda
//          inexistente o de otro usuario).
import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api";
import {
  createFavorite,
  createFavoriteSchema,
  listFavorites,
  parseFavoriteListQuery,
} from "@/lib/api/favorites";

export const GET = withUser(async ({ supabase, user, request }) => {
  const query = parseFavoriteListQuery(request.nextUrl.searchParams);
  return NextResponse.json(await listFavorites(supabase, user.id, query));
});

export const POST = withUser(async ({ supabase, request }) => {
  const input = await parseBody(request, createFavoriteSchema, { maxBytes: 32 * 1024 });
  const favorite = await createFavorite(supabase, input);
  return NextResponse.json(favorite, { status: 201 });
});

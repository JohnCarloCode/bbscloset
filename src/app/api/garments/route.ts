// /api/garments
//   GET  → listado del catálogo con filtros (lib/api/garments.ts, parseListQuery):
//          archived, slot, type (varios), brand (varias, en O), color (varias, en O), tags (varios, en Y),
//          cursor, limit (24; máx. 100), include=cutout.
//          · normal → { items, nextCursor } (GarmentListResponse)
//          · count=true o limit=0 → { count } (botón "Ver N prendas")
//          · ids=true → { ids } con los filtros, sin paginar ("Seleccionar todo")
//          400 invalid_query.
//   POST → crea la prenda tras subir sus archivos con /api/garments/uploads.
//          Cuerpo { id, type_id, name?, seasons?, color_hex?, color_family?
//          ("multicolor"), brand?, tags? } → 201 con la prenda (Garment).
//          400 invalid_body · 409 upload_missing (faltan archivos) ·
//          409 limit_reached (500 prendas; borra los archivos) ·
//          409 conflict (el id ya es una prenda).
import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api";
import {
  countGarments,
  createGarment,
  createGarmentSchema,
  listGarmentIds,
  listGarments,
  parseListQuery,
} from "@/lib/api/garments";

export const GET = withUser(async ({ supabase, request }) => {
  const query = parseListQuery(request.nextUrl.searchParams);
  if (query.ids) return NextResponse.json({ ids: await listGarmentIds(supabase, query) });
  if (query.count || query.limit === 0) {
    return NextResponse.json({ count: await countGarments(supabase, query) });
  }
  return NextResponse.json(await listGarments(supabase, query));
});

export const POST = withUser(async ({ supabase, user, request }) => {
  const input = await parseBody(request, createGarmentSchema, { maxBytes: 16 * 1024 });
  const garment = await createGarment(supabase, user.id, input);
  return NextResponse.json(garment, { status: 201 });
});

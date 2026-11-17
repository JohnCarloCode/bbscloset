// /api/garments/[id]: una prenda. Un id ajeno, inexistente o mal formado → 404.
//   GET    → la prenda con etiquetas y URLs firmadas de thumb y cutout.
//   PATCH  → cambia type_id, name, seasons, color (color_hex o
//            color_family "multicolor"; null en cualquiera = sin color), brand,
//            tags (reemplaza el conjunto) y archived. Devuelve la prenda.
//   DELETE → borra sus archivos de Storage y después la fila → 204.
import { NextResponse } from "next/server";
import { ApiError, parseBody, withUser } from "@/lib/api";
import {
  deleteGarment,
  garmentId,
  getGarment,
  patchGarmentSchema,
  updateGarment,
} from "@/lib/api/garments";

type Params = { id: string };

export const GET = withUser<Params>(async ({ supabase, params }) => {
  const garment = await getGarment(supabase, garmentId(params));
  if (!garment) throw new ApiError(404, "not_found", "Garment not found");
  return NextResponse.json(garment);
});

export const PATCH = withUser<Params>(async ({ supabase, params, request }) => {
  const id = garmentId(params);
  const input = await parseBody(request, patchGarmentSchema, { maxBytes: 16 * 1024 });
  return NextResponse.json(await updateGarment(supabase, id, input));
});

export const DELETE = withUser<Params>(async ({ supabase, params }) => {
  await deleteGarment(supabase, garmentId(params));
  return new NextResponse(null, { status: 204 });
});

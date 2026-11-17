// GET /api/garments/[id]/usage → { favorites, wouldEmpty } (aviso antes de
// eliminar): en cuántos favoritos aparece la prenda y cuántos de ellos solo la
// tienen a ella (se borrarían al eliminarla). 404 si no es una prenda propia.
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { garmentId, garmentUsage } from "@/lib/api/garments";

export const GET = withUser<{ id: string }>(async ({ supabase, params }) =>
  NextResponse.json(await garmentUsage(supabase, garmentId(params))),
);

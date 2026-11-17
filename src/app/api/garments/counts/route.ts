// GET /api/garments/counts → { inUse, archived, bySlot, archivedBySlot,
// byColor, archivedByColor } (GarmentCountsResponse): cabecera del catálogo
// ("58 en uso · 3 archivadas"), chips de hueco (bySlot cuenta las prendas en
// uso; archivedBySlot, las archivadas, para la vista Archivadas) y familias de
// color presentes para la hoja de filtros (byColor / archivedByColor).
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { garmentCounts } from "@/lib/api/garments";

export const GET = withUser(async ({ supabase, user }) =>
  NextResponse.json(await garmentCounts(supabase, user.id)),
);

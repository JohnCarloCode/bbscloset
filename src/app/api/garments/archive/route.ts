// POST /api/garments/archive: archivado en lote (cambio de temporada).
// Cuerpo { ids: uuid[], archived: boolean } → { updated: n } (filas afectadas;
// los ids ajenos o inexistentes se ignoran).
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { archiveGarments, MAX_ARCHIVE_IDS } from "@/lib/api/garments";

const bodySchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(MAX_ARCHIVE_IDS),
  archived: z.boolean(),
});

export const POST = withUser(async ({ supabase, request }) => {
  const { ids, archived } = await parseBody(request, bodySchema, { maxBytes: 64 * 1024 });
  return NextResponse.json({ updated: await archiveGarments(supabase, ids, archived) });
});

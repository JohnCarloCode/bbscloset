// GET /api/tags → { tags: [{ id, name, count }] }: etiquetas del usuario por
// nombre, con su número de prendas (en uso y archivadas).
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listTags } from "@/lib/api/tags";

export const GET = withUser(async ({ supabase, user }) =>
  NextResponse.json({ tags: await listTags(supabase, user.id) }),
);

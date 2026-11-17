// GET /api/brands?q= → { brands: string[] }: marcas distintas del usuario
// (autocompletado), ordenadas; con `q`, solo las que empiezan por ese texto
// (sin distinguir mayúsculas).
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listBrands } from "@/lib/api/garments";

export const GET = withUser(async ({ supabase, user, request }) => {
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 120) ?? undefined;
  return NextResponse.json({ brands: await listBrands(supabase, user.id, q) });
});

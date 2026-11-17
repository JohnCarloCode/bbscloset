// /api/tags/[id]: una etiqueta. Un id ajeno, inexistente o mal formado → 404.
//   PATCH  → { name }: renombra (recortado, 1–40 caracteres). Si otra etiqueta
//            del usuario ya se llama así sin distinguir mayúsculas → 409
//            `conflict` y no se guarda. Devuelve la etiqueta con su recuento.
//   DELETE → borra la etiqueta (y sus garment_tags) → { affected: N }, las
//            prendas que la llevaban.
import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api";
import { deleteTag, renameTag, renameTagSchema, tagId } from "@/lib/api/tags";

type Params = { id: string };

export const PATCH = withUser<Params>(async ({ supabase, params, request }) => {
  const id = tagId(params);
  const input = await parseBody(request, renameTagSchema, { maxBytes: 4 * 1024 });
  return NextResponse.json(await renameTag(supabase, id, input));
});

export const DELETE = withUser<Params>(async ({ supabase, params }) =>
  NextResponse.json(await deleteTag(supabase, tagId(params))),
);

// Consultas de etiquetas (pasos 3.2 y 7.1). Las rutas de /api/tags/** solo
// validan y llaman aquí. Todo va con el cliente del usuario: la RLS (0004)
// limita `tags` y `garment_tags` a las filas propias, así que una etiqueta
// ajena se comporta igual que una inexistente (404).
import { z } from "zod";
import { cleanTagNames } from "./garments";
import { ApiError } from "./errors";
import type { ServerSupabase } from "./with-user";
import { GARMENT_TAG_MAX, type TagDeleteResponse, type TagWithCount } from "./types";

// Violación de clave única en Postgres (tags_user_name_uniq: user_id + lower(name)).
const UNIQUE_VIOLATION = "23505";

const TAG_COLUMNS = "id, name, garment_tags(count)";

function notFound() {
  return new ApiError(404, "not_found", "Tag not found");
}

/** Id de etiqueta de la ruta (/api/tags/[id]); si no es un uuid, no existe (404). */
export function tagId(params: { id: string }): string {
  if (!z.uuid().safeParse(params.id).success) throw notFound();
  return params.id;
}

/**
 * PATCH /api/tags/[id]: `{ name }`, recortado y con los espacios internos
 * colapsados (igual que al etiquetar una prenda); de 1 a GARMENT_TAG_MAX.
 */
export const renameTagSchema = z.strictObject({
  name: z
    .string()
    .max(GARMENT_TAG_MAX * 2)
    .transform((v) => cleanTagNames([v])[0] ?? "")
    .refine((v) => v.length >= 1 && v.length <= GARMENT_TAG_MAX, {
      message: `Tag name must have 1 to ${GARMENT_TAG_MAX} characters`,
    }),
});
export type RenameTagInput = z.output<typeof renameTagSchema>;

type TagRow = { id: string; name: string; garment_tags: unknown };

function toTagWithCount(t: TagRow): TagWithCount {
  return {
    id: t.id,
    name: t.name,
    // Embebido de PostgREST con count: [{ count: N }].
    count: (t.garment_tags as { count: number }[])[0]?.count ?? 0,
  };
}

/** Etiquetas del usuario con su número de prendas (en uso y archivadas), por nombre. */
export async function listTags(supabase: ServerSupabase, userId: string): Promise<TagWithCount[]> {
  const { data, error } = await supabase.from("tags").select(TAG_COLUMNS).eq("user_id", userId);
  if (error) throw error;
  return data
    .map(toTagWithCount)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

async function getTag(supabase: ServerSupabase, id: string): Promise<TagWithCount | null> {
  const { data, error } = await supabase
    .from("tags")
    .select(TAG_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toTagWithCount(data) : null;
}

/**
 * Renombra una etiqueta (el cambio se ve en todas sus prendas, que la enlazan
 * por id). Si otra etiqueta del usuario ya se llama así sin distinguir
 * mayúsculas, 409 `conflict` y no se guarda nada (decisión 15). Cambiar solo
 * las mayúsculas de la misma etiqueta sí vale: el índice único es la misma fila.
 */
export async function renameTag(
  supabase: ServerSupabase,
  id: string,
  { name }: RenameTagInput,
): Promise<TagWithCount> {
  const { data, error } = await supabase
    .from("tags")
    .update({ name })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) {
    throw new ApiError(409, "conflict", "A tag with that name already exists");
  }
  if (error) throw error;
  if (!data) throw notFound();

  const tag = await getTag(supabase, id);
  if (!tag) throw notFound();
  return tag;
}

/**
 * Borra una etiqueta y devuelve a cuántas prendas afectaba. Sus filas de
 * garment_tags caen por `on delete cascade` (0002_user_tables.sql).
 */
export async function deleteTag(supabase: ServerSupabase, id: string): Promise<TagDeleteResponse> {
  const tag = await getTag(supabase, id);
  if (!tag) throw notFound();

  const { data, error } = await supabase.from("tags").delete().eq("id", id).select("id");
  if (error) throw error;
  // Si otra petición la ha borrado entre medias, para esta ya no existe.
  if (data.length === 0) throw notFound();
  return { affected: tag.count };
}

// Paginación por cursor (keyset) sobre (created_at, id), orden
// `created_at desc, id desc` (doc-ai/database.md: el catálogo se pagina así).
// El cursor es base64url de JSON { created_at, id } de la última fila servida.
import { z } from "zod";
import { ApiError } from "./errors";

const cursorSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(row: Cursor): string {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id })).toString(
    "base64url",
  );
}

/** Lanza ApiError 400 `invalid_query` si el cursor no es válido. */
export function decodeCursor(value: string): Cursor {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_query", "Invalid cursor");
  }
  const result = cursorSchema.safeParse(json);
  if (!result.success) throw new ApiError(400, "invalid_query", "Invalid cursor");
  return result.data;
}

/**
 * Filtro keyset para `.or()` de PostgREST: filas estrictamente posteriores al
 * cursor en orden `created_at desc, id desc`. Los valores van entre comillas
 * porque la fecha lleva `:` y `.` (caracteres reservados en los filtros).
 */
export function keysetFilter(cursor: Cursor): string {
  const at = `"${cursor.created_at}"`;
  const id = `"${cursor.id}"`;
  return `created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`;
}

/**
 * Aplica a una consulta de PostgREST el filtro del cursor (si hay) y el orden
 * `created_at desc, id desc`. El límite lo pone quien llama (pedir limit + 1
 * filas permite saber si hay página siguiente).
 */
export function applyCursor<
  Q extends { or(filters: string): Q; order(column: string, options?: { ascending?: boolean }): Q },
>(query: Q, cursor: Cursor | null): Q {
  const filtered = cursor ? query.or(keysetFilter(cursor)) : query;
  return filtered.order("created_at", { ascending: false }).order("id", { ascending: false });
}

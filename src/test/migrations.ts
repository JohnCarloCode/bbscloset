// Utilidades de test: leen las listas cerradas directamente del SQL de las
// migraciones, para comprobar que el código y los mensajes no se desvían de la
// base de datos. Solo para tests (usa node:fs).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Texto de una migración de supabase/migrations. */
export function migration(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)),
    "utf8",
  );
}

/** Filas del INSERT INTO public.<table> (...) values (...) on conflict, como arrays de valores en texto. */
export function insertedRows(sql: string, table: string): string[][] {
  const start = sql.indexOf(`insert into public.${table}`);
  if (start < 0) throw new Error(`No hay insert en public.${table}`);
  const end = sql.indexOf("on conflict", start);
  const body = sql.slice(sql.indexOf("values", start), end);
  return [...body.matchAll(/^\s*\(([^)]*)\)/gm)].map((m) =>
    m[1].split(",").map((v) => v.trim().replace(/^'(.*)'$/, "$1")),
  );
}

/** Primer valor (el id) de cada fila del INSERT INTO public.<table>. */
export function insertedIds(sql: string, table: string): string[] {
  return insertedRows(sql, table).map((row) => row[0]);
}

/** Valores de un array['a','b'] o de un in ('a','b') tras la columna indicada. */
export function checkValues(sql: string, column: string): string[] {
  const at = sql.search(new RegExp(`^\\s*${column}\\s`, "m"));
  if (at < 0) throw new Error(`No hay columna ${column}`);
  const body = sql.slice(at).match(/(?:array\[|in \()([^\])]*)/)?.[1] ?? "";
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

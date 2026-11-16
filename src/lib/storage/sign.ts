// URLs firmadas de lectura del bucket privado `garments`, en lote.
// Se firman con el cliente del usuario: la RLS de Storage (0007_storage.sql)
// solo deja firmar rutas de su propia carpeta.
import type { ServerSupabase } from "@/lib/api";

export const GARMENTS_BUCKET = "garments";

/** Caducidad de las URLs firmadas: 1 hora. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Devuelve { ruta: urlFirmada } para las rutas que se han podido firmar.
 * Las que no existen o no se pueden firmar no aparecen en el resultado.
 * Lanza si falla la llamada entera.
 */
export async function createSignedUrls(
  supabase: ServerSupabase,
  paths: readonly string[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  if (paths.length === 0) return urls;

  const { data, error } = await supabase.storage
    .from(GARMENTS_BUCKET)
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}

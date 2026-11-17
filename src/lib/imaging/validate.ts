// Validación de la foto elegida (architecture.md 4.1 paso 2; screens.md 5.1;
// decisión 12 del plan: HEIC se acepta si el navegador sabe abrirla).
import { decodeImage } from "./canvas";
import { ImagingError, type ImagingErrorCode } from "./errors";

/** Tope de tamaño de la foto original (~10 MB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Algunos navegadores dan `type` vacío para HEIC; nos fiamos de la extensión.
const HEIC_EXT = /\.(heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i;

export type FileInfo = { name: string; type: string; size: number };

export function isHeic({ name, type }: Pick<FileInfo, "name" | "type">): boolean {
  return /^image\/hei[cf]/i.test(type) || HEIC_EXT.test(name);
}

/**
 * Comprobación sin decodificar (pura): tipo `image/*` (o tipo vacío con
 * extensión de imagen) y tamaño ≤ 10 MB. Devuelve el código de error o null.
 */
export function checkFile(file: FileInfo): ImagingErrorCode | null {
  const isImage = file.type ? file.type.startsWith("image/") : IMAGE_EXT.test(file.name);
  if (!isImage) return "not_image";
  if (file.size > MAX_IMAGE_BYTES) return "too_large";
  if (file.size === 0) return "decode_failed";
  return null;
}

/**
 * Valida la foto y comprueba que el navegador sabe abrirla. Lanza
 * ImagingError (not_image, too_large, heic_unsupported, decode_failed).
 * Devuelve las dimensiones ya orientadas.
 */
export async function validate(file: File): Promise<{ width: number; height: number }> {
  const code = checkFile(file);
  if (code) throw new ImagingError(code);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch (cause) {
    throw new ImagingError(isHeic(file) ? "heic_unsupported" : "decode_failed", { cause });
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (!width || !height) throw new ImagingError("decode_failed");
  return { width, height };
}

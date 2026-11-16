// Validación del cuerpo JSON con zod. Si no es JSON o no cumple el esquema,
// lanza ApiError 400 `invalid_body` (withUser lo convierte en respuesta).
// Con `maxBytes`, un cuerpo más grande lanza 413 `payload_too_large`.
import { z } from "zod";
import { ApiError } from "./errors";

export type ParseBodyOptions = {
  /** Tamaño máximo del cuerpo en bytes. */
  maxBytes?: number;
};

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  { maxBytes }: ParseBodyOptions = {},
): Promise<z.output<S>> {
  const tooLarge = () => new ApiError(413, "payload_too_large", "Body too large");
  if (maxBytes !== undefined) {
    // Corte rápido por la cabecera; luego se mide lo recibido de verdad.
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  }

  let json: unknown;
  try {
    const text = await request.text();
    if (maxBytes !== undefined && new TextEncoder().encode(text).byteLength > maxBytes) {
      throw tooLarge();
    }
    json = JSON.parse(text);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "invalid_body", "Body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    // Lista plana { path, message } para depurar; sin el valor recibido.
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new ApiError(400, "invalid_body", "Invalid request body", details);
  }
  return result.data;
}

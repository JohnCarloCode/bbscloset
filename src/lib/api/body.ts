// Validación del cuerpo JSON con zod. Si no es JSON o no cumple el esquema,
// lanza ApiError 400 `invalid_body` (withUser lo convierte en respuesta).
import { z } from "zod";
import { ApiError } from "./errors";

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
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

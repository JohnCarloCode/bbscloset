// Respuesta de error uniforme de la API: { error: { code, message, details? } }.
// `code` es estable y en inglés: la UI traduce por código. `message` es solo
// para depurar (nunca se enseña tal cual a la usuaria).
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_body"
  | "invalid_query"
  | "not_found"
  | "conflict"
  | "limit_reached"
  | "payload_too_large"
  | "rate_limited"
  | "internal";

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; details?: unknown };
};

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const error: ApiErrorBody["error"] = { code, message };
  if (details !== undefined) error.details = details;
  return NextResponse.json({ error }, { status });
}

/**
 * Error que se puede lanzar desde cualquier helper o handler: withUser lo
 * captura y lo convierte en la respuesta de apiError.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse<ApiErrorBody> {
    return apiError(this.status, this.code, this.message, this.details);
  }
}

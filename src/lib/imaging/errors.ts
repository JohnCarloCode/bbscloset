// Errores tipados del procesado de imagen (paso 3.5). La UI traduce `code`
// con IMAGING_ERROR_MESSAGE: los textos viven en messages, nunca aquí.

export type ImagingErrorCode =
  // validate.ts (al elegir la foto, screens.md 5.1)
  | "not_image"
  | "too_large"
  | "heic_unsupported"
  | "decode_failed"
  // removeBackground.ts (cola de recorte, screens.md 5.3)
  | "model_load_failed"
  | "cut_failed"
  // encode.ts
  | "empty_cutout"
  | "encode_failed";

export class ImagingError extends Error {
  readonly code: ImagingErrorCode;

  constructor(code: ImagingErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "ImagingError";
    this.code = code;
  }
}

export function isImagingError(err: unknown): err is ImagingError {
  return err instanceof ImagingError;
}

/** Clave de messages (es.json / en.json) para cada código de error. */
export const IMAGING_ERROR_MESSAGE = {
  not_image: "garment.photoErrors.not_image",
  too_large: "garment.photoErrors.too_large",
  heic_unsupported: "garment.photoErrors.heic_unsupported",
  decode_failed: "garment.photoErrors.decode_failed",
  model_load_failed: "queue.errors.model_load_failed",
  cut_failed: "queue.errors.cut_failed",
  empty_cutout: "queue.errors.empty_cutout",
  encode_failed: "queue.errors.encode_failed",
} as const satisfies Record<ImagingErrorCode, string>;

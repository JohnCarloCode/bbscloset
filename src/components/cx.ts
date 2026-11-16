// Une clases condicionales (sin dependencias). Los falsy se descartan.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

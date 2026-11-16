// Formatos compartidos de fecha. El helper puro sirve fuera de React;
// dentro, `useFormatter().dateTime(d, "short")` / `getFormatter()` usan
// el mismo formato registrado en request.ts.
import type { Formats } from "next-intl";
import { timeZone as defaultTimeZone, type Locale } from "./config";

const shortDate = { day: "numeric", month: "short", year: "numeric" } as const;

export const formats = {
  dateTime: { short: shortDate },
} satisfies Formats;

/** Fecha corta: "14 nov 2026" (es) · "Nov 14, 2026" (en). */
export function formatShortDate(
  date: Date | string | number,
  locale: Locale,
  timeZone: string = defaultTimeZone,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, { ...shortDate, timeZone }).format(d);
}

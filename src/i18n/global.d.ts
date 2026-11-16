// Tipado de next-intl: claves de mensajes, idiomas y formatos comprobados por TypeScript.
import type messages from "../messages/es.json";
import type { Locale } from "./config";
import type { formats } from "./format";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
    Formats: typeof formats;
  }
}

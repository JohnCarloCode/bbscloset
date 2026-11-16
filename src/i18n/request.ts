// Configuración por petición de next-intl (sin enrutado por idioma).
// Lee cookies y cabeceras: solo se llama desde componentes dentro de <Suspense>.
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale, timeZone } from "./config";
import { formats } from "./format";

export default getRequestConfig(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get("accept-language"),
  );
  return {
    locale,
    timeZone,
    formats,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

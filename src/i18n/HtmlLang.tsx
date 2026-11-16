"use client";

// Mantiene <html lang> igual al idioma activo: tras cambiarlo con la cookie
// sin recargar y tras el remontaje de Strict Mode en desarrollo, que borra
// lo que puso el script de <head>.
import { useLocale } from "next-intl";
import { useLayoutEffect } from "react";

export function HtmlLang() {
  const locale = useLocale();
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

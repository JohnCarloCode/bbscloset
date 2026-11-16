// Proveedores que dependen del idioma de la petición (cookie/Accept-Language).
// Lee datos de la petición: el layout raíz lo envuelve en <Suspense>.
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@/components/toast";
import { HtmlLang } from "./HtmlLang";

export function LocaleProviders({ children }: { children: ReactNode }) {
  // En servidor, NextIntlClientProvider hereda idioma, mensajes, formatos y zona horaria de request.ts.
  return (
    <NextIntlClientProvider>
      <HtmlLang />
      {/* Avisos breves globales (useToast). */}
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}

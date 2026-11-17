// Metadatos de la página temporal /dev/canvas (la página es cliente). Va
// dentro de (app) porque necesita sesión para firmar las URLs de los
// recortes. Se borra en el paso 7.5.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Lienzo · dev",
  robots: { index: false, follow: false },
};

export default function DevCanvasLayout({ children }: { children: ReactNode }) {
  return children;
}

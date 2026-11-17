// Metadatos de la página temporal /dev/imaging (la página es cliente).
// Se borra en el paso 7.5.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Imagen · dev",
  robots: { index: false, follow: false },
};

export default function DevImagingLayout({ children }: { children: ReactNode }) {
  return children;
}

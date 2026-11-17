// Metadatos de la página temporal /dev/queue (la página es cliente). Va
// dentro de (app) para tener la cola montada y usuario. Se borra en el paso 7.5.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cola · dev",
  robots: { index: false, follow: false },
};

export default function DevQueueLayout({ children }: { children: ReactNode }) {
  return children;
}

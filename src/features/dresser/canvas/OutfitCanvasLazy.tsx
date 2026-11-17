"use client";

// Punto de entrada del lienzo para las páginas: carga OutfitCanvas (y con él
// Konva) solo en el navegador y en un chunk aparte. `ssr: false` solo se
// permite en componentes cliente (Next 16, guía lazy-loading).
import dynamic from "next/dynamic";

export type { CanvasChange, CanvasGarment, OutfitCanvasProps } from "./OutfitCanvas";

export const OutfitCanvasLazy = dynamic(() => import("./OutfitCanvas"), {
  ssr: false,
  // Mientras llega el chunk: el fondo del lienzo, sin contenido.
  loading: () => <div className="h-full w-full rounded-lg bg-canvas-parchment" />,
});

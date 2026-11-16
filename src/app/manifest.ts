import type { MetadataRoute } from "next";

// Manifest de la PWA (se sirve en /manifest.webmanifest). Solo instalable:
// sin service worker ni modo offline (architecture.md 8). Chrome ya no exige
// service worker para ofrecer la instalación.
// Iconos provisionales en public/icons/ hasta tener el definitivo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "bb's closet",
    short_name: "bb's closet",
    lang: "es",
    start_url: "/dresser",
    scope: "/",
    display: "standalone",
    // --color-canvas de tokens.css
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Contenido dentro del 80 % central (zona segura de maskable).
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { localeDetectScript } from "@/i18n/config";
import { LocaleProviders } from "@/i18n/LocaleProviders";
import "./globals.css";

// Sustituto de SF Pro fuera de Apple; se autoaloja en el build. Solo expone
// --font-inter: la pila completa (sistema primero) está en tokens.css.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // En Apple nunca se usa (gana -apple-system): sin precarga no se descarga.
  preload: false,
});

// Marca data-font="inter" fuera de macOS/iOS/iPadOS antes del primer pintado
// para aplicar los ajustes de tracking e interlineado de Inter (tokens.css).
const fontDetectScript = `(function(){try{var n=navigator,s=(n.userAgentData&&n.userAgentData.platform)||n.platform||n.userAgent||"";if(!/Mac|iPhone|iPad|iPod/i.test(s))document.documentElement.dataset.font="inter"}catch(e){}})()`;

export const metadata: Metadata = {
  title: "bb's closet",
  // PWA en iOS: icono de inicio y pantalla completa al abrir desde él.
  // El <link rel="manifest"> lo añade Next solo (app/manifest.ts).
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "bb's closet",
    statusBarStyle: "default",
  },
  // Next solo emite mobile-web-app-capable; la etiqueta de Apple se añade
  // a mano para versiones de iOS anteriores a 16.4.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// viewport-fit=cover: la app ocupa toda la pantalla del iPhone y cada barra
// respeta env(safe-area-inset-*) por su cuenta (p. ej. la barra de pestañas).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Los scripts cambian data-font y lang antes de hidratar: el DOM manda.
    // El layout no lee la cookie de idioma para que su cascarón siga siendo
    // estático (cacheComponents); lang="es" es solo el valor por defecto.
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontDetectScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeDetectScript }} />
      </head>
      <body>
        {/* Todo lo traducido depende de la petición: va dentro de Suspense. */}
        <Suspense>
          <LocaleProviders>{children}</LocaleProviders>
        </Suspense>
      </body>
    </html>
  );
}

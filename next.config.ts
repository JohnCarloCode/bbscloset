import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Idiomas sin enrutado: configuración por petición en src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // `/` lleva al Vestidor con un 307 real (screens.md 1). El redirect() de
  // src/app/page.tsx queda de respaldo: dentro del <Suspense> raíz llega tarde
  // y solo puede hacer una redirección por meta refresh con estado 200.
  async redirects() {
    return [{ source: "/", destination: "/dresser", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);

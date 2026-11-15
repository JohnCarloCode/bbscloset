import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Desactiva las reglas de formato que chocarían con Prettier (siempre al final).
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Documentación, prototipo y pruebas: no son código de la app.
    "doc-ai/**",
    "pruebas/**",
    "pruebas-fotos/**",
  ]),
]);

export default eslintConfig;

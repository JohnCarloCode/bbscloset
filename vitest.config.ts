import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Los tests de integración comparten la BD local (p. ej. el de etiquetas
    // renombra y borra "curro"/"fiesta" del seed): con INTEGRATION=1, de uno en uno.
    fileParallelism: process.env.INTEGRATION !== "1",
  },
});

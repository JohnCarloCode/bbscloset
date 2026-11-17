# bb's closet

## Requisitos

- Node.js 22 o superior y npm.
- Las claves del proyecto de Supabase (URL y clave anónima).

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:3000
```

## Scripts

| Script              | Qué hace                                                        |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                                          |
| `npm run build`     | Compilación de producción                                       |
| `npm run start`     | Sirve la compilación de producción                              |
| `npm run lint`      | ESLint                                                          |
| `npm run typecheck` | Comprobación de tipos (`tsc --noEmit`)                          |
| `npm run test`      | Tests con Vitest                                                |
| `npm run format`    | Formatea el código con Prettier (`format:check` solo comprueba) |

La documentación del proyecto está en `doc-ai/`.

## Datos de prueba en local

Con el Supabase local arrancado (`supabase/README.md`, _Local_) y la app en `npx next dev -p 3100`:

```bash
node scripts/seed-garments.mjs            # 60 prendas para test@bbscloset.test (1 de cada 10 archivada)
node scripts/seed-garments.mjs 24         # otro número
node scripts/seed-garments.mjs 30 --user 2  # para test2@bbscloset.test
node scripts/seed-garments.mjs --clean    # borra todas las prendas del usuario (archivos y filas)
```

Crea las prendas por la API, como la app: reserva ids, sube recorte y miniatura WebP generados (con `sharp`, que viene con Next) desde `pruebas-fotos/streetwear/` (fuera del repo) y llama a `POST /api/garments`. `--clean` no borra las etiquetas (aún no hay API para eso); para dejarlas a cero: `psql postgresql://postgres:postgres@127.0.0.1:55622/postgres -c "delete from tags"`.

Tests de integración de la API (contra el mismo local; `npm test` normal los salta):

```bash
INTEGRATION=1 npx vitest run src/app/api/garments
```

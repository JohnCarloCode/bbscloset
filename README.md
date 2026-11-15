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

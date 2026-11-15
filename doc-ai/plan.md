# bb's closet — Plan de construcción

**Estado:** v0.2 — 15-11-2026 (dudas resueltas)
**Fuente de verdad:** [spec.md](spec.md) (qué hace), [screens.md](screens.md) (cada pantalla), [DESIGN.md](DESIGN.md) (cómo se ve), [architecture.md](architecture.md) (cómo se construye), [database.md](database.md) (esquema). Este plan no añade requisitos: si algo de aquí contradice esos documentos, mandan ellos y se corrige el plan.

## Cómo usar este plan

- **Objetivo:** llegar a la v1 de bb's closet (todo lo descrito en spec y screens) siguiendo los pasos en orden, de principio a fin, sin pagar nada: Supabase Free, Vercel Hobby, GitHub.
- **Fases y pasos.** Las fases siguen el orden acordado en [architecture.md](architecture.md) sec. 9, con una fase 0 de preparación delante y una fase final de despliegue y prueba con la clienta. Cada paso está pensado para una sesión de trabajo y lleva: objetivo, tareas, archivos que se crean o tocan, cómo se comprueba y la sección del doc de referencia. Cuando un paso depende de otro que no es el anterior, se indica.
- **"Hecho cuando…"** al final de cada fase: no se pasa a la siguiente hasta cumplirlo.
- **[John]** marca lo que hay que hacer a mano fuera del código: cuentas, paneles, variables de entorno, crear usuarios.
- **Ramas.** Se trabaja en `develop`; `main` es lo estable y publicado. Cada paso (o grupo de pasos pequeños) es un commit en `develop`. Vercel despliega `develop` como *preview* y `main` como producción. Se fusiona `develop` → `main` al cerrar la fase 8 (y, si se quiere, al cerrar cada fase a partir de la 3 para tener algo que enseñar).
- **Reglas transversales** (valen para todos los pasos):
  - Móvil primero: cada pantalla se construye y se prueba primero a 402 px, luego 834 y 1280 ([screens.md](screens.md), *Reglas comunes*).
  - Color: rosa `#f0d7d7` solo como fondo; negro `#1d1d1f` para texto, enlaces, bordes y foco ([DESIGN.md](DESIGN.md), *Brand & Accent*).
  - Ningún texto visible en el código: todo en `src/messages/es.json` y `en.json` desde el primer componente ([architecture.md](architecture.md) 4.6).
  - El navegador habla con Supabase solo para iniciar sesión y para **subir** archivos con la URL firmada que da la API; datos y lecturas pasan por `src/app/api/` ([architecture.md](architecture.md) sec. 3 y 4.1, decisión 5).
  - RLS en todas las tablas de usuario con `(select auth.uid())` ([next-steps.md](next-steps.md), punto 2).
  - Sin scroll horizontal en listas de prendas; toda acción destructiva pide confirmación.

### Rutas de la app (nombres que usa el plan)

| Ruta | Pantalla | screens.md |
|---|---|---|
| `/login` | Login | 2 |
| `/waitlist` | Waitlist (pública) | 3 |
| `/reset-password` | Nueva contraseña (desde el email de Supabase) | 2 (ver decisión 6) |
| `/catalog` | Catálogo | 4 |
| `/dresser` | Vestidor (inicio tras el login) | 7 |
| `/favorites` · `/favorites/[id]` | Favoritos · Detalle | 10 · 11 |
| `/settings` | Ajustes | 12 |
| `/cutout` | Recortar fotos (lote) | 13 |

### Rutas de la API (nombres que usa el plan)

| Ruta | Para qué |
|---|---|
| `GET/PATCH /api/me` | Perfil: idioma, máximo de joyería, categorías del aleatorio |
| `GET /api/garments` · `POST /api/garments` | Listar con filtros y cursor · crear (comprueba el límite de 500) |
| `POST /api/garments/uploads` | Reservar id y URLs firmadas de subida (recorte + miniatura) |
| `GET/PATCH/DELETE /api/garments/[id]` | Ficha · editar · eliminar (borra también los archivos) |
| `GET /api/garments/[id]/usage` | En cuántos favoritos aparece y cuántos quedarían vacíos |
| `POST /api/garments/[id]/image` | Cambiar foto (nuevas URLs de subida; sobrescribe) |
| `POST /api/garments/archive` | Archivar / desarchivar en lote |
| `POST /api/images/sign` | URLs firmadas de lectura en lote (caché corta) |
| `GET /api/brands` · `GET /api/tags` | Autocompletado por usuario |
| `PATCH/DELETE /api/tags/[id]` | Renombrar · eliminar (devuelve a cuántas prendas afecta) |
| `GET/POST /api/favorites` · `GET/PATCH/DELETE /api/favorites/[id]` | Favoritos y sus posiciones |
| `POST /api/waitlist` | Apuntarse (anónimo) |

---

## Fase 0 — Preparación

Objetivo: cuentas creadas, repo con Next.js arrancando en local, esquema de base de datos aplicado con datos semilla y un usuario de prueba.

### 0.1 [John] Cuentas y proyectos
- **Objetivo:** tener GitHub, Supabase y Vercel listos y enlazados.
- **Tareas:**
  - GitHub: crear el repositorio remoto (privado) y subir las ramas `develop` y `main` que ya existen en local.
  - Supabase: crear proyecto en plan Free (región UE, p. ej. Frankfurt), guardar la contraseña de la base de datos. En *Authentication → Providers → Email*: dejar activo email + contraseña y **desactivar "Allow new users to sign up"**. En *Authentication → URL Configuration*: Site URL de momento `http://localhost:3000`; se añadirán las de Vercel en 1.8 y 8.1.
  - Vercel: crear proyecto Hobby importando el repo; rama de producción `main`; previews para `develop`. Todavía sin variables de entorno (van en 1.8).
  - Anotar en un sitio privado (no en el repo): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta solo para migraciones/admin; nunca llega al navegador ni a la API de usuario).
- **Comprobación:** los tres paneles abren; `git push` a `develop` funciona; Supabase muestra "Sign ups disabled".
- **Ref.:** [architecture.md](architecture.md) 2, 7 y 4.5; [database.md](database.md) 7.

### 0.2 Proyecto Next.js
- **Objetivo:** app vacía que compila, con la estructura de carpetas de la arquitectura.
- **Tareas:**
  - `create-next-app` con TypeScript, App Router, Tailwind, ESLint y carpeta `src/`. Añadir Prettier.
  - Crear la estructura de [architecture.md](architecture.md) sec. 5: `src/app/(app)/`, `src/app/login/`, `src/app/waitlist/`, `src/app/api/`, `src/components/`, `src/features/{catalog,dresser,favorites}/`, `src/lib/{supabase,imaging,layout}/`, `src/messages/`, `src/styles/`, `supabase/`.
  - `.env.example` con las tres variables públicas/privadas y `.env.local` en `.gitignore` (ya está; revisar).
  - Instalar dependencias que se usarán en todas las fases: `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `zod`, `zustand`, `idb`, `vitest`. Las de lienzo/imagen (`konva`, `react-konva`, `@imgly/background-removal`, `react-colorful`, `client-zip`) se instalan en su fase.
  - Scripts: `dev`, `build`, `lint`, `typecheck`, `test`.
- **Archivos:** `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (redirige a `/dresser`), `.env.example`, `README.md` (solo cómo arrancar).
- **Comprobación:** `npm run dev` abre en `http://localhost:3000`; `npm run build`, `lint`, `typecheck` y `test` pasan en verde (aunque no haya tests).
- **Ref.:** [architecture.md](architecture.md) 2 y 5.

### 0.3 Migraciones SQL y datos semilla
- **Objetivo:** todo el esquema de [database.md](database.md) como migraciones versionadas en `supabase/migrations/`, listas para aplicar.
- **Tareas:**
  - `supabase init` (CLI, gratis) en la raíz; no hace falta Docker si se aplican con `supabase db push` contra el proyecto remoto.
  - `0001_closed_lists.sql`: tablas `slots` y `garment_types` + RLS de solo lectura + **semilla**:
    - 9 huecos con `sort_order`, `multi` (solo `jewelry`) y una **propuesta inicial** de `default_z` y `size_weight` (los ajustará 4.2 viendo el collage real): `outer_layer` z 60 · peso 0.9; `mid_layer` 50 · 0.85; `base_layer` 40 · 0.8; `full_body` 40 · 1.1; `bottom` 30 · 1.0; `footwear` 20 · 0.45; `bag` 70 · 0.4; `jewelry` 80 · 0.25; `accessories` 90 · 0.35.
    - 33 tipos de [spec.md](spec.md) 2.1 con id en inglés: `tshirt, shirt, top, bodysuit` → base; `sweater, sweatshirt, cardigan, vest` → media; `jacket, coat, bomber, trench` → exterior; `trousers, jeans, skirt, shorts` → inferior; `dress, jumpsuit` → cuerpo entero; `sneakers, boots, sandals, heels` → calzado; `handbag, backpack, crossbody` → bolso; `necklace, earrings, ring, bracelet` → joyería; `hat, glasses, belt, scarf` → accesorios.
  - `0002_user_tables.sql`: `profiles`, `garments`, `tags`, `garment_tags`, `favorites`, `favorite_items` tal cual en database.md sec. 3.
  - `0003_indexes.sql`: los de database.md sec. 4.
  - `0004_rls.sql`: RLS en todas las tablas de usuario con `(select auth.uid())`; en `garment_tags` y `favorite_items`, `with check` que verifique que `garment_id`, `tag_id` y `favorite_id` pertenecen al mismo usuario (subconsultas `exists`).
  - `0005_triggers.sql`: trigger en `auth.users` que crea `profiles`; trigger `after delete` en `favorite_items` que borra el favorito vacío.
  - `0006_waitlist.sql`: tabla, índice único por `lower(email)`, RLS con `insert` para `anon, authenticated` y sin `select`.
  - `0007_storage.sql`: bucket privado `garments` y políticas de Storage por carpeta `{user_id}/…` (también con `(select auth.uid())`).
  - Apuntar en `supabase/README.md` cómo aplicar y cómo regenerar tipos (`supabase gen types typescript`).
- **Archivos:** `supabase/config.toml`, `supabase/migrations/0001…0007`, `supabase/README.md`.
- **Comprobación:** `supabase db push` (o pegar en el SQL Editor) sin errores en un proyecto limpio; `select count(*) from garment_types` = 33; `select * from slots order by sort_order` muestra los 9.
- **Ref.:** [database.md](database.md) 2–7; [next-steps.md](next-steps.md) punto 2; [spec.md](spec.md) 2.1.

### 0.4 [John] Aplicar el esquema y crear el usuario de prueba
- **Objetivo:** base de datos real con el esquema y un usuario con el que desarrollar.
- **Tareas:**
  - Enlazar la CLI al proyecto (`supabase link`) y aplicar las migraciones (`supabase db push`), o pegar los archivos en orden en el SQL Editor.
  - *Authentication → Users → Add user*: crear un usuario con email y contraseña (marcar "auto confirm"). Comprobar en *Table Editor* que ha aparecido su fila en `profiles` (trigger).
  - *Storage*: comprobar que existe el bucket `garments` y es privado.
  - Rellenar `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La `service_role` no hace falta en la app.
- **Comprobación:** en el SQL Editor, `select * from profiles` muestra una fila con `language='es'`, `jewelry_max=3` y `random_slots` por defecto.
- **Ref.:** [database.md](database.md) 3 y 7.

### 0.5 Fotos de prueba
- **Objetivo:** material realista para probar recorte, catálogo y collage desde la fase 3.
- **Tareas:** reunir en `pruebas-fotos/` (ya existe, vacía; excluida del repo si pesa) 20–30 fotos de prendas reales de distintos huecos, con fondo liso y alguna "difícil" (prenda clara sobre fondo claro), más 2–3 PNG ya recortados. Pasarlas por `pruebas/recorte/index.html` para tener una referencia del tiempo por foto en el portátil.
- **Comprobación:** hay al menos una foto de cada uno de los 9 huecos.
- **Ref.:** [architecture.md](architecture.md) 8 (prueba del 25-10-2026); [next-steps.md](next-steps.md), *Pendiente menor*.

**Hecho cuando…**
- Repo en GitHub con `develop` y `main`; proyecto Next.js compila en local.
- Migraciones aplicadas en Supabase sin errores; 9 huecos y 33 tipos cargados; registro público desactivado.
- Un usuario de prueba con su fila en `profiles`; bucket `garments` privado.
- Fotos de prueba disponibles.

---

## Fase 1 — Base

Objetivo: cimientos sobre los que se construyen todas las pantallas: tokens, componentes básicos, i18n, conexión a Supabase, esqueleto de API, navegación y PWA, desplegado en Vercel.

### 1.1 Tokens de diseño en Tailwind
- **Objetivo:** que todos los colores, radios, espaciados y tipografías salgan de DESIGN.md y no de hexadecimales sueltos.
- **Tareas:**
  - Mapear `colors`, `rounded`, `spacing` y `typography` del front-matter de DESIGN.md al tema de Tailwind (`src/styles/tokens.css` con variables CSS + `tailwind.config` / `@theme`).
  - Pila de fuentes: `system-ui, -apple-system, BlinkMacSystemFont` primero (SF Pro en Apple) y **Inter** como sustituto en Android/Windows, con los ajustes de tracking y line-height de DESIGN.md (*Note on Font Substitutes*).
  - `globals.css`: fondo `canvas`, color de texto `ink`, anillo de foco `outline: 2px solid #1d1d1f; outline-offset: 2px`, `transform: scale(0.95)` en `:active` de botones, sin sombras salvo la de producto (clase `shadow-product`).
  - Breakpoints de referencia: 402 / 834 / 1280.
- **Archivos:** `src/styles/tokens.css`, `src/app/globals.css`, `tailwind.config.ts` (o `@theme` en CSS según la versión de Tailwind).
- **Comprobación:** página de muestra temporal (`/dev/tokens`, se borra en 7.5) con todos los colores, radios y escalas tipográficas; comparar a ojo con el prototipo.
- **Ref.:** [DESIGN.md](DESIGN.md) *Colors*, *Typography*, *Shapes*, *Layout*, *Do's and Don'ts*.

### 1.2 Componentes base
- **Objetivo:** las piezas reutilizables que screens.md nombra, con sus estados.
- **Tareas:** construir en `src/components/` con estados por defecto, activo, deshabilitado y foco (nunca hover como estado principal):
  - `Button` (variantes `primary` rosa, `secondary` borde negro, `dark-utility`, `icon-circular` 44 px, `text-link` subrayado).
  - `Chip` (`chip-filter`: borde hairline; seleccionado = fondo rosa + borde negro 2 px) y `ChipGroup` multiselección.
  - `SegmentedControl` (dos variantes de DESIGN.md: activo rosa para elecciones que importan, blanco para cambios de vista).
  - `Sheet` (hoja inferior en móvil, a pantalla completa cuando se indique; centrada en escritorio) con cierre accesible.
  - `Dialog` de confirmación (acción destructiva en negro).
  - `Toast` (píldora negra, 3,5 s, acción opcional en rosa) con un proveedor global y cola; se desplaza hacia arriba cuando hay `queue-pill`.
  - `ProgressBar`, `StatusBadge`, `NoticeInline`, `TransparencyChecker` (cuadros 16 px / fondo `#d9d4cc` para fotos con fondo), `EmptyState` (ilustración + título + texto + botón).
  - `TextField`, `Textarea` ligeros con etiqueta y error en línea.
- **Archivos:** `src/components/*.tsx`, `src/components/toast/`.
- **Comprobación:** página temporal `/dev/components` con cada componente y estado, revisada a 402 px; navegación por teclado con foco visible en todo.
- **Ref.:** [DESIGN.md](DESIGN.md) *Buttons*, *bb's closet components*; [screens.md](screens.md) *Reglas comunes* y 1 (toast).

### 1.3 Idiomas (next-intl) sin textos en el código
- **Objetivo:** ES/EN desde el primer día, con el idioma elegido por el usuario y sin prefijo en la URL.
- **Tareas:**
  - Configurar `next-intl` **sin enrutado por locale**: el idioma sale de una cookie `locale` (por defecto, el del navegador si es `es` o `en`; si no, `es`). Tras iniciar sesión se sincroniza con `profiles.language` (paso 2.1 y 7.2).
  - `src/messages/es.json` y `en.json` organizados por pantalla (`common`, `nav`, `login`, `waitlist`, `catalog`, `garment`, `queue`, `dresser`, `favorites`, `export`, `settings`, `cutout`) y por dominio (`slots`, `types`, `seasons`, `colors`). Cargar ya los nombres de los 9 huecos y 33 tipos en ambos idiomas.
  - Helper `t()` en servidor y cliente; formato de fechas y plurales con `Intl` (p. ej. "14 nov 2026", "3 outfits guardados").
  - Regla de lint o test simple que falle si un componente contiene literales en castellano/inglés fuera de `messages/` (opcional, pero evita olvidos).
- **Archivos:** `src/i18n/{request.ts,config.ts}`, `src/messages/es.json`, `src/messages/en.json`, `src/app/layout.tsx`.
- **Comprobación:** cambiar la cookie cambia el idioma de `/dev/components`; `slots.jewelry` → "Joyería" / "Jewelry".
- **Ref.:** [architecture.md](architecture.md) 4.6; [spec.md](spec.md) 3.6; [database.md](database.md) 2 (nombres fuera de la BD).

### 1.4 Clientes de Supabase y sesión
- **Objetivo:** un cliente de navegador (solo para auth) y uno de servidor (API y páginas) que comparten la sesión por cookies.
- **Tareas:**
  - `src/lib/supabase/browser.ts` (anon key, solo `auth`), `src/lib/supabase/server.ts` (con `@supabase/ssr` y las cookies de la petición: así la API habla con Supabase **con la sesión del usuario** y la RLS aplica).
  - Middleware/proxy de Next.js que refresca la sesión en cada petición y redirige a `/login` si no hay usuario en `(app)/*` y `/api/*` (salvo `/api/waitlist`).
  - Tipos generados: `supabase gen types typescript > src/lib/supabase/types.ts` y `npm run gen:types`.
- **Archivos:** `src/lib/supabase/{browser,server,types}.ts`, `src/middleware.ts` (o `proxy.ts` según la versión de Next.js).
- **Comprobación:** sin sesión, `/catalog` redirige a `/login`; con una sesión creada a mano en una página temporal, `GET /api/me` devuelve el perfil.
- **Ref.:** [architecture.md](architecture.md) 3 y 4.5; [spec.md](spec.md) 6.2.

### 1.5 Esqueleto de la API
- **Objetivo:** convenciones comunes para todas las rutas de `src/app/api/`.
- **Tareas:**
  - Helpers en `src/lib/api/`: `withUser(handler)` (obtiene usuario o 401), validación de cuerpo con `zod`, respuesta de error uniforme `{ error: { code, message } }`, paginación por cursor `(created_at, id)`.
  - Primeras rutas: `GET /api/me` y `PATCH /api/me` (idioma, `jewelry_max` 1–10, `random_slots` ⊆ huecos válidos).
  - Firmado de URLs en lote: `src/lib/storage/sign.ts` (`createSignedUrls`, caducidad 1 h) y `POST /api/images/sign`.
- **Archivos:** `src/lib/api/*`, `src/app/api/me/route.ts`, `src/app/api/images/sign/route.ts`, `src/lib/storage/sign.ts`.
- **Comprobación:** `PATCH /api/me` con `jewelry_max: 11` → 400; con `5` → 200 y la fila cambia; sin sesión → 401.
- **Ref.:** [architecture.md](architecture.md) 3 y 4.1 (URLs firmadas); [database.md](database.md) 3 (`profiles`).

### 1.6 Navegación y esqueleto de pantallas
- **Objetivo:** la app se recorre entera aunque las pantallas estén vacías.
- **Tareas:**
  - Layout de `(app)`: barra de pestañas inferior en móvil/tablet (Catálogo · Vestidor · Favoritos · Ajustes; activa en negro y negrita) y barra lateral de 232 px en escritorio (mismas 4 + Recortar fotos + botón "Añadir prenda" abajo; activa con fondo rosa).
  - Páginas vacías: `/catalog`, `/dresser`, `/favorites`, `/favorites/[id]`, `/settings`, `/cutout`, `/login`, `/waitlist`. `/` redirige a `/dresser`.
  - Hueco reservado para la `queue-pill` (centrada sobre la barra en móvil, abajo en la barra lateral en escritorio) y el proveedor de toasts encima.
  - En `/cutout` la pestaña activa es Ajustes.
- **Archivos:** `src/app/(app)/layout.tsx`, `src/components/nav/{TabBar,Sidebar}.tsx`, páginas placeholder.
- **Comprobación:** a 402 px se ve la barra de pestañas; a 1280 px la lateral; la pestaña activa cambia al navegar; `safe-area-inset-bottom` respetado en iPhone.
- **Ref.:** [screens.md](screens.md) 1.

### 1.7 PWA instalable
- **Objetivo:** icono en la pantalla de inicio y pantalla completa, sin offline.
- **Tareas:**
  - `src/app/manifest.ts` (nombre "bb's closet", `display: standalone`, `start_url: /dresser`, `theme_color` y `background_color` blancos, iconos 192/512 y *maskable*), `apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`.
  - Service worker mínimo (o ninguno): sin caché de datos ni de fotos; como mucho el *shell*. Si se añade, con `@serwist/next` y estrategia *network-first*.
  - Iconos en `public/icons/` (provisionales hasta que John o la clienta den el definitivo).
- **Archivos:** `src/app/manifest.ts`, `public/icons/*`, `src/app/layout.tsx` (metadatos).
- **Comprobación:** Lighthouse marca "installable"; en Android aparece "Añadir a pantalla de inicio"; en iOS, *Compartir → Añadir a pantalla de inicio* abre a pantalla completa.
- **Ref.:** [architecture.md](architecture.md) 2 y 8 (PWA); [next-steps.md](next-steps.md).

### 1.8 Despliegue continuo en Vercel
- **Objetivo:** cada push a `develop` se ve en una URL de preview; `main` en la URL de producción.
- **Tareas:**
  - [John] Variables de entorno en Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) para *Preview* y *Production*.
  - [John] En Supabase *URL Configuration*, añadir la URL de producción de Vercel y el comodín de previews (`https://*-<equipo>.vercel.app/**`) a *Redirect URLs*.
  - Comprobar que `next build` pasa en Vercel y que las rutas de API funcionan ahí (región cercana a Supabase si se puede elegir).
- **Comprobación:** abrir la URL de preview desde el móvil; `/login` carga; `GET /api/me` responde 401.
- **Ref.:** [architecture.md](architecture.md) 2 y 8 (Despliegue).

**Hecho cuando…**
- Tokens y componentes base revisados contra DESIGN.md a 402 px.
- Idioma cambia entre ES y EN sin un literal en el código.
- Sesión por cookies funciona en local y en Vercel; `/api/me` responde con RLS activa.
- Navegación completa (barra inferior y lateral), PWA instalable, preview en Vercel desde el móvil.

---

## Fase 2 — Cuentas

Objetivo: entrar con email y contraseña, salir, recuperar la contraseña y apuntarse a la lista de espera.

### 2.1 Login
- **Objetivo:** pantalla de login funcional según screens.md 2.
- **Tareas:**
  - Formulario (nombre de la app, "Entrar", *"Usa el email al que te llegó la invitación."*, email, contraseña, botón principal, pie con enlace a la waitlist).
  - `signInWithPassword` con el cliente de navegador; la sesión queda en cookies; redirigir a `/dresser`. Errores en línea (credenciales incorrectas, sin conexión), sin revelar si el email existe.
  - Al entrar, leer `profiles.language` y fijar la cookie `locale`.
  - Si ya hay sesión, `/login` redirige a `/dresser`.
- **Archivos:** `src/app/login/page.tsx`, `src/features/auth/LoginForm.tsx`, `src/messages/*` (`login`).
- **Comprobación:** con el usuario de 0.4 entra y aterriza en el Vestidor; contraseña mal → mensaje; recargar mantiene la sesión; funciona en la preview de Vercel desde el móvil.
- **Ref.:** [screens.md](screens.md) 2; [spec.md](spec.md) 3.8; [architecture.md](architecture.md) 4.5.

### 2.2 Cerrar sesión y protección de rutas
- **Objetivo:** salir limpiamente y no poder ver nada sin sesión.
- **Tareas:** acción de logout (`signOut` + borrar cookies + redirigir a `/login`) que usará Ajustes en 7.2 (de momento, botón temporal); comprobar que el middleware cubre `(app)` y `/api` y que una sesión caducada en una llamada a la API devuelve 401 y la app manda a `/login` con un toast.
- **Archivos:** `src/features/auth/signOut.ts`, `src/lib/api/client.ts` (fetch con manejo de 401), `src/middleware.ts`.
- **Comprobación:** tras salir, `/catalog` redirige; borrar la cookie a mano y llamar a la API → 401 y redirección.
- **Ref.:** [screens.md](screens.md) 12 (*Cuenta*); [architecture.md](architecture.md) 3.

### 2.3 Recuperar contraseña
- **Objetivo:** reseteo con el email de Supabase (sin proveedor de correo propio).
- **Tareas:**
  - Enlace "¿Has olvidado la contraseña?" en el login (ver decisión 6) → `resetPasswordForEmail` con `redirectTo` a `/reset-password`; mensaje neutro "Si el email existe, te hemos enviado un enlace".
  - `/reset-password`: formulario de nueva contraseña (`updateUser`) tras llegar desde el enlace; después redirige a `/dresser`.
  - [John] Revisar en Supabase *Authentication → Email Templates* el texto del email (ES) y que `/reset-password` esté en *Redirect URLs*.
- **Archivos:** `src/app/reset-password/page.tsx`, `src/features/auth/*`.
- **Comprobación:** pedir reseteo para el usuario de prueba, abrir el enlace del email, cambiar la contraseña y entrar con la nueva.
- **Ref.:** [screens.md](screens.md) 2; [architecture.md](architecture.md) 8 (Email); [open-questions.md](open-questions.md) *Cierre del 25-10-2026*.

### 2.4 Waitlist
- **Objetivo:** página pública para dejar el email, sin enviar correo.
- **Tareas:**
  - Página según screens.md 3: collage de ejemplo (imagen estática en `public/`), titular, texto, campo email, botón "Apuntarme" deshabilitado hasta que haya "@", pie con enlace a `/login`.
  - `POST /api/waitlist`: valida el email con `zod`, inserta con el cliente anónimo (sin sesión); si choca con el índice único, responde igualmente 200 (no revelar quién está apuntado). Límite de tamaño y rate-limit básico por IP en memoria (suficiente para el Hobby).
  - Mensaje de confirmación *"Estás en la lista. Te escribiremos a {email} cuando tengas sitio."*
- **Archivos:** `src/app/waitlist/page.tsx`, `src/app/api/waitlist/route.ts`, `public/waitlist-collage.png`.
- **Comprobación:** apuntarse dos veces con el mismo email en mayúsculas/minúsculas → una sola fila en `waitlist`; desde el SQL Editor con rol `anon`, `select` falla.
- **Ref.:** [screens.md](screens.md) 3; [spec.md](spec.md) 3.8; [database.md](database.md) 5 (waitlist).

### 2.5 [John] Procedimiento de invitación
- **Objetivo:** dejar escrito cómo se da de alta a alguien de la waitlist.
- **Tareas:** en `supabase/README.md`, sección "Invitar": consultar `waitlist` en el Table Editor; *Authentication → Users → Invite user* (envía el email de Supabase para fijar contraseña; el trigger crea `profiles`) o *Add user* con contraseña manual; borrar o marcar la fila de la waitlist a mano. Probar una vez con un segundo email propio.
- **Comprobación:** el segundo usuario entra y ve su armario vacío, sin ver el del primero (RLS).
- **Ref.:** [spec.md](spec.md) 3.8; [database.md](database.md) 7.

**Hecho cuando…**
- Login, logout, reseteo y waitlist funcionan en local y en la preview de Vercel, en móvil.
- Dos usuarios no se ven entre sí.
- Ningún texto de estas pantallas está fuera de `messages/`.

---

## Fase 3 — Catálogo

Objetivo: subir prendas con recorte en cola, listarlas, filtrarlas, editarlas, archivarlas (también en lote), eliminarlas, subida masiva con "por revisar" y la página de recorte en lote. Es la fase más larga.

### 3.1 Dominio compartido: huecos, tipos, temporadas, familia de color
- **Objetivo:** las listas cerradas y las funciones puras del dominio en un solo sitio, con tests.
- **Tareas:**
  - `src/lib/domain/slots.ts` (los 9 con `multi`, orden), `types.ts` (33 tipos → hueco), `seasons.ts`, `colors.ts` (13 familias de database.md). Deben coincidir con la semilla de 0.3 (test que compara con `garment_types` vía tipos generados o un JSON compartido `supabase/seed/types.json` que usen ambos).
  - `src/lib/imaging/colorFamily.ts`: hex → familia más cercana (distancia en un espacio perceptual, p. ej. Lab/OKLab; negro/blanco/gris por luminosidad y saturación). "Multicolor" no se deduce de un hex: ver decisión 2.
  - Tests Vitest: cada tipo tiene hueco; `#000000` → `black`, `#1e3a8a` → `blue`, `#f5deb3` → `beige`.
- **Archivos:** `src/lib/domain/*`, `src/lib/imaging/colorFamily.ts`, `*.test.ts`.
- **Comprobación:** `npm test` en verde.
- **Ref.:** [spec.md](spec.md) 2.1–2.3; [database.md](database.md) 2 y 3 (`color_family`).

### 3.2 API de prendas, marcas y etiquetas
- **Objetivo:** todas las rutas de prendas antes de tocar la UI.
- **Tareas:**
  - `GET /api/garments`: parámetros `archived`, `slot`, `type`, `brand`, `color`, `tags` (varias, **Y**: `having count(distinct tag_id) = N` o una subconsulta por etiqueta), `cursor`, `limit` (24 por defecto); devuelve filas + URLs firmadas de `thumb` (y `cutout` solo si se pide `include=cutout`) + `nextCursor`. También `counts` por hueco y totales en uso/archivadas (una ruta aparte `GET /api/garments/counts` si pesa).
  - `POST /api/garments/uploads`: comprueba el límite de 500 (`count` de `garments` del usuario + los que se van a crear), reserva `garment_id` y devuelve dos URLs firmadas de subida (`{user_id}/{id}/cutout.webp`, `thumb.webp`).
  - `POST /api/garments`: cuerpo `{ id, type_id, name?, seasons, color_hex?, brand?, tags: string[] }`; comprueba que los dos archivos existen en Storage, calcula `color_family`, crea/une etiquetas (`tags` por `lower(name)`, `garment_tags`), inserta. Si falla, borra los archivos.
  - `GET/PATCH/DELETE /api/garments/[id]`; `DELETE` borra primero los archivos de Storage. `GET /api/garments/[id]/usage` → `{ favorites: N, wouldEmpty: M }`.
  - `POST /api/garments/[id]/image`: nuevas URLs de subida sobre las mismas rutas (sobrescribir) + confirmación.
  - `POST /api/garments/archive`: `{ ids, archived }`.
  - `GET /api/brands` (distinct por usuario), `GET /api/tags` (con número de prendas).
  - Tests de integración ligeros con el usuario de prueba (script o Vitest contra la preview) para: límite 500, filtro de etiquetas con Y, RLS (un id ajeno → 404).
- **Archivos:** `src/app/api/garments/**`, `src/app/api/brands/route.ts`, `src/app/api/tags/route.ts`, `src/lib/api/garments.ts` (consultas).
- **Comprobación:** con `curl` o un script: crear 3 prendas con etiquetas, filtrar por dos etiquetas, archivar en lote, eliminar y ver que Storage queda limpio.
- **Ref.:** [architecture.md](architecture.md) 3, 4.1 y 6; [database.md](database.md) 3–6; [spec.md](spec.md) 3.1.

### 3.3 Cuadrícula del catálogo
- **Objetivo:** la pantalla 4 de screens.md con datos reales (sin filtros todavía).
- **Tareas:**
  - Cabecera con título, contador *"58 en uso · 3 archivadas"* y botón "Añadir" (abre la hoja de 3.7).
  - Control segmentado **En uso · Archivadas (N)**; fila de chips por hueco con número (ocultos los vacíos; "Todo" siempre).
  - Cuadrícula `garment-tile` (columnas automáticas, mín. 150 px): miniatura (lazy, `loading="lazy"` + `decoding="async"`), nombre o tipo, *hueco · marca*. Scroll paginado por cursor (observer al final de la lista).
  - Estados vacíos: sin prendas (ilustración + "Añadir tu primera prenda"), sin resultados, "Nada archivado".
  - Estado en un store de `zustand` (`features/catalog/store.ts`) para que filtros, selección y paginación convivan.
- **Archivos:** `src/app/(app)/catalog/page.tsx`, `src/features/catalog/{CatalogHeader,SlotChips,GarmentGrid,GarmentTile,EmptyStates}.tsx`, `store.ts`.
- **Comprobación:** con 60 prendas creadas por script (3.2), el scroll carga por páginas; el chip de hueco filtra; a 402 px no hay scroll horizontal; miniaturas tardan en cargar solo cuando entran en pantalla.
- **Ref.:** [screens.md](screens.md) 4; [spec.md](spec.md) 3.1 (rendimiento); [DESIGN.md](DESIGN.md) `garment-tile`.

### 3.4 Hoja de filtros
- **Objetivo:** filtrar por tipo (según hueco), marca y etiquetas (Y), con recuento en vivo.
- **Tareas:** botón "Filtros (N)"; hoja con secciones Tipo / Marca / Etiquetas en chips multiselección, nota sobre la Y, "Borrar" arriba y botón principal *"Ver 12 prendas"* (recuento con una llamada `limit=0` o `count=true`); filtros activos como chips quitables + "Borrar todo"; los filtros se guardan en la URL (`searchParams`) para sobrevivir a recargas y navegar atrás.
- **Archivos:** `src/features/catalog/{FiltersSheet,ActiveFilters}.tsx`, `store.ts`.
- **Comprobación:** dos etiquetas seleccionadas muestran solo las prendas que tienen ambas; cambiar de hueco reinicia los tipos; el recuento del botón coincide con lo que aparece.
- **Ref.:** [screens.md](screens.md) 4.1; [spec.md](spec.md) 3.1 (filtros con Y).

### 3.5 Procesado de imagen en el navegador
- **Objetivo:** las funciones puras de imagen que usan la subida, la subida masiva y el recorte en lote.
- **Tareas:** en `src/lib/imaging/`, partiendo de `pruebas/recorte/index.html`:
  - `shrink(file, 1200)` → `Blob` reducido (OffscreenCanvas; en Safari viejo, `canvas` normal).
  - `hasTransparency(blob)` → muestrea el canal alfa (bordes y una rejilla) para proponer "ya recortada".
  - `removeBackground(blob, onProgress)` → envuelve `@imgly/background-removal` (modelo `isnet_quint8`, `device: cpu`), con `preload()` y progreso de descarga del modelo (estado "Preparando el recorte (solo la primera vez)…"). Carga **dinámica** del módulo: solo cuando hay algo que recortar.
  - `toCutoutAndThumb(pngBlob)` → `cutout.webp` (lado máx. 1200, con alfa) y `thumb.webp` (lado máx. 320); recortar el alfa vacío alrededor de la prenda (bounding box) para que el collage escale bien.
  - Validación de entrada: solo `image/*`, ≤ 10 MB; HEIC: intentar decodificar y, si el navegador no puede, mensaje claro (ver decisión 12).
- **Archivos:** `src/lib/imaging/{shrink,transparency,removeBackground,encode,validate}.ts`.
- **Comprobación:** página temporal `/dev/imaging`: subir una foto, ver tiempos (reducir, recortar, codificar) y los dos WebP sobre cuadros; probar con un PNG ya transparente (`hasTransparency` → true).
- **Ref.:** [architecture.md](architecture.md) 4.1 (pasos 2–5) y 8 (prueba del 25-10); [screens.md](screens.md) 5.1–5.3 (textos de estado).

### 3.6 Cola de recorte global (IndexedDB + píldora + hoja)
- **Objetivo:** una sola cola de una foto cada vez, persistente en el dispositivo, visible desde cualquier pantalla.
- **Tareas:**
  - Base IndexedDB (`idb`) `bbscloset` con el almacén `pending`: `{ localId, kind: 'garment' | 'replace' | 'batch', createdAt, status: 'queued' | 'cutting' | 'ready' | 'error', progress, mode: 'cut' | 'as-is', source: Blob (reducida), cutout?: Blob, thumb?: Blob, garmentData?: {…formulario…}, garmentId?: string, needsReview?: boolean }`. Lo pendiente **nunca** toca el esquema de Supabase.
  - `features/queue/store.ts` (zustand) con la lista en memoria sincronizada con IndexedDB, y `features/queue/runner.ts`: un bucle que coge el primer `queued`, lo recorta (3.5), guarda `cutout`/`thumb` y pasa al siguiente. Pausa con `document.visibilityState === 'hidden'`; al volver sigue. Al arrancar la app, cualquier `cutting` vuelve a `queued` (foto a medias se repite).
  - **Subida automática:** cuando un item `kind: 'garment'` tiene `cutout` **y** `garmentData.type_id`, se sube (3.2: `uploads` → PUT a Storage → `POST /api/garments`) y se borra de IndexedDB. Los `kind: 'replace'` llaman a `/image`. Los `kind: 'batch'` nunca se suben. Reintentos con espera si no hay red.
  - `QueuePill` (`queue-pill`: *"Recortando 2 de 5"*, anillo de progreso) solo con items de prendas pendientes; `QueueSheet` con la lista (miniatura, nombre o *"Prenda nueva (sin guardar)"*, estado, "Cambiar foto" / "Quitar" en error), subtítulo *"2 de 5 listas · una foto cada vez"* y *"Mantén la app abierta mientras recorta."* Al acabar todo: toast *"5 prendas listas para el vestidor"*.
  - Montar el runner en el layout de `(app)` para que corra en cualquier pantalla.
- **Archivos:** `src/features/queue/{db,store,runner,upload}.ts`, `src/features/queue/{QueuePill,QueueSheet}.tsx`, `src/app/(app)/layout.tsx`.
- **Depende de:** 3.2 y 3.5.
- **Comprobación:** encolar 3 fotos desde `/dev/imaging`; la píldora cuenta; cambiar de pestaña del navegador pausa el progreso y al volver sigue; recargar en mitad de un recorte lo repite; cerrar y abrir el navegador conserva la cola.
- **Ref.:** [screens.md](screens.md) 6; [spec.md](spec.md) 3.1; [architecture.md](architecture.md) 4.1 ("Lo pendiente vive en el dispositivo") y 8 (limitación aceptada).

### 3.7 Añadir prenda: elegir foto y recortar / ya recortada
- **Objetivo:** pasos 5.1 y 5.2 de screens.md.
- **Tareas:**
  - Hoja a pantalla completa en móvil. Paso 1: botón "Elegir fotos" (`<input type="file" accept="image/*" multiple>`, sin `capture`), consejo fijo, errores en línea (formato, > 10 MB). Una foto → paso 2; varias → 3.12.
  - Paso 2: miniatura sobre cuadros o fondo `#d9d4cc`, nombre de archivo, texto de lo detectado, control segmentado **Quitar fondo · Ya está recortada** preseleccionado, ayuda bajo el control, `notice-inline` si elige "ya recortada" con fondo, botón "Continuar".
  - "Continuar" crea el item en la cola (3.6) con `mode` y abre 3.8. Cerrar la hoja sin guardar borra el item de la cola y su recorte.
- **Archivos:** `src/features/catalog/add/{AddGarmentSheet,PickPhotoStep,CutoutChoiceStep}.tsx`.
- **Comprobación:** con un PNG transparente la app preselecciona "Ya está recortada"; con una JPG, "Quitar fondo"; elegir "ya recortada" en una JPG muestra el aviso sin bloquear; cerrar la hoja deja la cola vacía.
- **Ref.:** [screens.md](screens.md) 5.1, 5.2; [spec.md](spec.md) 3.1; [architecture.md](architecture.md) 4.1 (paso 1).

### 3.8 Añadir prenda: datos mientras se recorta
- **Objetivo:** paso 5.3 de screens.md, con guardado antes de que acabe el recorte.
- **Tareas:**
  - Vista previa grande enlazada al item de la cola: la prenda va apareciendo (mostrar el `cutout` cuando llega; antes, la foto reducida atenuada con barra rosa) y la línea de estado con todos los textos de 5.3 (posición en cola, %, "Preparando el recorte…", "Fondo quitado…", "Ya recortada…", error con "Cambiar foto").
  - Campos: **Tipo** (chips agrupados por hueco, obligatorio), nombre (marcador *"Se mostrará como «Camisa» si lo dejas vacío"*), temporada (chips multivalor), color (`react-colorful` + muestra de la familia calculada, con "Quitar color"), marca (campo con sugerencias de `GET /api/brands`), etiquetas (chips + "Añade una etiqueta y pulsa Intro", sugerencias de `GET /api/tags` y las sugeridas iniciales, ver decisión 1).
  - Botón principal *"Añadir a {hueco}"* (deshabilitado con *"Elige un tipo para seguir"*). Al pulsar: guarda `garmentData` en el item de la cola; si el recorte ya está, la subida sale al momento; si no, el item queda *pendiente* y la cola lo sube al terminar. Toasts *"Añadida a Capa base."* + "Añadir otra" o *"Guardada. {prenda} estará lista cuando acabe el recorte."*
  - Enlace "Guardar y añadir otra" (vuelve a 5.1 sin cerrar).
  - Formulario y chips reutilizables para la ficha (3.10) y la revisión (3.12): `GarmentForm` con `mode: 'add' | 'edit' | 'review'`.
- **Archivos:** `src/features/catalog/add/GarmentDataStep.tsx`, `src/features/catalog/form/{GarmentForm,TypeChips,SeasonChips,ColorField,BrandField,TagsField}.tsx`.
- **Depende de:** 3.6.
- **Comprobación:** guardar con el recorte al 20 %: la hoja se cierra, la píldora sigue, y al terminar la prenda aparece en el catálogo con su miniatura y sus etiquetas creadas en `tags`; la marca escrita sale como sugerencia en la siguiente prenda.
- **Ref.:** [screens.md](screens.md) 5.3; [spec.md](spec.md) 2.3, 2.4, 3.1; [architecture.md](architecture.md) 2 (react-colorful).

### 3.9 Prendas pendientes en el catálogo
- **Objetivo:** que lo que aún se recorta se vea en la cuadrícula como "Recortando".
- **Tareas:** la cuadrícula fusiona los items locales de la cola (`kind: 'garment'` con `garmentData`) con las filas del servidor, al principio de la lista: miniatura atenuada al 40 %, `status-badge` "Recortando", subtítulo *"Recortando…"*; tocarla abre la hoja de la cola. Al subirse, se sustituye por la fila real sin salto visible. Los items de la subida masiva sin tipo **no** salen aquí (van a la franja de 3.12). El contador de cabecera solo cuenta lo del servidor (decisión 4).
- **Archivos:** `src/features/catalog/GarmentGrid.tsx`, `src/features/catalog/PendingTile.tsx`.
- **Comprobación:** con 2 prendas pendientes y 10 reales, la cuadrícula muestra 12; al terminar el recorte las 2 pasan a normales; en otro navegador no aparecen las pendientes (son locales).
- **Ref.:** [screens.md](screens.md) 4 (pendientes) y 6; [architecture.md](architecture.md) 4.1.

### 3.10 Ficha de prenda: editar, cambiar foto, archivar, eliminar
- **Objetivo:** pantalla 4.3 + flujo 5.4.
- **Tareas:**
  - Hoja "Editar prenda" con `GarmentForm` en modo `edit`, cargada de `GET /api/garments/[id]`; guardar → `PATCH`.
  - "Cambiar foto": reutiliza 5.1–5.2 y encola un item `kind: 'replace'` con `garmentId`; mientras tanto la prenda sigue usable con el recorte viejo; al terminar, `POST /api/garments/[id]/image` sobrescribe y la miniatura se refresca (invalidar URLs firmadas).
  - "Archivar" / "Volver a usar" con toast *"Archivada. Sigue en tus favoritos pero sale del vestidor."* + "Deshacer".
  - "Eliminar prenda": pedir `usage` primero y mostrar el diálogo con *"Aparece en N favoritos"* y, si procede, *"esto eliminará también M favoritos que quedarían vacíos"*; confirmar → `DELETE`.
- **Archivos:** `src/features/catalog/edit/{GarmentSheet,DeleteDialog,ChangePhoto}.tsx`.
- **Depende de:** favoritos no existen aún; `usage` devolverá 0 hasta la fase 5. Volver a probar el diálogo en 5.5.
- **Comprobación:** editar nombre y etiquetas se refleja en la cuadrícula; cambiar foto mantiene el id y la miniatura cambia al terminar; archivar la mueve a la vista Archivadas y "Deshacer" la devuelve; eliminar borra la fila y los dos archivos del bucket.
- **Ref.:** [screens.md](screens.md) 4.3, 5.4; [spec.md](spec.md) 2.5, 3.1, 3.4; [database.md](database.md) 6.

### 3.11 Archivar en lote
- **Objetivo:** pantalla 4.2.
- **Tareas:** enlace "Seleccionar" en la cabecera → modo selección (círculo marcable en cada tarjeta, "Seleccionar todo" que respeta hueco y filtros activos: pedir a la API los ids con los filtros vigentes), barra inferior *"3 seleccionadas · Archivar"* (o "Desarchivar" en Archivadas) + "Cancelar"; confirmar → `POST /api/garments/archive`; toast con "Deshacer" (misma ruta con `archived` invertido).
- **Archivos:** `src/features/catalog/{SelectionBar,GarmentTile}.tsx`, `store.ts`.
- **Comprobación:** filtrar por "Capa exterior", seleccionar todo, archivar: solo esas pasan a Archivadas; "Deshacer" las devuelve.
- **Ref.:** [screens.md](screens.md) 4.2; [spec.md](spec.md) 3.1; [database.md](database.md) 8 (archivado en lote).

### 3.12 Subida masiva y "por revisar"
- **Objetivo:** pantallas 5.5 y 4.4.
- **Tareas:**
  - Tras elegir varias fotos (≤ 30; si son más, avisar y coger las 30 primeras): pantalla resumen con cuadrícula de miniaturas y lo detectado en cada una, control segmentado aplicado a todas ("Quitar fondo a todas" / "Ya están recortadas"), tocar una miniatura cambia solo esa. Comprobar contra el límite de 500 (decisión 3) y avisar de cuántas entran.
  - Botón *"Añadir 12 fotos"*: crea 12 items `kind: 'garment'` con `needsReview: true` y sin `garmentData`; cierra la hoja. La cola los recorta en orden.
  - Franja en el catálogo *"12 prendas por revisar · Revisar"* (cuenta los items locales con `needsReview`).
  - Hoja de revisión de una en una: recorte en grande (o su estado), `GarmentForm` en modo `review` (Tipo arriba, "Más datos" plegado), *"3 de 12"*, botón *"Guardar y siguiente"* (activo al elegir tipo; guarda `garmentData` y quita `needsReview` → la cola la sube cuando tenga recorte), "Saltar" (sigue en la franja), "Descartar foto" (borra el item). Al terminar: *"12 prendas añadidas."*
- **Archivos:** `src/features/catalog/add/BulkSummaryStep.tsx`, `src/features/catalog/review/{ReviewBanner,ReviewSheet}.tsx`.
- **Depende de:** 3.6, 3.8.
- **Comprobación:** subir 5 fotos; la píldora dice "Recortando 1 de 5"; revisar 3 y saltar 2; la franja muestra "2 por revisar"; cerrar la app y volver: la cola y la franja siguen; las 3 revisadas aparecen en el catálogo cuando acaba su recorte.
- **Ref.:** [screens.md](screens.md) 5.5, 4.4; [spec.md](spec.md) 3.1 (subida masiva); [architecture.md](architecture.md) 4.1.

### 3.13 Página "Recortar fotos" (lote con descarga)
- **Objetivo:** pantalla 13 completa, compartiendo la cola.
- **Tareas:**
  - Estados vacía / procesando / terminado según 13.1–13.3; "Añadir fotos" (hasta 30); cuadrícula 3/4/6 columnas con estados *En cola*, *recortando* (barra negra), *lista* (sobre cuadros), *error* (etiqueta negra; tocar ofrece quitarla). Soltar archivos (drag & drop) en escritorio.
  - Los items son `kind: 'batch'` en la misma cola (3.6): no cuentan para la píldora de prendas, no se suben nunca. Viven **solo en memoria** mientras la página está abierta (decisión 13).
  - Hoja de detalle: recorte en grande, *"PNG con transparencia"*, "Quitar", "Descargar PNG" (el `cutout` recodificado a PNG).
  - *"Descargar todas (N PNG)"*: ZIP generado en el cliente con `client-zip` (streaming, sin cargar todo en memoria); en móvil, si `navigator.canShare({ files })`, ofrecer compartir/guardar en Fotos.
  - "Empezar de nuevo" con confirmación; salir de la página sin descargar pide confirmación (*"¿Salir sin descargar? Se perderán."*). En móvil, enlace "‹ Ajustes".
- **Archivos:** `src/app/(app)/cutout/page.tsx`, `src/features/cutout/{Dropzone,BatchGrid,BatchDetailSheet,zip.ts}.tsx`.
- **Depende de:** 3.6.
- **Comprobación:** 10 fotos → ZIP con 10 PNG transparentes que se abren en el visor del sistema; una foto de error se puede quitar; con prendas pendientes a la vez, la cola alterna en orden de llegada y la píldora solo cuenta las prendas.
- **Ref.:** [screens.md](screens.md) 13; [spec.md](spec.md) 3.1 y 4 (punto 8); [architecture.md](architecture.md) 9 (punto 3).

### 3.14 Prueba del recorte en móvil real y decisión sobre hilos
- **Objetivo:** saber cuánto tarda el recorte en el móvil de la clienta (o uno parecido) y si hace falta tocar algo.
- **Tareas:**
  - Desde la preview de Vercel, en un Android de gama media y un iPhone: medir descarga del modelo (primera vez), tiempo por foto, consumo de memoria con 10 fotos en cola, comportamiento al bloquear la pantalla y al cambiar de app (pausa/continúa).
  - Si es inaceptable (> 60 s por foto o cierres por memoria): probar **COOP/COEP** (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` en `next.config.ts` → `crossOriginIsolated` → hilos WASM). **Riesgo:** con COEP, toda imagen de otro origen (las URLs firmadas de Supabase) debe cargarse con `crossorigin="anonymous"` y el bucket debe responder CORS; comprobar también que Konva sigue pudiendo exportar (lienzo no "contaminado"). Si rompe las fotos, descartar y anotar el plan B (recorte en servidor, después de la v1).
  - Anotar resultados en [next-steps.md](next-steps.md) (*Pendiente menor → Recorte*).
- **Comprobación:** tabla con tiempos por dispositivo y decisión escrita.
- **Ref.:** [architecture.md](architecture.md) 8 (quitar fondo, limitación aceptada); [next-steps.md](next-steps.md); [open-questions.md](open-questions.md) *Cierre del 25-10-2026*.

**Hecho cuando…**
- Desde el móvil: subir una prenda (cámara o galería), elegir recortar o ya recortada, rellenar datos y guardar antes de que acabe; aparece en el catálogo al terminar.
- Catálogo con 100+ prendas: scroll paginado fluido, chips por hueco, filtros con Y, vistas en uso/archivadas.
- Editar, cambiar foto, archivar (individual y en lote), eliminar con aviso.
- Subida masiva de 20 fotos → por revisar → revisadas de una en una; la cola sobrevive a cerrar la app.
- Recorte en lote con ZIP descargado en móvil y escritorio.
- Tiempos de recorte medidos en móvil real y decisión tomada.

---

## Fase 4 — Vestidor

Objetivo: el lienzo Konva con colocación automática, panel inferior de tres alturas, regla de huecos, aleatorios con candados, deshacer/rehacer y borrador en localStorage.

### 4.1 Modelo del lienzo y regla de huecos (funciones puras)
- **Objetivo:** toda la lógica del outfit sin UI, con tests.
- **Tareas:**
  - `features/dresser/model.ts`: `CanvasItem = { garmentId, slotId, x, y, scale, rotation, z, locked, manual, placedAt }`; `CanvasState = { items }`.
  - Reductores puros: `place(state, garment, jewelryMax)` (mismo hueco sustituye; `full_body` quita `base_layer` y `bottom` y viceversa; joyería hasta `jewelryMax`, sustituyendo la más antigua; devuelve también qué se ha quitado para el toast), `remove`, `toggleLock`, `bringForward` / `sendBackward`, `resetManual`.
  - Devuelve "eventos" para la UI: `{ replaced: [...], removedByFullBody: [...], jewelryDropped }`.
  - Tests: pantalón + short → uno; camiseta + jersey → dos; vestido quita camiseta y pantalón; 4.ª joya con máximo 3 quita la primera; candado no afecta a `place`.
- **Archivos:** `src/features/dresser/model.ts`, `model.test.ts`.
- **Comprobación:** `npm test` en verde con los casos de spec 2.1.
- **Ref.:** [spec.md](spec.md) 2.1, 3.2; [architecture.md](architecture.md) 4.2.

### 4.2 Colocación automática
- **Objetivo:** cualquier combinación de huecos ocupados produce un collage equilibrado, sin plantillas a mano.
- **Tareas:**
  - `src/lib/layout/autoLayout.ts`: entrada = huecos ocupados (con nº de joyas) + tamaño del lienzo + `size_weight` y `default_z` de `slots`; salida = `{ x, y, scale, z }` por item. Enfoque: columna central para el cuerpo (exterior/media/base o cuerpo entero arriba, inferior debajo, calzado abajo), columna lateral para bolso, joyería y accesorios; los huecos vacíos no dejan hueco (se redistribuye el alto); escala relativa al peso y al alto disponible; mantiene las proporciones reales del recorte (usar su `width/height`).
  - Los `size_weight` / `default_z` se leen una vez de `slots` (ruta `GET /api/slots` o incluidos en `/api/me`) y se cachean en el cliente; si hay que ajustarlos, se cambian en una migración nueva.
  - Página temporal `/dev/layout` que pinta rectángulos por cada combinación de huecos (2^9 son muchas; probar las 20 más típicas) para afinar pesos. Ajustar los valores de la semilla de 0.3 con una migración `0008_tune_layout.sql` si hace falta.
  - Tests: ningún item se sale del lienzo; con y sin bolso el resto se recoloca; joyas × 3 caben.
- **Archivos:** `src/lib/layout/autoLayout.ts`, `autoLayout.test.ts`, `src/app/api/slots/route.ts`, `src/app/dev/layout/page.tsx` (temporal).
- **Comprobación:** en `/dev/layout` las 20 combinaciones se ven equilibradas a 402 px y a 1280 px.
- **Ref.:** [spec.md](spec.md) 3.3 (colocación automática); [architecture.md](architecture.md) 4.2 y 8; [database.md](database.md) 2 (`size_weight`, `default_z`); [open-questions.md](open-questions.md) (datos semilla).

### 4.3 Lienzo Konva: mover, redimensionar, rotar, orden, candado
- **Objetivo:** el componente de lienzo que comparten vestidor y detalle del favorito.
- **Tareas:**
  - Instalar `konva` y `react-konva`; importar el lienzo con `next/dynamic` (`ssr: false`).
  - `features/dresser/canvas/OutfitCanvas.tsx`: `Stage` que llena el contenedor (ResizeObserver), fondo `#f5f5f7` con esquinas 18 px, una `Image` por item (carga con `crossOrigin="anonymous"` desde la URL firmada del `cutout`; miniaturas no), sombra de producto solo bajo la prenda.
  - Selección: `Transformer` con tiradores negros, tirador de giro y anclas de 44 px en táctil; arrastre; bloqueo de proporciones. Gestos de dos dedos (pellizco = escala, giro = rotación) implementados a mano sobre `touchmove` (Konva no lo trae en el Transformer).
  - Al transformar un item: `manual = true`; `onChange` emite el nuevo estado (el padre decide si va al historial).
  - Barra bajo el lienzo al seleccionar: "Traer delante · Enviar atrás · Quitar"; candado sobre la prenda seleccionada (icono negro; bloqueada = relleno rosa con borde negro).
  - Props: `items`, `garments` (urls y tamaños), `editable`, `onChange`, `onSelect`; sin ninguna dependencia del panel ni de los aleatorios.
- **Archivos:** `src/features/dresser/canvas/{OutfitCanvas,GarmentNode,useTouchGestures,SelectionBar}.tsx`.
- **Depende de:** 4.2 (para las posiciones iniciales).
- **Comprobación:** en móvil: arrastrar, pellizcar, girar con dos dedos y con el tirador; en escritorio lo mismo con ratón; "Traer delante" cambia el orden; las imágenes cargan sin error de CORS en la consola.
- **Ref.:** [spec.md](spec.md) 3.3 (edición directa), 6.1; [screens.md](screens.md) 7.1; [DESIGN.md](DESIGN.md) *Elevation* (sombra de producto).

### 4.4 Panel de prendas: tres alturas y pantalla partida; escritorio
- **Objetivo:** pantalla 7.3 y 7.4.
- **Tareas:**
  - `BottomDrawer` con estados `closed` / `half` / `expanded` (por defecto `half`): barrita de 36 × 5 px dentro de un botón de 24 px de alto (tap sube un nivel; desde `expanded` baja; teclado igual); arrastre vertical con umbral de 24 px. En `expanded`, **pantalla partida**: lienzo ~42 % / panel ~58 %, se ocultan los botones de aleatorio; el lienzo se reajusta (recolocación automática de los items no manuales).
  - Cabecera del panel: selector de categoría ("Capa base ▾" con número) que abre una lista con fondo rosa en la activa; enlace "Ver prendas" / "Ver todo (N)" / "Mostrar menos".
  - Cuadrícula de 4 columnas (`garment-tile`), una fila en `half`, scroll vertical en `expanded`. Solo prendas en uso (no archivadas ni pendientes). La que está en el lienzo lleva borde negro de 2 px; tocarla otra vez la quita. **Tocar una prenda no mueve el panel.**
  - Categoría vacía: *"Todavía no tienes {tops} en uso."* + "Añadir una" (abre 3.7).
  - Datos: cargar la lista completa de prendas en uso por categoría con `GET /api/garments?archived=false&slot=…` (miniaturas firmadas) y cachear por sesión; con 500 prendas, paginar dentro del panel.
  - Escritorio (≥ 1024 px): panel fijo a la derecha de 340 px, *"Tu armario"*, chips de categoría y 3 columnas.
- **Archivos:** `src/features/dresser/panel/{BottomDrawer,CategoryPicker,PanelGrid,DesktopPanel}.tsx`, `src/features/dresser/store.ts`.
- **Depende de:** 4.1, 4.3.
- **Comprobación:** en móvil, con el panel extendido, tocar 5 prendas seguidas las va poniendo/sustituyendo sin que el panel se mueva; arrastrar cambia de nivel; no hay scroll horizontal en ningún estado; en escritorio el panel es fijo.
- **Ref.:** [screens.md](screens.md) 7.3, 7.4; [DESIGN.md](DESIGN.md) `bottom-drawer`, `split-view`, `garment-tile`; [spec.md](spec.md) 3.2.

### 4.5 Aleatorios, candados y categorías predeterminadas
- **Objetivo:** pantalla 7.2 con las reglas de spec 3.2.
- **Tareas:**
  - `features/dresser/random.ts` (puro, con tests): `substitute(state, pool, rng)` cambia cada item no bloqueado por otro de su mismo hueco **sin repetir el actual** (si solo hay uno, se queda); `randomOutfit(pool, randomSlots, jewelryMax, rng)` vacía y coloca una prenda por categoría predeterminada; vestidos: si `full_body` está entre las predeterminadas y sale, sustituye a base e inferior (ver decisión 9); devuelve las categorías vacías.
  - Fila bajo el lienzo: **Sustituir** (secundario; atenuado con lienzo vacío o todo bloqueado) · **Outfit aleatorio** (principal) · botón redondo de ajustes que despliega los chips de categorías (*"El outfit aleatorio coge una prenda de cada:"*; activo en negro) y guarda con `PATCH /api/me` (`random_slots`).
  - Toasts: *"El vestido ha sustituido a la camiseta y el pantalón."* + "Deshacer"; *"Hasta 3 joyas. Se ha quitado {la más antigua}."* + "Deshacer"; *"Todavía no tienes bolsos"* + "Añadir uno" (abre 3.7).
  - El resultado se edita a mano sin restricción. Al sustituir, la prenda nueva se coloca en la posición automática de su hueco, salvo que el item sustituido tuviera ajustes manuales: entonces hereda `x, y, scale, rotation`.
- **Archivos:** `src/features/dresser/random.ts`, `random.test.ts`, `src/features/dresser/{RandomBar,RandomSlotsConfig}.tsx`.
- **Depende de:** 4.1, 4.4.
- **Comprobación:** con 2 camisetas, pulsar "Sustituir" 10 veces alterna siempre; con el pantalón bloqueado solo cambia el resto; "Outfit aleatorio" sin bolsos avisa con enlace; cambiar las categorías persiste al recargar.
- **Ref.:** [spec.md](spec.md) 3.2; [screens.md](screens.md) 7.2; [database.md](database.md) 3 (`random_slots`); [open-questions.md](open-questions.md) *Vestidor y aleatorio*.

### 4.6 Deshacer / rehacer, borrador en localStorage y "Colocación automática"
- **Objetivo:** historial de sesión y persistencia por dispositivo.
- **Tareas:**
  - Historial en memoria (`past[]`, `present`, `future[]`) en el store del vestidor; cada acción discreta (poner, quitar, sustituir, outfit aleatorio, fin de un arrastre/transformación, cambio de orden, candado) empuja un estado. Iconos **Deshacer · Rehacer** en la cabecera, atenuados cuando no aplican.
  - Borrador: cada cambio de `present` se escribe en `localStorage['bbscloset:draft:{user_id}']` (sin imágenes, solo ids y posiciones). Al entrar se restaura; las prendas que ya no existen o están archivadas se descartan en silencio (decisión 10). El historial **no** se guarda.
  - Botón **"Colocación automática"** arriba a la derecha del lienzo, visible solo si algún item tiene `manual = true`: pone todos a automático (entra en el historial).
  - Guardar en favoritos · Guardar como imagen en la cabecera: de momento atenuados; se activan en 5.2 y 6.2.
- **Archivos:** `src/features/dresser/{history,draft}.ts`, `src/features/dresser/DresserHeader.tsx`, `src/app/(app)/dresser/page.tsx`.
- **Comprobación:** mover una prenda, deshacer, rehacer; recargar la página conserva el outfit pero no el historial; cerrar el navegador y volver conserva el outfit; archivar una prenda del borrador desde el catálogo y volver al vestidor la quita.
- **Ref.:** [spec.md](spec.md) 3.2 (persistencia), 3.3 (deshacer, colocación automática); [screens.md](screens.md) 7.1; [architecture.md](architecture.md) 4.2.

### 4.7 Estados vacíos, cabecera y pulido del vestidor en móvil
- **Objetivo:** cerrar la pantalla 7 completa y que vaya fluida con un armario grande.
- **Tareas:** texto de lienzo vacío (*"Un lienzo en blanco — toca una prenda de abajo o prueba Outfit aleatorio."*) y de armario vacío (+ "Añadir una prenda"); el vestidor es la pantalla de inicio tras el login; carga diferida de los `cutout` solo de las prendas en el lienzo; miniaturas en el panel; medir FPS al arrastrar en móvil con 8 prendas en el lienzo; `will-change` y `pixelRatio` del Stage ajustado en móviles de gama media.
- **Comprobación:** con 300 prendas en el armario, abrir el vestidor tarda < 2 s en la preview desde móvil; arrastrar es fluido; los textos vacíos aparecen cuando toca.
- **Ref.:** [screens.md](screens.md) 7.1 y 1; [spec.md](spec.md) 7 (criterios de éxito).

**Hecho cuando…**
- Criterios de éxito de [spec.md](spec.md) sec. 7 sobre el vestidor: clicar coloca, mismo hueco sustituye, nunca combinaciones imposibles, aleatorios con candados y sin repetir, gestos táctiles y ratón a la par, borrador sobrevive a recargas, collage equilibrado con cualquier combinación.
- Panel de tres alturas con pantalla partida sin scroll horizontal; escritorio con panel fijo.
- Deshacer/rehacer y "Colocación automática" funcionan.

---

## Fase 5 — Favoritos

Objetivo: guardar el lienzo tal cual, listarlo, abrir el detalle y recolocar con guardado explícito; borrado de prendas coherente con los favoritos.

### 5.1 API de favoritos
- **Objetivo:** rutas CRUD con las posiciones por prenda.
- **Tareas:** `POST /api/favorites` `{ name?, items: [{ garment_id, x?, y?, scale?, rotation?, z? }] }` (una transacción: `favorites` + `favorite_items`; `null` = colocación automática); `GET /api/favorites` (lista con `created_at`, nº de prendas y los items con miniaturas firmadas para el mini collage); `GET /api/favorites/[id]` (items con `cutout` firmado); `PATCH /api/favorites/[id]` (nombre y/o posiciones: reemplaza las filas de items del mismo favorito); `DELETE`. Rechazar prendas ajenas (la RLS ya lo hace; la API responde 400 claro).
- **Archivos:** `src/app/api/favorites/**`, `src/lib/api/favorites.ts`.
- **Comprobación:** crear un favorito con 3 prendas y una posición nula; `GET` lo devuelve; `PATCH` cambia posiciones; `DELETE` deja `favorite_items` vacío.
- **Ref.:** [database.md](database.md) 3 (`favorites`, `favorite_items`); [architecture.md](architecture.md) 4.3; [spec.md](spec.md) 3.4.

### 5.2 Guardar en favoritos desde el vestidor
- **Objetivo:** hoja 8 de screens.md.
- **Tareas:** activar el icono de la cabecera (atenuado con lienzo vacío); hoja con vista previa del collage (el mismo `OutfitCanvas` no editable, a escala), campo Nombre opcional con marcador *"Si lo dejas vacío, se guarda como 14 nov 2026."*, botón "Guardar favorito" → `POST` con las posiciones (`null` en los items sin `manual`); toast *"Guardado en Favoritos."* + "Ver". No se comprueban duplicados.
- **Archivos:** `src/features/favorites/SaveFavoriteSheet.tsx`, `src/features/dresser/DresserHeader.tsx`.
- **Depende de:** 4.6, 5.1.
- **Comprobación:** guardar el mismo outfit dos veces crea dos favoritos; uno con una prenda movida a mano guarda `x, y` y las demás a `null`.
- **Ref.:** [screens.md](screens.md) 8; [spec.md](spec.md) 3.4 (guardar, duplicados).

### 5.3 Listado de favoritos
- **Objetivo:** pantalla 10.
- **Tareas:** título, contador (*"3 outfits guardados"*), enlace "Editar" ↔ "Hecho"; cuadrícula de tarjetas con **mini collage** (render ligero en cliente: `autoLayout` + posiciones guardadas sobre miniaturas con CSS `transform`, sin Konva, ver decisión 8), nombre o fecha, *fecha · N prendas*; modo Editar con "Eliminar" por tarjeta y diálogo *"Las prendas siguen en tu armario."*; estado vacío con "Abrir el vestidor".
- **Archivos:** `src/app/(app)/favorites/page.tsx`, `src/features/favorites/{FavoriteCard,MiniCollage}.tsx`.
- **Comprobación:** 5 favoritos se listan en orden de creación descendente; eliminar uno pide confirmación; vacío muestra el estado vacío.
- **Ref.:** [screens.md](screens.md) 10; [spec.md](spec.md) 3.4 (listado).

### 5.4 Detalle del favorito con guardar / cancelar
- **Objetivo:** pantalla 11.
- **Tareas:** enlace "‹ Favoritos", título (nombre o fecha), subtítulo *"Guardado el … · N prendas"*, icono "Guardar como imagen" (activo en 6.2); `OutfitCanvas` editable **sin panel**; ayuda bajo el lienzo; al primer cambio aparece la barra **"Cambios sin guardar · Cancelar · Guardar"**; Guardar → `PATCH` (posiciones de todos los items, `null` si no son manuales); Cancelar → vuelve al último guardado; salir con cambios (navegación interna o `beforeunload`) pide *"¿Descartar cambios?"*. Sin autoguardado ni localStorage aquí.
- **Archivos:** `src/app/(app)/favorites/[id]/page.tsx`, `src/features/favorites/{FavoriteDetail,UnsavedBar,useLeaveGuard}.tsx`.
- **Depende de:** 4.3, 5.1.
- **Comprobación:** mover una prenda, pulsar la pestaña Catálogo → diálogo; cancelar vuelve a la posición; guardar y recargar mantiene la nueva; no se puede añadir ni quitar prendas.
- **Ref.:** [screens.md](screens.md) 11; [spec.md](spec.md) 3.4 (detalle, guardado explícito).

### 5.5 Borrar prendas y favoritos: coherencia
- **Objetivo:** que borrar una prenda nunca sorprenda.
- **Tareas:** volver al diálogo de 3.10 con `usage` real: *"Aparece en N favoritos"* y *"esto eliminará también M favoritos que quedarían vacíos"*; comprobar que el trigger borra el favorito vacío y que el detalle de un favorito al que le falta una prenda se recompone (decisión 7: mantener posiciones manuales del resto o volver a automático); un favorito cuya prenda se archiva la sigue mostrando; el borrador del vestidor con una prenda borrada la descarta (4.6).
- **Comprobación:** favorito con 1 prenda → borrar la prenda avisa "eliminará también 1 favorito" y el favorito desaparece; favorito con 3 → queda con 2 y se ve bien.
- **Ref.:** [spec.md](spec.md) 2.5, 3.4 (prenda eliminada); [database.md](database.md) 3 (trigger, cascade).

**Hecho cuando…**
- Guardar, listar, abrir, recolocar con guardar/cancelar y eliminar favoritos funciona en móvil.
- Borrar una prenda avisa correctamente y los favoritos quedan coherentes; archivar no los toca.

---

## Fase 6 — Exportar a imagen

Objetivo: PNG del collage tal cual se ve, en 1:1, 4:5 y 9:16, generado en el navegador, sin marca de agua.

### 6.1 Render de exportación
- **Objetivo:** una función que, dado el estado del lienzo y la proporción, devuelve el PNG.
- **Tareas:** `features/export/renderPng.ts`: calcula la caja que envuelve todas las prendas (con rotación), la reescala **sin recolocar** para encajar en el tamaño destino con márgenes (1080 × 1080, 1080 × 1350, 1080 × 1920; ver decisión 11), pinta en un `Stage` de Konva fuera de pantalla con los `cutout` a resolución completa (cargados con `crossOrigin="anonymous"`) y el fondo `#f5f5f7`, y devuelve `stage.toDataURL({ pixelRatio })` → `Blob`. Reutiliza `GarmentNode` para que pantalla y exportación compartan renderizado.
- **Archivos:** `src/features/export/renderPng.ts`, `renderPng.test.ts` (solo la geometría).
- **Comprobación:** un outfit con una prenda girada exporta en las tres proporciones y la composición es idéntica a la de pantalla; sin error "tainted canvas" en la consola.
- **Ref.:** [spec.md](spec.md) 3.5; [architecture.md](architecture.md) 4.4; [open-questions.md](open-questions.md) *Exportación*.

### 6.2 Hoja "Guardar como imagen"
- **Objetivo:** pantalla 9, desde el vestidor y desde el detalle del favorito.
- **Tareas:** tres tarjetas **Cuadrado 1:1 · Vertical 4:5 · Story 9:16** con icono de la forma; vista previa del resultado (render a baja resolución); línea técnica *"PNG · 1080 × 1350 px · sin marca de agua"*; botón "Descargar PNG" (`<a download>`; en iOS Safari, si `canShare({ files })`, abrir la hoja de compartir para guardar en Fotos; si no, abrir en nueva pestaña con instrucción breve). Activar los iconos de la cabecera en ambas pantallas.
- **Archivos:** `src/features/export/ExportSheet.tsx`, `src/features/dresser/DresserHeader.tsx`, `src/features/favorites/FavoriteDetail.tsx`.
- **Depende de:** 6.1.
- **Comprobación:** en Android se descarga; en iPhone se guarda en Fotos; en escritorio se descarga; el nombre del archivo lleva el nombre del favorito o la fecha.
- **Ref.:** [screens.md](screens.md) 9; [spec.md](spec.md) 3.5.

**Hecho cuando…**
- Exportar desde vestidor y favorito en las tres proporciones, en Android, iPhone y escritorio, sin marca de agua y manteniendo los ajustes manuales.

---

## Fase 7 — Ajustes y pulido

Objetivo: la página de Ajustes completa, idioma de punta a punta, accesibilidad, robustez y limpieza antes de enseñarlo.

### 7.1 API de etiquetas y perfil
- **Objetivo:** lo que falta de API para Ajustes.
- **Tareas:** `PATCH /api/tags/[id]` (renombrar; choque con otra etiqueta del mismo usuario → 409 con mensaje, o fusionar si John lo prefiere), `DELETE /api/tags/[id]` (devuelve cuántas prendas afectaba); `GET /api/tags` ya devuelve el nº de prendas; `PATCH /api/me` ya cubre idioma y joyería (1.5).
- **Archivos:** `src/app/api/tags/[id]/route.ts`.
- **Comprobación:** renombrar "curro" a "trabajo" cambia el nombre en todas sus prendas; borrar "fiesta" quita las filas de `garment_tags`.
- **Ref.:** [spec.md](spec.md) 2.4, 3.6; [database.md](database.md) 3 (`tags`).

### 7.2 Página de Ajustes
- **Objetivo:** pantalla 12.
- **Tareas:** grupos tipo lista con fondo gris claro:
  - **Etiquetas:** lista con nº de prendas, "Renombrar" en línea (Guardar/Cancelar) y "Eliminar" con diálogo que dice a cuántas afecta; nota del pie.
  - **Vestidor:** *"Joyas a la vez"* con − / + (1–10, 3 por defecto) → `PATCH /api/me`.
  - **Idioma:** control segmentado English · Español → `PATCH /api/me` + cookie `locale` + recarga de mensajes.
  - **Herramientas:** fila "Recortar fotos ›" con su nota.
  - **Cuenta:** email en solo lectura y "Cerrar sesión" (2.2).
- **Archivos:** `src/app/(app)/settings/page.tsx`, `src/features/settings/{TagsSection,DresserSection,LanguageSection,ToolsSection,AccountSection}.tsx`.
- **Comprobación:** cambiar el idioma cambia toda la app, incluidos huecos y tipos, y persiste en otro dispositivo; subir joyas a 5 permite 5 joyas en el vestidor.
- **Ref.:** [screens.md](screens.md) 12; [spec.md](spec.md) 3.6.

### 7.3 Idioma de punta a punta
- **Objetivo:** ES y EN completos y revisados.
- **Tareas:** recorrer todas las pantallas en los dos idiomas; completar `en.json` (los textos del prototipo están en inglés y sirven de base) y `es.json` (los de screens.md); fechas (`14 nov 2026` / `Nov 14, 2026`), plurales (*"1 prenda" / "2 prendas"*, *"3 outfits guardados"*), nombres de huecos y tipos; lo que escribe el usuario no se traduce. Script que detecta claves que faltan en uno de los dos archivos.
- **Comprobación:** el script no encuentra claves huérfanas; captura de cada pantalla en EN sin un texto en castellano.
- **Ref.:** [spec.md](spec.md) 3.6; [screens.md](screens.md) *Pendiente* (textos definitivos).

### 7.4 Accesibilidad y foco
- **Objetivo:** cumplir las reglas de DESIGN.md en toda la app.
- **Tareas:** foco visible negro en todo lo interactivo; objetivos ≥ 44 px (barrita del panel, candado, tiradores); `aria-live` en toasts y en la píldora de la cola; diálogos y hojas con foco atrapado y cierre con Escape; etiquetas en todos los campos; contraste comprobado (nada de rosa como texto); `prefers-reduced-motion` en animaciones del panel.
- **Comprobación:** recorrer catálogo, añadir prenda y ajustes solo con teclado; Lighthouse accesibilidad ≥ 95 en móvil.
- **Ref.:** [DESIGN.md](DESIGN.md) *Brand & Accent*, *Touch Targets*; [screens.md](screens.md) 7.3 (barrita accesible).

### 7.5 Pulido visual contra el prototipo
- **Objetivo:** que cada pantalla se parezca a lo acordado con la clienta.
- **Tareas:** comparar pantalla a pantalla con `design/prototype/bbs closet.dc.html` a 402 / 834 / 1280; auditoría de la regla rosa/negro (buscar `#f0d7d7` fuera de fondos); sombras solo bajo recortes; radios y tipografía de los tokens; borrar las páginas `/dev/*`; icono de la PWA definitivo si ya existe.
- **Comprobación:** lista de diferencias anotada y resuelta; `grep` de hexadecimales sueltos en `src/` devuelve solo `tokens.css`.
- **Ref.:** [DESIGN.md](DESIGN.md) *Do's and Don'ts*; [screens.md](screens.md) (cada sección).

### 7.6 Robustez y límites
- **Objetivo:** que fallar no rompa nada.
- **Tareas:** estados de error y carga en todas las listas (esqueletos); sin red → toast y reintento (la cola de recorte espera); 401 → login; límite de 500 → mensaje claro en añadir y en subida masiva; URLs firmadas caducadas (1 h) → refresco automático con `POST /api/images/sign` al fallar una imagen; comportamiento cuando Supabase está pausado (plan Free, ~1 semana sin uso): pantalla "No se puede conectar" + instrucción para John en `supabase/README.md`; `localStorage`/IndexedDB llenos o bloqueados (modo privado) → la app sigue funcionando sin borrador ni cola, con aviso.
- **Comprobación:** simular sin red en DevTools; borrar la cookie; pausar y reanudar el proyecto de Supabase.
- **Ref.:** [architecture.md](architecture.md) 7 (límites), 4.1 (URLs firmadas).

### 7.7 Tests y CI
- **Objetivo:** red mínima para no romper lo hecho.
- **Tareas:** Vitest para el dominio (3.1, 4.1, 4.2, 4.5, 6.1) y los helpers de API; GitHub Actions (gratis) con `lint`, `typecheck`, `test` y `build` en cada push a `develop` y `main`; opcional: 2–3 pruebas Playwright de humo contra la preview (login, subir prenda "ya recortada", guardar favorito) que se lanzan a mano.
- **Archivos:** `.github/workflows/ci.yml`, `vitest.config.ts`.
- **Comprobación:** la acción pasa en verde en `develop`.
- **Ref.:** [architecture.md](architecture.md) 1 (stack aburrido).

**Hecho cuando…**
- Ajustes completo; ES/EN sin huecos; accesible con teclado; sin `/dev/*`; CI en verde; errores de red, sesión y límites con mensajes claros.

---

## Fase 8 — Despliegue y prueba con la clienta

Objetivo: v1 en producción, instalada en el móvil de la clienta, con sus prendas reales, y una lista de ajustes tras la primera semana.

### 8.1 [John] Producción
- **Tareas:** variables de entorno de *Production* en Vercel (mismas que preview, mismo proyecto de Supabase); URL de producción en Supabase *Site URL* y *Redirect URLs*; plantilla de email de reseteo revisada en ES; región de funciones de Vercel cercana a Supabase si se puede elegir en Hobby.
- **Comprobación:** `https://<proyecto>.vercel.app/login` carga y se puede entrar con el usuario de prueba.
- **Ref.:** [architecture.md](architecture.md) 7 y 8 (Despliegue; Vercel Hobby es solo para uso personal/no comercial: aceptado para arrancar).

### 8.2 Publicar la v1
- **Tareas:** fusionar `develop` → `main` (merge, sin squash para conservar el historial), etiquetar `v1.0.0`; comprobar el despliegue de producción; anotar la fecha en [next-steps.md](next-steps.md).
- **Comprobación:** producción muestra la última versión; la preview sigue en `develop`.

### 8.3 [John] Invitar a la clienta e instalar la PWA
- **Tareas:** crear su cuenta (2.5) con su email real; enviar la URL y una guía de 5 líneas con capturas: iPhone (*Compartir → Añadir a pantalla de inicio*) / Android (*Instalar app*); recordarle que el recorte solo avanza con la app abierta.
- **Comprobación:** la clienta entra desde el icono a pantalla completa.
- **Ref.:** [spec.md](spec.md) 3.8; [screens.md](screens.md) 6 (mantener la app abierta).

### 8.4 Prueba guiada con prendas reales
- **Tareas:** sesión con la clienta: subir 20–30 prendas (mezcla de subida normal y masiva), revisar, montar outfits, guardar favoritos, exportar un story; medir tiempos de recorte en **su** móvil; anotar qué recortes salen mal (prendas claras sobre fondo claro) y si el consejo del fondo liso basta; recoger el feedback por WhatsApp como de costumbre y pasarlo por el flujo de spec (proponer cambios y aplicarlos solo tras el OK de John).
- **Comprobación:** lista de incidencias con prioridad (bloqueante / molesta / idea) en [next-steps.md](next-steps.md).
- **Ref.:** [spec.md](spec.md) 7 (criterios de éxito); [next-steps.md](next-steps.md) *Pendiente menor*.

### 8.5 Primera iteración y vigilancia del plan gratuito
- **Tareas:** ajustar pesos de la colocación automática con el collage real (migración nueva); corregir lo bloqueante; vigilar en Supabase el uso de Storage (1 GB) y la pausa por inactividad (si la clienta no entra en una semana el proyecto se pausa: reactivar a mano o un *cron* diario de Vercel Hobby que llame a `GET /api/health`, que hace una consulta trivial); revisar el ancho de banda de Vercel (100 GB/mes) tras el primer mes.
- **Comprobación:** segunda versión `v1.0.x` publicada; sin pausas inesperadas durante dos semanas.
- **Ref.:** [architecture.md](architecture.md) 7; [open-questions.md](open-questions.md) (datos semilla).

**Hecho cuando…**
- v1 en producción desde `main`, instalada en el móvil de la clienta, con sus prendas reales y sus primeros favoritos exportados.
- Feedback recogido y la primera iteración publicada.

---

## Después de la v1

Fuera del alcance de este plan; en el orden en que probablemente hagan falta:

1. **Modo inteligente de combinación** — preguntas abiertas en [open-questions.md](open-questions.md); se diseña con el armario lleno.
2. **Recorte en servidor (plan B)** — si el recorte en móvil resulta lento o frágil: servicio externo de pago o `rembg` en un servidor propio; quitaría la limitación de tener la app abierta. Alternativa intermedia: hilos con COOP/COEP (ver 3.14).
3. **Copias de seguridad** — script que exporte base y fotos fuera de Supabase; destino por decidir.
4. **Dominio propio** — hoy URL gratuita de Vercel.
5. **Panel de usuarios / rol admin** — mientras tanto, waitlist e invitaciones desde el panel de Supabase.
6. **Borrar cuenta y exportar datos** — al abrir la app al público (también revisar el plan Hobby de Vercel, que es solo para uso personal).
7. **Proveedor de correo** — para confirmar la waitlist y mejorar el email de reseteo.
8. **Marca como tabla** — si hace falta renombrar en masa o mostrar logos.

---

## Riesgos conocidos

| Riesgo | Dónde se afronta | Qué hacer si se materializa |
|---|---|---|
| **Recorte lento o inestable en móvil real** (~26–35 s en portátil con un hilo; en móvil puede ser el doble; memoria con 30 fotos en cola) | 3.5, 3.6, 3.14, 8.4 | Hilos con COOP/COEP; reducir a 800 px; plan B en servidor (después de la v1) |
| **COOP/COEP frente a las imágenes de Supabase** (con `require-corp`, las URLs firmadas deben cargarse con `crossorigin` y responder CORS; puede romper fotos y la exportación) | 3.14, 4.3, 6.1 | Probar en una preview aparte; si rompe, no activar y quedarse con un hilo |
| **Lienzo "contaminado" al exportar** si alguna imagen se carga sin CORS | 4.3, 6.1 | `crossOrigin="anonymous"` siempre; comprobar cabeceras del bucket |
| **Lo pendiente vive solo en el dispositivo** (IndexedDB): se pierde al borrar datos del navegador; en iOS Safari sin instalar, el sistema puede purgar almacenamiento tras días sin uso | 3.6, 7.6, 8.3 | Instalar la PWA (exenta de purga); avisar en la hoja de la cola |
| **Supabase Free se pausa tras ~1 semana sin uso** | 7.6, 8.5 | Cron diario de Vercel a `/api/health`; reactivar a mano |
| **Límites del plan gratuito** (500 MB BD, 1 GB fotos, 100 GB/mes Vercel, 4,5 MB por petición a funciones de Vercel) | 3.2, 8.5 | WebP y miniaturas; subida directa a Storage con URL firmada (no pasa por la función); vigilar el uso mensual |
| **Vercel Hobby es solo para uso no comercial** | 8.1 | Revisar al abrir la app a más usuarios |
| **HEIC en Android/Chrome** no se decodifica en el navegador | 3.5 | Mensaje claro; en iPhone el sistema suele entregar JPEG |
| **Gestos de dos dedos en Konva** no vienen hechos | 4.3 | Implementar sobre `touchmove`; si se complica, tiradores grandes como mínimo viable |
| **Dos usuarios en el mismo dispositivo** comparten IndexedDB/localStorage | 3.6, 4.6 | Claves prefijadas por `user_id` |

---

## Decisiones de John (15-11-2026)

Dudas detectadas al escribir el plan, ya resueltas. El plan las referencia por número ("decisión N").

1. **Etiquetas sugeridas.** Son **solo sugerencias de la interfaz** (en `messages/`) hasta que se usan por primera vez; entonces se crea la fila en `tags`. No salen en Ajustes con 0 prendas.
2. **Familia "multicolor".** El selector de color tiene una **opción explícita "Multicolor"** (sin hex); el resto de familias se calcula desde el hex.
3. **Límite de 500 y lo pendiente local.** Se comprueba **en el cliente** (servidor + pendientes locales) al elegir fotos y **otra vez en la API** al subir.
4. **Contador del catálogo.** **Solo cuenta lo que está en el servidor.** Pendientes y "por revisar" se ven en la cola y en la franja.
5. **Subida de archivos a Storage.** **Subida directa del navegador a Storage con URL firmada** que da la API (evita el límite de 4,5 MB de Vercel). Datos y lecturas siguen pasando por la API. Corregido en architecture.md.
6. **Recuperar contraseña.** **Entra en la v1:** enlace "¿Has olvidado la contraseña?" en el login y pantalla `/reset-password`. Añadido a screens.md 2.
7. **Favorito al que se le borra una prenda.** Las demás **conservan sus posiciones manuales**; las que no tenían ajustes se recolocan solas.
8. **Mini collage del listado de favoritos.** Se **dibuja en el cliente** a partir de los items y las miniaturas; no se guarda imagen.
9. **Outfit aleatorio y vestidos.** Si `full_body` está entre las predeterminadas, se decide **al azar al 50 %** entre vestido o capa base + parte inferior.
10. **Borrador con prendas que ya no valen.** Se **quitan en silencio** al cargar.
11. **Tamaños de exportación.** **1080 × 1080** (1:1), **1080 × 1350** (4:5) y **1080 × 1920** (9:16). Añadido a screens.md 9.
12. **HEIC.** Se acepta; si el navegador no puede abrirla, se **pide otra foto** con un mensaje claro.
13. **Persistencia del recorte en lote.** **Solo en memoria** mientras la página está abierta; al recargar o salir se pierde (de ahí el aviso).
14. **`auth.uid()` en database.md.** database.md **actualizado** a `(select auth.uid())`.
15. **Colisión al renombrar una etiqueta.** **No se permite:** si ya existe una etiqueta con ese nombre, error en línea *"Ya tienes una etiqueta con ese nombre."* y no se guarda. Añadido a screens.md 12.

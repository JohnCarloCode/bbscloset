# Informe de la noche — construcción autónoma de bb's closet (fases 1–7)

**Fecha:** 16→17-11-2026 · **Rama:** `develop` (no se ha tocado `main`) · **Último commit:** CI en verde en GitHub Actions.

## Resumen

- Fases **1 a 7 construidas** en `develop`, un commit por fase y `git push` correcto en todas:
  `ebe3970` (F1) · `470c42e` (F2) · `32c59fb` (F3) · `854e44c` (F4) · `2555e55` (F5) · `059fa0d` (F6) · `afe7bec` + `f6bf59c` (F7).
- Estado final: `npm run build`, `lint`, `typecheck`, `test` (494 tests) y `check:messages` en verde; 27 tests de integración (`INTEGRATION=1`) en verde contra el Supabase local; **GitHub Actions en verde** en `develop`.
- **Todo se ha probado en local** (Supabase local con Docker + Chrome de escritorio, a veces con iframes de 402/834 px). **Nada se ha probado en un móvil real ni en Vercel.** Esa es la gran pendiente.
- **Dos migraciones nuevas** que hay que aplicar en el remoto: `0008_garment_functions.sql` y `0009_favorite_functions.sql`.
- **Problema abierto importante:** el recorte de fondo bloquea la pestaña ~9 s por foto (en escritorio; más en móvil). Ver *Errores sin resolver*.
- Cómo se trabajó: cada paso lo hizo un subagente en serie; después de cada uno revisé el diff o el informe y pasé build, lint, typecheck y test. El estado de cada paso está abajo; los detalles técnicos, en los comentarios del código.

---

## Preparación (antes de la fase 1)

- **Supabase local** (`supabase start`) en los puertos **5562x** (API 55621, BD 55622, Studio 55623, Mailpit 55624) para no chocar con repma-2, que siguió funcionando toda la noche (11 contenedores intactos).
- **`supabase/config.toml`**:
  - `[auth.email] enable_signup` estaba en `false`, y eso en la CLI **apaga el login por email** ("Email logins are disabled"). Lo he puesto a `true`; el registro sigue cerrado con `[auth] enable_signup = false` (comprobado: signup → `signup_disabled`). Solo afecta al local.
  - `site_url` local = `http://localhost:3100` (el 3000 lo ocupaba otro proyecto).
- **`supabase/seed.sql`** (solo local; `db push` no lo aplica): `test@bbscloset.test` y `test2@bbscloset.test` con contraseñas aleatorias en el comentario del seed. Además, el script `scripts/seed-garments.mjs N` crea N prendas de prueba con las fotos de `pruebas-fotos/` (estado final: 60 prendas, 54 en uso y 6 archivadas, 0 favoritos).
- **`.env.development.local`** (ignorado) con la URL y la anon key del local. `.env.local` no se ha tocado.
- **Fotos:** las 12 PNG de STREETWEAR copiadas a `pruebas-fotos/streetwear/` (ignorada). Solo hay capas superiores, chaquetas y chándales: **no hay partes inferiores, calzado, bolsos ni joyas**, y eso limita varias pruebas (ver fase 4).

---

## Fase 1 — Base

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 1.1 Tokens | `src/styles/tokens.css` (`@theme`), foco, fuentes (SF/Inter) | CSS compilado; `/dev/tokens` | Revisión a ojo; Inter en Android/Windows |
| 1.2 Componentes | Button, Chip, SegmentedControl, Sheet, Dialog, Toast con cola, ProgressBar, StatusBadge, NoticeInline, TransparencyChecker, EmptyState, TextField | Chrome (iframe 402): foco atrapado, Escape, toasts en cola | Lector de pantalla; móvil |
| 1.3 Idiomas | next-intl sin enrutado, cookie `locale`, es/en | Tests de claves y literales; curl con cookie y `Accept-Language` | — |
| 1.4 Supabase y sesión | Clientes navegador y servidor, `src/proxy.ts` (el middleware de Next 16), tipos generados | curl: redirección y 401 sin sesión, 200 con sesión, RLS entre dos usuarios | — |
| 1.5 Esqueleto de API | `withUser`, zod, errores uniformes, cursor; `GET/PATCH /api/me`; `POST /api/images/sign` | curl: `jewelry_max` 11 → 400, 5 → 200, sin sesión → 401; URLs firmadas | — |
| 1.6 Navegación | Barra inferior (<1024) y lateral (≥1024), páginas vacías | curl y Chrome | `safe-area` en iPhone real |
| 1.7 PWA | manifest, iconos provisionales, metadatos iOS, sin service worker | curl de manifest e iconos | Lighthouse "installable"; instalación en Android/iOS |
| 1.8 Vercel | — | — | **[John]** |

**"Hecho cuando…":** se cumple en local. Sin comprobar: la sesión y la preview en Vercel y la revisión a ojo en móvil.

## Fase 2 — Cuentas

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 2.1 Login | Formulario, errores sin revelar si el email existe, idioma del perfil a la cookie | Chrome: entra, error con contraseña mala, sesión al recargar, idioma `en` | Error genérico (429/500) |
| 2.2 Logout y 401 | `signOut`, `apiFetch` con 401 → `/login?expired=1` + toast | Chrome | Logout sin red |
| 2.3 Recuperar contraseña | `/login?forgot=1` y `/reset-password` (admite `token_hash` y PKCE) | De punta a punta con Mailpit, también abriendo el enlace sin cookies | Remoto (**[John]**: plantilla de email) |
| 2.4 Waitlist | Página + `POST /api/waitlist` (no revela duplicados, máx. 1 KB, 5/min por IP) | curl: mayúsculas/minúsculas → 1 fila, 429; anon no lee | — |
| 2.5 Invitación | Procedimiento en `supabase/README.md` | Separación de usuarios en local | **[John]**: segundo usuario real |

**"Hecho cuando…":** se cumple en local. Sin comprobar: Vercel y móvil.

## Fase 3 — Catálogo

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 3.1 Dominio | Huecos, tipos, temporadas, colores; `colorFamily` (OKLab) | Tests contra la semilla | — |
| 3.2 API de prendas | Rutas completas + migración 0008 (filtro Y de etiquetas, `set_garment_tags`) | Integración: límite 500, Y, RLS, Storage limpio al borrar | — |
| 3.3 Cuadrícula | Paginación por cursor, chips por hueco, En uso/Archivadas, vacíos | Chrome con 60 prendas, 402 px sin scroll horizontal | Pantalla de error en navegador |
| 3.4 Filtros | Tipo, marca, **color**, etiquetas (Y); en la URL | Chrome: recuentos = psql; recarga y Atrás | — |
| 3.5 Imagen | `@imgly/background-removal`, reducir, transparencia, WebP | Chrome: ~9 s/foto en este Mac | Descarga del modelo en frío, Safari, HEIC real, móvil |
| 3.6 Cola | IndexedDB, runner (una foto cada vez), subida automática, píldora y hoja | Chrome: sube sola, sobrevive a recargar y cerrar; pausa con la pestaña oculta | Sin red real; dos usuarios en un dispositivo |
| 3.7–3.8 Añadir prenda | Foto → recortar/ya recortada → datos mientras recorta | Chrome: 3 caminos, datos correctos en psql | 20 % exacto (con el modelo en caché salta de 0 a 100); móvil |
| 3.9 Pendientes en cuadrícula | "Recortando" al principio, sustitución sin salto | Chrome | Otro navegador (por diseño son locales) |
| 3.10 Ficha | Editar, cambiar foto, archivar con Deshacer, eliminar con aviso | Chrome + psql (favoritos creados por SQL) | Error de recorte en cambio de foto |
| 3.11 Archivar en lote | Selección, Seleccionar todo (incluye no cargadas), Deshacer | Chrome + psql | Lector de pantalla |
| 3.12 Subida masiva | Resumen (≤30, límite 500), "por revisar", revisión de una en una | Chrome con 5 fotos | 20–30 fotos; memoria en móvil |
| 3.13 Recortar fotos | Lote en memoria, ZIP (client-zip), compartir en móvil, aviso al salir | Chrome: ZIP con 10 PNG con alfa | `beforeunload`; móvil |
| 3.14 Móvil y hilos | Medidas en escritorio; prueba con Web Worker (revertida) | Ver *Errores sin resolver* | **[John]**: móvil real |

**"Hecho cuando…":**
- Funciona en escritorio: editar, archivar, eliminar, subida masiva y ZIP.
- Probado con menos de lo que pide el plan: 60 prendas en lugar de 100+ y 5 fotos en lugar de 20.
- **Nada probado en móvil**, ni los tiempos de recorte en móvil.

## Fase 4 — Vestidor

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 4.1 Modelo | Reglas de huecos, joyería, cuerpo entero, candado, orden | 26 tests (casos de spec 2.1) | — |
| 4.2 Colocación automática | `autoLayout` puro | Tests (nada se sale en 5 tamaños); 20 combinaciones con rectángulos | **Con fotos reales y juicio estético: John** |
| 4.3 Lienzo Konva | Mover, escalar, girar, orden, candado, gestos de dos dedos | Ratón en Chrome; CORS y `toDataURL` sin "tainted" | **Gestos táctiles en móvil** (solo la matemática tiene tests) |
| 4.4 Panel | 3 alturas, pantalla partida 42/58, escritorio 340 px | Chrome (iframe 402 y escritorio), arrastre simulado | Táctil real, 834 px |
| 4.5 Aleatorios | Sustituir (sin repetir, respeta candados), Outfit aleatorio (vestido al 50 %), categorías | Tests + Chrome | **Joyas y vestido 50 % solo por tests** (no hay datos) |
| 4.6 Historial y borrador | Deshacer/rehacer, borrador por usuario, Colocación automática | Chrome: recarga, nueva pestaña, prenda archivada desaparece | Sin conexión |
| 4.7 Pulido | Estados vacíos, `pixelRatio` ≤ 2, renders por gesto | 300 prendas: ~1,4 s en dev local de escritorio; 60 FPS arrastrando | **< 2 s desde móvil en la preview** |

**"Hecho cuando…":** se cumple con ratón y por tests. Sin comprobar en móvil: los gestos táctiles, el criterio de tiempo y ver el collage con una prenda en cada uno de los huecos.

## Fase 5 — Favoritos

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 5.1 API | CRUD + migración 0009 (crear y reemplazar items en una transacción) | Integración: posición nula, PATCH, DELETE, RLS, trigger | — |
| 5.2 Guardar | Hoja con vista previa y nombre opcional | Chrome + psql (manual → x/y; resto null) | Móvil |
| 5.3 Listado | Mini collage en CSS, Editar/Eliminar, paginación | Chrome 402 y escritorio | Error con reintento |
| 5.4 Detalle | Lienzo editable, Cambios sin guardar, "¿Descartar cambios?" | Chrome + psql | `beforeunload`, Atrás del navegador |
| 5.5 Coherencia | Evento global `bbs:garment-changed` | Chrome + psql: avisos con números reales, trigger, decisión 7 | Cambios desde otro dispositivo (dependen de volver a entrar) |

**"Hecho cuando…":** se cumple en Chrome. **En móvil no.**

## Fase 6 — Exportar

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 6.1 Render | Geometría pura (sin recolocar, margen 8 %), Konva fuera de pantalla | PNG 1080×1080/1350/1920 con prenda girada, sin "tainted" | — |
| 6.2 Hoja | 3 proporciones, vista previa, descarga / compartir / pestaña nueva | Escritorio: PNG en `~/Downloads` (borrados) | **Android e iPhone (Fotos)** |

**"Hecho cuando…":** se cumple en escritorio. En Android e iPhone no está comprobado.

## Fase 7 — Ajustes y pulido

| Paso | Hecho | Comprobado | No comprobado |
|---|---|---|---|
| 7.1 API etiquetas | Renombrar (409 si choca), borrar → `{affected}` | Integración | — |
| 7.2 Ajustes | Etiquetas, joyas 1–10, idioma, Recortar fotos, cuenta | Chrome + psql; idioma persiste en "otro dispositivo" | 5 joyas en el vestidor real (no hay joyas en los datos) |
| 7.3 Idioma | `npm run check:messages`, anti-literales en `src/app`, inglés unificado | Recorrido completo en EN (escritorio) | Móvil en EN |
| 7.4 Accesibilidad | Contraste, 44 px, foco, `aria-live` | **Lighthouse 100** (móvil, build local) en 8 pantallas; teclado | Lector de pantalla real |
| 7.5 Pulido visual | Comparación lado a lado con el prototipo; `/dev/*` borradas; hex solo en tokens | Ver pendientes visuales abajo | Pasos 2–3 de añadir, subida masiva, hoja de la cola; revisión humana |
| 7.6 Robustez | Sin red, Supabase pausado (503 + aviso), URLs firmadas que se renuevan solas, almacenamiento bloqueado | `supabase stop/start` local, URLs con token inválido, cookie borrada | Pausa real del remoto (no sé qué código HTTP da) |
| 7.7 CI | `.github/workflows/ci.yml` | **Verde en GitHub Actions** | Playwright de humo (opcional, no hecho) |

**"Hecho cuando…":** se cumple. Está todo menos la revisión humana en móvil.

---

## Decisiones tomadas sin John

**Las más importantes (revísalas primero):**
1. **Gris secundario `ink-muted-48`: `#7a7a7a` → `#6e6e73`.** El de DESIGN.md no llega a 4,5:1 sobre blanco; el cambio casi no se ve.
2. **Filtro de color en el catálogo**, aunque screens 4.1 y el prototipo no lo tienen: spec.md lo exige en tres sitios (l. 63, 108, 221).
3. **Unidades de posición en favoritos** (database.md no las fija): `x, y` = centro normalizado 0–1; `scale` = lado mayor del recorte / lado corto del lienzo; `rotation` en grados; `z` entero; prenda sin ajuste manual → todo `null`.
   - Consecuencia: un favorito montado en un lienzo apaisado (escritorio) se ve algo desplazado en un lienzo vertical. Las prendas no se deforman.
4. **Modelo de recorte desde la CDN de img.ly** (como tu prueba del 25-10), no autoalojado, para no gastar ancho de banda de Vercel.
5. **Candado:** solo protege de "Sustituir" (spec 3.2). "Outfit aleatorio" vacía también lo bloqueado y poner a mano una prenda del mismo hueco la sustituye.
6. **Recuperar contraseña:** se admiten dos flujos; el recomendado es `token_hash`, que necesita la plantilla de email (pendiente tuyo).
7. **Sin service worker** en la PWA.

**Interfaz y textos:**
- **Botones:**
  - "Filtros · N" (prototipo) en vez de "Filtros (N)" (plan).
  - Confirmación destructiva en negro (plan), aunque el prototipo la pinta rosa.
- **Avisos al guardar una prenda:** "Añadida a {hueco}." si el recorte ya está y "Guardada… estará lista" si no; sin doble aviso.
- **Sin diálogo de confirmación** en archivar en lote ni en "Descartar foto": son reversibles o los docs no lo piden.
- **Inglés americano** (Color, Gray, Favorite, Jewelry). "tops" para capa base en los plurales EN, como el prototipo.
- **Etiquetas y marcas:**
  - Las etiquetas se guardan en minúsculas, sin "#".
  - Sugeridas iniciales: elegante, cómodo, curro, fiesta, findes.
  - Las marcas no se normalizan ("Zara" ≠ "zara").
- **Sin arrastrar y soltar** en "Añadir prenda" (ni screens ni el prototipo lo piden); en "Recortar fotos" sí.
- **Waitlist:**
  - Collage provisional en SVG, sin fotos.
  - El email se guarda tal cual.
  - El límite de 5 por minuto por IP es en memoria, así que en Vercel es aproximado.
- **Textos que no estaban en los docs:** "De nuevo en uso.", "Prenda eliminada.", "Favorito actualizado.", "Seguir editando", estados vacíos de Ajustes, etc. Todos están en `messages`.

**Comportamiento:**
- **Topes de longitud:** nombre 80, marca 60, etiqueta 40, 30 fotos por tanda, 30 prendas por favorito.
- **Límite de 500:** cuenta en uso + archivadas + pendientes locales. Se comprueba en el cliente y en la API (409 `limit_reached`).
- **Recortes:** el bounding box es robusto e ignora las motas del recorte. Si Safari no codifica WebP, se sube PNG con el nombre `cutout.webp`.
- **Al sustituir en el mismo hueco** se hereda la posición manual. Cambiar el orden de capas no cuenta como ajuste manual.
- **Las prendas pendientes** nunca salen en Archivadas y se filtran en el cliente.
- **Recortar fotos:** al salir de la página se quitan los recortes en lote de la cola (decisión 13).
- **Idioma:** cambia con `router.refresh()`, sin recarga completa, para no cortar subidas.
- **Bajar el máximo de joyas** no quita las que ya están en el lienzo.
- **Favoritos:**
  - no guardan el candado (la tabla no tiene columna);
  - pueden incluir prendas archivadas;
  - el detalle no tiene renombrar, candado ni Colocación automática (screens 11 no los pide).
- **Exportar:** si un recorte no carga, falla con "Reintentar" en vez de exportar incompleto. El nombre del archivo es `bbs-closet-<nombre|AAAA-MM-DD>-4x5.png`.
- **Pesos de colocación:** sin migración 0009 de pesos; los de la semilla no se han tocado y el ajuste va por constantes del algoritmo.

---

## Pendiente para John, paso a paso

### 1. Aplicar las migraciones nuevas en el remoto
Es lo primero: sin esto la app desplegada fallará en catálogo y favoritos.

1. `supabase link --project-ref pongfseghyxvagviamau` (si no está enlazado).
2. `supabase db push`. Aplica **`0008_garment_functions.sql`** (filtro de etiquetas con Y y `set_garment_tags`) y **`0009_favorite_functions.sql`** (`create_favorite` y `update_favorite`). Las dos son `security invoker` con `search_path` vacío.
3. Comprueba en el SQL Editor que existen las 4 funciones.

### 2. [John] Vercel (paso 1.8)
- Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para *Preview* y *Production*.
- Abre la preview de `develop`: `/login` carga y `/api/me` da 401.

### 3. [John] Supabase → Authentication
- **URL Configuration → Redirect URLs:** la URL de producción, el comodín de previews y, en ambos, `/reset-password`.
- **Email Templates → Reset password:** pega el asunto y la plantilla de `supabase/README.md` (sección "Email de recuperar contraseña"). Sin ella el enlace solo funciona si se abre en el mismo navegador.
- **Providers → Email:** comprueba que el login por email está activo y el registro desactivado. En local, la opción equivalente de `config.toml` apagaba el login, ver *Preparación*.

### 4. [John] Segundo usuario real (paso 2.5)
- Sigue la sección "Invitar" de `supabase/README.md`.
- Entra con él y comprueba que no ve nada del primero.

### 5. Pruebas manuales en móvil real (Android de gama media e iPhone), en la preview
- **Recorte (3.14):**
  - descarga del modelo la primera vez;
  - segundos por foto;
  - memoria con 10 fotos en cola;
  - bloquear la pantalla o cambiar de app (debe pausarse y seguir).
  - La plantilla de medidas está en `pruebas/recorte/resultados-3.14.md`.
- **Añadir prenda:** desde cámara y galería, recortar o "ya recortada", rellenar datos mientras recorta (ver *Errores sin resolver*) y guardar antes de que acabe.
- **Vestidor:** gestos de dos dedos (pellizcar y girar), arrastre del panel de 3 alturas, candado y tiradores. Tiempo de apertura con muchas prendas (criterio < 2 s).
- **Exportar:** Android descarga e iPhone guarda en Fotos.
- **Recortar fotos:** compartir o guardar en Fotos, y el ZIP.
- **PWA:** instalar y abrir a pantalla completa; `safe-area` en iPhone.
- **Revisión visual a ojo** contra el prototipo a 402/834/1280, sobre todo el collage automático con prendas reales de todos los huecos.

### 6. Fotos de prueba que faltan
Sube prendas reales de **parte inferior, calzado, bolso y joyería**. Sin ellas no se han podido ver:
- el collage completo;
- el límite de joyas;
- el vestido al 50 %;
- el aviso "Hasta 3 joyas".

### 7. Revisar la licencia de `@imgly/background-removal`
Es **AGPL-3.0** (su LICENSE.md); los docs no lo mencionan. Revísalo antes de abrir la app a terceros.

### 8. Fase 8 (no empezada)
Producción, merge a `main`, invitar a la clienta.

---

## Errores y problemas sin resolver

1. **El recorte bloquea la pestaña ~9 s por foto** en escritorio (más en móvil). La librería corre en el hilo principal.
   - Consecuencias:
     - rellenar los datos de la prenda *mientras* se recorta (spec 3.1 / screens 5.3) va a trompicones;
     - la barra de progreso avanza a saltos.
   - Probé a moverlo a un **Web Worker**:
     - en `next dev` funciona perfecto: 0 bloqueos;
     - en el **build de producción tarda ~60 s por foto**, frente a 9–11 s en el hilo principal. Lo medí 6 veces;
     - no encontré la causa y lo revertí.
   - Vías para retomarlo, documentadas en `pruebas/recorte/resultados-3.14.md`:
     - probar con `next build --webpack`;
     - un worker propio servido como archivo estático;
     - una versión más nueva de Next;
     - COOP/COEP, con riesgo para las imágenes de Supabase.
2. **`npm audit`:** 2 vulnerabilidades "high" en un `zod` antiguo **dentro de** `@imgly/background-removal`. Solo se usa en el cliente para validar su configuración. No forcé `npm audit fix`, que rompería la versión.
3. **Toast con "Deshacer" de 3,5 s** (lo que dicen DESIGN y screens): en las pruebas a veces desaparecía antes de poder pulsarlo. Considera alargarlo cuando lleva acción.
4. **Avisos de salida** ("¿Salir sin descargar?", "¿Descartar cambios?"): no cubren el botón **Atrás** del navegador.
5. **Archivos huérfanos en Storage:** si se pide una URL de subida y nunca se crea la prenda, el archivo queda sin limpiar.
6. **Supabase pausado:**
   - cada petición tarda ~7 s en dar el 503, por los reintentos de postgrest-js;
   - no he podido ver qué código devuelve un proyecto remoto pausado de verdad.
7. **Incidencia de entorno:** al empezar la noche había un proceso node escuchando en el **puerto 3000** (otro proyecto tuyo). En algún momento de la noche dejó de existir.
   - Un subagente usó `pkill -f next-server` para parar su servidor. Pudo ser eso, aunque dijo que en ese momento no había nada en el 3000. No he podido saber cuándo se paró.
   - **No lo he vuelto a arrancar** porque no sé con qué comando lo lanzabas.
   - Los contenedores Docker de repma-2 siguen en marcha.
8. **`next dev` (Turbopack)** entró a veces en un bucle de recargas, y una vez no recargó `messages/*.json` hasta reiniciarlo. Se arregla reiniciando el dev; no es del código.

---

## Correcciones que necesitan los docs (no he editado `doc-ai/`)

**database.md**
- **Sec. 6 (Almacenamiento, l. 207):** la política de Storage usa `auth.uid()::text` sin `select`. Las migraciones ya usan `(select auth.uid())::text`.
- **Unidades de `favorite_items`:** no definen `x`, `y`, `scale`, `rotation` ni `z`. Usa las de *Decisiones*, punto 3.

**DESIGN.md**
- `ink-muted-48` = `#7a7a7a` no cumple WCAG AA para texto pequeño → `#6e6e73`.
- La barrita `bottom-drawer` de 24 px choca con el mínimo de 44 px; la zona táctil ya está ampliada.
- Varias utilidades de Apple miden menos de 44 px.
- Dice que los inputs no tienen estado de error; la app sí lo tiene: borde negro de 2 px y mensaje.
- La tabla de breakpoints es la de Apple, no la de la app (402/834/1280; corte de escritorio en 1024).
- Falta en la escala tipográfica: el prototipo usa 15, 13, 11 y 10 px y radios de 14 y 3 px sin token.
- En *Principles*, `tagline` aparece con peso 700; el token es 600.
- `garment-tile` dice 12 px para el nombre; el prototipo usa 14.

**screens.md**
- **4.1:** añadir la sección Color, que pide la spec.
- **Orden de secciones:** 4.3 va después de 4.4, y 5.4 después de 5.5.
- **"Un lienzo en blanco — toca una prenda…":**
  - el prototipo y el código lo parten en título y texto;
  - "de abajo" no encaja en escritorio, donde el panel está a la derecha.
- **Hoja 8 (guardar favorito):** el prototipo añade "Opcional." al texto del nombre.
- **Discrepancias con el prototipo:**
  - "Seleccionar todo"/"Cancelar" van al revés;
  - la barra de tablet en el prototipo solo lleva iconos;
  - el prototipo pinta en rosa la confirmación destructiva;
  - el botón de la waitlist ("Join the waitlist" frente a "Apuntarme").

**spec.md**
- **2.1:** dice que el cuerpo entero sustituye "en silencio", pero screens 7.2 pide un aviso con "Deshacer". La app sigue screens.
- **2.4:** enlaza "ajustes (ver 3.8)"; es la 3.6.
- **2.3:** no lista las 13 familias de color (solo están en database.md y en la migración).
- **3.4 y prototipo:** en el borrado de prenda, la spec avisa de que también se eliminarán los favoritos que queden vacíos, y el prototipo dice "The favorites stay". La app sigue la spec.

**plan.md**
- **Middleware:** 1.4 y 2.2 nombran `src/middleware.ts`; en Next 16 es `src/proxy.ts`.
- **Tipos generados:** 1.4 dice `supabase gen types typescript` sin `--local`. `supabase/README.md` decía `--linked`; ya cambiado a `--local` / `--project-id`.
- **Waitlist (2.4):** dice que el `select` con anon "falla"; en realidad devuelve vacío. El efecto es el mismo.
- **Filtros (3.4):** "Filtros (N)" frente a "Filters · N" del prototipo.
- **Colocación (4.2):**
  - nombra `0008_tune_layout.sql`, pero 0008 ya está ocupada;
  - lista `src/app/api/slots/route.ts`, que no se creó: los pesos se leen del dominio, que un test compara con la semilla.
- **Exportación (6.1):** "reutiliza `GarmentNode`": es un componente react-konva. Se comparten sus atributos.
- **Etiquetas (7.1):** aún dice "o fusionar si John lo prefiere"; ya lo resuelve la decisión 15.
- **Comprobaciones:** el "60 + 2" o "10 + 2" de 3.9, los 100+ de 3.3 y los 20 de 3.12 no se pudieron hacer con los datos de prueba.

**architecture.md**
- **Sec. 8:** dice 26–35 s por foto de recorte; en este Mac salió ~9 s, con otro equipo y otras fotos.
- **Licencia:** no menciona que `@imgly/background-removal` es AGPL-3.0.

**Otros**
- El manifest tiene `lang: "es"` fijo.

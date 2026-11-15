# bb's closet — Arquitectura

**Estado:** borrador (v0.2) — revisado el 25-10-2026
**Fecha:** 2026-10-25
**Documentos relacionados:** [spec.md](spec.md) (qué), [DESIGN.md](DESIGN.md) (cómo se ve), [database.md](database.md) (esquema de datos)

Este documento define **cómo se construye** la app: stack, piezas, flujos y estructura del código. El **esquema de la base de datos** (tablas, columnas, políticas RLS) vive en su propio documento, `database.md`.

## 1. Principios

- **Stack estándar y aburrido.** Nada exótico: tecnologías comunes, muy documentadas, fáciles de mantener.
- **Coste cero para arrancar.** Todo en planes gratuitos; sin APIs de pago.
- **Móvil primero.** Cada decisión se valora en un móvil de gama media.
- **API propia ligera.** Rutas de servidor dentro del propio Next.js, sin un servicio aparte que desplegar ni mantener.

## 2. Stack

| Capa | Tecnología | Por qué | Coste |
|---|---|---|---|
| Frontend | **Next.js** (React) + **TypeScript** | Estándar del mercado; rutas, SSR y despliegue sencillos | Gratis |
| Estilos | **Tailwind CSS** con los tokens de `DESIGN.md` | Los tokens (colores, radios, espaciado) se mapean directamente | Gratis |
| Lienzo del vestidor | **Konva** (`react-konva`) | Mover, rotar, redimensionar, capas y exportar a PNG, con ratón y táctil | Gratis |
| Base de datos | **Supabase** (PostgreSQL + RLS) | Aislamiento por usuario a nivel de base de datos | Plan gratuito |
| Autenticación | **Supabase Auth** | Integrada con RLS | Plan gratuito |
| Fotos | **Supabase Storage** | Mismo servicio, mismas reglas de acceso por usuario | Plan gratuito |
| Quitar fondo | **`@imgly/background-removal`** (en el navegador) | Sin servidor ni API de pago | Gratis |
| Selector de color | **react-colorful** | Selector de color ligero (~2 KB) y táctil; devuelve el hex | Gratis |
| Textos / idiomas | **next-intl** | ES / EN con textos fuera del código desde el día 1 | Gratis |
| Hosting | **Vercel** (plan Hobby) | Despliegue directo desde el repositorio | Gratis |
| Instalable | **PWA** (`manifest` + icono) | Icono en la pantalla de inicio y pantalla completa, sin tiendas ni pagos | Gratis |

## 3. Vista general

```
┌──────────────────────── Navegador (móvil) ────────────────────────┐
│  Next.js / React                                                  │
│   ├─ Páginas: Catálogo · Vestidor · Favoritos · Detalle · Ajustes │
│   │           · Login · Waitlist                                  │
│   ├─ Konva  → lienzo del vestidor y exportación a PNG             │
│   ├─ imgly  → quitar fondo de la foto, en el propio dispositivo   │
│   └─ localStorage → borrador del outfit en curso                  │
└───────────────┬───────────────────────────────────────────────────┘
                │ /api (rutas de Next.js) → supabase-js con la sesión del usuario
                ▼
┌──────────────────────────── Supabase ─────────────────────────────┐
│  Auth (cuentas por invitación)                                    │
│  PostgreSQL + RLS  → prendas, favoritos, etiquetas, waitlist      │
│  Storage (bucket privado) → recortes de prendas                   │
└───────────────────────────────────────────────────────────────────┘
                ▲
                │ despliegue
          Vercel (Hobby)
```

**API propia desde el inicio (decidido el 25-10-2026).** Son las rutas de servidor de Next.js (`src/app/api/`), en el mismo repo y el mismo despliegue en Vercel. Es el punto de entrada a los datos: valida la petición, aplica las reglas (por ejemplo el límite de 500 prendas) y habla con Supabase **con la sesión del usuario**, nunca con la `service_role` salvo en tareas de admin. La **RLS** se mantiene como segunda barrera. Sirve también para una futura app: web y app llamarían a la misma API.

El recorte de fondo, el lienzo y la exportación siguen en el navegador.

## 4. Flujos clave

### 4.1 Subir una prenda

1. El usuario elige la foto de la galería o hace una con la cámara (`<input type="file" accept="image/*">`, sin `capture` para que el móvil ofrezca ambas) y elige el **tipo**. La app detecta si el PNG ya tiene transparencia y propone "recortar" o "ya recortada"; si se sube una foto con fondo sin recortar, avisa pero no lo impide.
2. Se acepta **cualquier formato de imagen** que dé el móvil (JPEG, PNG, WebP, HEIC), con un tope de ~10 MB; lo que no sea imagen se rechaza con un mensaje claro. En el navegador se **reduce** la foto (máx. ~1200 px) y se convierte a un único formato, para que el proceso sea rápido.
3. `@imgly/background-removal` **quita el fondo** y devuelve un PNG con transparencia.
4. El usuario puede elegir el **color** con el selector (opcional); la app calcula la **familia de color** más cercana a partir del hex.
5. Se generan el **recorte** (WebP con transparencia) y una **miniatura** pequeña.
6. El navegador pide a la API la subida. La API comprueba la sesión y el límite de 500 prendas y devuelve URLs de subida firmadas; ambos archivos van a Storage en una ruta prefijada por usuario: `{user_id}/{prenda_id}/…`.
7. La API inserta la fila de la prenda en la base de datos.
- **Las fotos se muestran con URLs firmadas que genera la API** (en lote, con caché corta). El navegador nunca habla con Supabase para datos ni fotos; solo para iniciar sesión.

- **Solo se guarda el recorte**, no la foto original (spec 3.1).
- **Lo pendiente vive en el dispositivo:** las prendas que aún se recortan y las de la subida masiva *por revisar* (sin tipo, que la base de datos exige) se guardan en el navegador (IndexedDB) y solo se suben a Storage y a la tabla `garments` cuando tienen recorte **y** tipo. Así no hace falta tocar el esquema; a cambio, lo pendiente no viaja entre dispositivos y se pierde si se borran los datos del navegador.
- Si el recorte sale mal, se **cambia la foto** desde la ficha de edición y se repite el proceso.
- La primera vez, el navegador descarga el modelo de recorte (decenas de MB): hay que mostrar un estado de carga claro, y el modelo queda en caché después.

### 4.2 El vestidor

- Estado del lienzo en React: lista de prendas con `x`, `y`, `escala`, `rotación`, `orden` y `bloqueada`.
- **Colocación automática:** cuadrícula con pesos de tamaño por hueco que se recoloca sola (recomendación del spec; ver sección 8).
- **Edición directa:** el `Transformer` de Konva da mover, redimensionar y rotar, con ratón y gestos táctiles.
- **Deshacer / rehacer:** pila de estados en memoria.
- **Borrador:** cada cambio se copia a `localStorage`; al volver, el lienzo reaparece igual (solo por dispositivo).
- **Aleatorios:** funciones puras sobre la lista de prendas no archivadas, respetando la regla de huecos y los candados.

### 4.3 Favoritos

- **Guardar:** se inserta el favorito y una fila por prenda con su posición, tamaño, rotación y orden. Un valor vacío significa "colócalo tú, app".
- **Detalle:** mismo componente de lienzo, sin panel de catálogo. Los botones **guardar / cancelar** aparecen con el primer cambio; no hay autoguardado.

### 4.4 Exportar a imagen

- Se genera **en el cliente** con el propio Konva (`stage.toDataURL`), así pantalla y exportación comparten renderizado.
- El usuario elige proporción (1:1, 9:16, 4:5); el lienzo se recompone para encajar. Sin marca de agua.

### 4.5 Acceso y cuentas

- **Supabase Auth** con el **registro público desactivado**: las cuentas se crean por invitación.
- **Login con email + contraseña** (Supabase Auth). Las cuentas las crea John a mano; no hay panel de usuarios por ahora.
- **Waitlist:** tabla con `INSERT` abierto a anónimos y `SELECT` cerrado. Al apuntarse se muestra un mensaje en pantalla; **no se envía email**.

### 4.6 Idiomas

- Todos los textos de la interfaz en archivos de traducción (`es.json`, `en.json`) desde el primer día.
- Lo que escribe el usuario (etiquetas, marcas, nombres) no se traduce.

## 5. Estructura del repositorio

```
bbscloset/
├─ doc-ai/                 documentación (spec, diseño, arquitectura, database)
├─ src/
│  ├─ app/                 rutas de Next.js
│  │   ├─ (app)/           catálogo · vestidor · favoritos · ajustes
│  │   ├─ login/
│  │   ├─ waitlist/
│  │   └─ api/             API propia (rutas de servidor)
│  ├─ components/          UI reutilizable (botones, chips, tarjetas, nav)
│  ├─ features/
│  │   ├─ catalog/         lista, filtros, ficha de prenda, subida
│  │   ├─ dresser/         lienzo, panel, aleatorios, candados
│  │   └─ favorites/       listado, detalle, guardado
│  ├─ lib/
│  │   ├─ supabase/        cliente y tipos
│  │   ├─ imaging/         reducir foto, quitar fondo, miniaturas, familia de color
│  │   └─ layout/          colocación automática por huecos
│  ├─ messages/            es.json · en.json
│  └─ styles/              tokens de DESIGN.md
├─ supabase/               migraciones SQL y políticas RLS
└─ package.json
```

## 6. Rendimiento

- **Miniaturas** en el catálogo y recorte completo solo en el lienzo.
- **Carga diferida** de imágenes y **scroll paginado** desde el principio (100–500 prendas por armario).
- **Recortes en WebP** para aprovechar los 1 GB gratuitos de almacenamiento.
- El modelo de recorte se carga **solo al subir una prenda**, no en el resto de la app.

## 7. Límites del plan gratuito

| Servicio | Límite | Qué implica |
|---|---|---|
| Supabase | 500 MB de base de datos · 1 GB de fotos | Sobra para una clienta y cientos de prendas comprimidas |
| Supabase | Se **pausa tras ~1 semana sin uso** | Aceptable para arrancar; hay que reactivarlo o pasar a plan de pago al lanzar |
| Vercel Hobby | Solo uso personal / no comercial | Revisar al lanzar con más usuarios |

## 8. Decisiones que afectan a la arquitectura

Cerradas el 01-10-2026 (ver [open-questions.md](open-questions.md)):

- **Fotos:** bucket **privado con URLs firmadas**.
- **Composición automática:** cuadrícula con pesos por hueco.
- **Login:** email + contraseña; cuentas creadas a mano por John. Sin panel de usuarios (futuro).
- **Exportar:** se reescala el conjunto a la proporción elegida; no se recolocan las prendas.
- **Historial de deshacer:** solo de la sesión, en memoria.
- **Waitlist:** sin email de confirmación.
- **API propia desde el inicio**, como rutas de servidor de Next.js. RLS se mantiene como segunda barrera.
- **Límite de 500 prendas por usuario**, comprobado en la API.
- **PWA:** la web es instalable en el móvil, **sin modo offline completo**. Sin app nativa ni tiendas (sin coste de Apple/Google); si algún día hace falta, se envuelve la misma web con Capacitor.
- **Email:** el de Supabase por ahora (límite bajo, vale para el uso actual).
- **Copias de seguridad:** en standby, se añadirán al final. Idea: script automático que exporte la base y las fotos fuera de Supabase (el plan gratuito no incluye copias). Destino sin decidir.
- **Despliegue:** Vercel con URL gratuita; el dominio propio se decide más adelante.
- **Quitar fondo en el navegador (`@imgly`):** probado el 25-10-2026 con fotos reales (`pruebas/recorte/`). Funciona bien con prendas que contrastan con el fondo; falla con prendas claras sobre fondo claro (sale semitransparente). Tarda **~26-35 s en CPU** (un solo hilo) y la GPU no funciona con esta librería, así que el recorte va en **cola en segundo plano**. Mejoras posibles: hilos con cabeceras COOP/COEP (pueden afectar a las imágenes de Supabase). Plan B si en móvil va mal: servicio externo de pago.
- **Consejo al usuario al subir:** fondo liso y que contraste con la prenda, con buena luz.
- **Limitación aceptada (14-11-2026):** el recorte solo avanza con la app abierta y en primer plano. Al salir, el sistema congela el navegador y la cola se pausa; al volver sigue (si el sistema cerró la app, repite la foto a medias). Se acepta así de momento; la alternativa sería recortar en servidor.

## 9. Orden de construcción propuesto

1. **Base:** proyecto Next.js, Tailwind con tokens, Supabase conectado, textos ES/EN.
2. **Cuentas:** login y waitlist.
3. **Catálogo:** subir prenda (con recorte en cola, en segundo plano), listar, filtrar, editar, archivar, eliminar. Incluye la **página de recorte en lote** con descarga, que reutiliza la misma cola.
4. **Vestidor:** lienzo, panel, colocación automática, aleatorios, candados, borrador local.
5. **Favoritos:** guardar, listar, detalle con guardar/cancelar.
6. **Exportar a imagen.**
7. **Ajustes** y pulido.

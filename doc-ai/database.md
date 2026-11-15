# bb's closet — Base de datos

**Estado:** borrador (v0.2) — revisado el 25-10-2026
**Fecha:** 2026-10-25
**Documentos relacionados:** [spec.md](spec.md) (modelo del dominio, sec. 2), [architecture.md](architecture.md) (stack y flujos)

Esquema de **PostgreSQL en Supabase**. El aislamiento entre usuarios se hace con **Row Level Security (RLS)**, no solo desde el código (spec 6.2).

## 1. Visión general

```
auth.users (Supabase)
   │ 1:1
profiles ───────────── ajustes por usuario (idioma, joyería, categorías del aleatorio)
   │ 1:N
   ├── garments ─────── prendas ──┬── N:1 garment_types ── N:1 slots   (listas cerradas)
   │      │                       └── N:M tags (vía garment_tags)
   │      │ 1:N
   ├── favorites ────── outfits guardados
   │      └── favorite_items ── prenda + posición/tamaño/rotación/orden
   └── tags ─────────── vocabulario de etiquetas del usuario

waitlist ─────────────── emails (insert anónimo, sin lectura)
```

| Tabla | Qué guarda | Datos de usuario |
|---|---|---|
| `slots` | Los 9 huecos del cuerpo | No (lista cerrada) |
| `garment_types` | Tipos de prenda y su hueco | No (lista cerrada) |
| `profiles` | Ajustes del usuario | Sí |
| `garments` | Prendas del armario | Sí |
| `tags` | Etiquetas que crea el usuario | Sí |
| `garment_tags` | Qué etiquetas lleva cada prenda | Sí |
| `favorites` | Outfits guardados | Sí |
| `favorite_items` | Prendas de cada favorito y su posición | Sí |
| `waitlist` | Emails de la lista de espera | No (caso especial) |

**No hay tabla de "outfit en curso":** el borrador del vestidor vive solo en `localStorage` (spec 3.2). Al servidor solo llega lo que se guarda como favorito.

**No hay tabla de marcas:** la marca es una columna de texto libre en `garments`. El autocompletado sale de las marcas ya usadas por ese usuario.

## 2. Listas cerradas (las define el software)

El usuario nunca las edita; se cargan por migración y son de **solo lectura** para todos.

```sql
create table slots (
  id            text primary key,       -- 'base_layer', 'mid_layer', 'outer_layer', 'bottom',
                                        -- 'full_body', 'footwear', 'bag', 'jewelry', 'accessories'
  sort_order    int  not null,
  default_z     int  not null,          -- orden de superposición por defecto
  size_weight   real not null,          -- peso de tamaño para la colocación automática
  multi         boolean not null default false  -- true solo en 'jewelry'
);

create table garment_types (
  id       text primary key,            -- 'tshirt', 'shirt', 'jeans', 'dress'…
  slot_id  text not null references slots(id)
);
```

- Cada tipo pertenece **a un único hueco**: la relación vive en `garment_types.slot_id`, así el usuario no puede asignarla mal (spec 2.2).
- Los **nombres visibles** (ES/EN) no están en la base de datos: viven en los archivos de traducción de la app, con el `id` como clave.
- La regla de **cuerpo entero excluyente** con capa base y parte inferior es lógica de la app, no de la base de datos (solo afecta al lienzo, no al armario).

## 3. Tablas de usuario

Todas llevan `user_id` y RLS activada.

```sql
create table profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  language      text not null default 'es' check (language in ('es','en')),
  jewelry_max   int  not null default 3 check (jewelry_max between 1 and 10),
  random_slots  text[] not null
                default array['base_layer','bottom','footwear','bag'],  -- "Outfit aleatorio"
  created_at    timestamptz not null default now()
);

create table garments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type_id     text not null references garment_types(id),
  name        text,                                   -- opcional
  seasons     text[] not null default '{}'
              check (seasons <@ array['spring','summer','autumn','winter']),
  color_hex   text check (color_hex ~ '^#[0-9a-f]{6}$'),  -- color exacto elegido (opcional)
  color_family text check (color_family in (
              'black','white','gray','beige','brown','red','orange','yellow',
              'green','blue','purple','pink','multicolor')),   -- la calcula la app; es la que filtra
  brand       text,                                   -- texto libre
  image_path  text not null,                          -- recorte en Storage
  thumb_path  text not null,                          -- miniatura
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table tags (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null
);
create unique index tags_user_name_uniq on tags (user_id, lower(name));  -- evita "Elegante" / "elegante"

create table garment_tags (
  garment_id  uuid not null references garments(id) on delete cascade,
  tag_id      uuid not null references tags(id)     on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (garment_id, tag_id)
);

create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,                                   -- opcional; si no, se muestra la fecha
  created_at  timestamptz not null default now()
);

create table favorite_items (
  id           uuid primary key default gen_random_uuid(),
  favorite_id  uuid not null references favorites(id) on delete cascade,
  garment_id   uuid not null references garments(id)  on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  x            real,       -- NULL = "colócalo tú, app" (spec 3.4)
  y            real,
  scale        real,
  rotation     real,
  z            int
);
```

**Decisiones del esquema:**

- **Temporada multivalor** como `text[]` con restricción de valores: más simple que una tabla aparte y se filtra bien (`&&`).
- **Etiquetas únicas por usuario sin distinguir mayúsculas.** Renombrar una etiqueta es un `UPDATE` en `tags` y se propaga solo; borrarla elimina sus filas de `garment_tags`.
- **Color en dos columnas.** `color_hex` guarda lo que eligió el usuario con el selector; `color_family` la calcula la app (color más cercano de una lista cerrada) y es la que usa el filtro del catálogo. Ambas son opcionales y van juntas.
- **Favorito que se queda vacío se elimina solo.** Un trigger sobre `favorite_items` (tras `delete`) borra el favorito si ya no le queda ninguna prenda. La app avisa antes, contando los favoritos que quedarían vacíos.
- **Posiciones nulas = colocación automática.** Un favorito puede guardar posiciones solo en algunas prendas.
- **Borrar una prenda borra sus `favorite_items`** (`on delete cascade`): la prenda desaparece de los favoritos y el collage se recompone (spec 3.4). El aviso previo "aparece en N favoritos" sale de contar filas:
  `select count(distinct favorite_id) from favorite_items where garment_id = …`.
- **No se comprueban duplicados** de favoritos: no hay restricción de unicidad sobre el conjunto de prendas (spec 3.4).
- **`user_id` repetido en las tablas hijas** (`garment_tags`, `favorite_items`) para que la política RLS sea una comparación directa, sin cruzar tablas.
- **Se crea un `profiles` automáticamente** con un trigger al crearse el usuario en `auth.users`.

## 4. Índices

```sql
create index garments_user_archived on garments (user_id, archived, created_at desc);
create index garments_user_type     on garments (user_id, type_id);
create index garments_user_brand    on garments (user_id, brand);
create index garments_user_color    on garments (user_id, color_family);
create index garment_tags_tag       on garment_tags (tag_id);
create index favorite_items_garment on favorite_items (garment_id);
create index favorite_items_fav     on favorite_items (favorite_id);
create index favorites_user_created on favorites (user_id, created_at desc);
```

Con 100–500 prendas por usuario no hacen falta más. El catálogo se pagina con cursor sobre `(created_at, id)`.

## 5. Seguridad (RLS)

**Regla general** para `profiles`, `garments`, `tags`, `garment_tags`, `favorites` y `favorite_items`:

```sql
alter table garments enable row level security;

create policy "own rows" on garments
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

`(select auth.uid())` en vez de `auth.uid()` hace que Postgres lo calcule una vez por consulta y no por fila (rendimiento).

La misma política se repite en cada tabla de usuario (en `profiles`, comparando con `user_id` como clave primaria). Un bug en una consulta no puede mostrar el armario de otra persona: lo impide la base de datos.

**Integridad entre tablas.** Para que nadie enlace una prenda ajena a su favorito, `with check` en `favorite_items` y `garment_tags` debe comprobar además que `garment_id`, `tag_id` y `favorite_id` pertenecen al mismo usuario.

**Listas cerradas:**

```sql
alter table slots         enable row level security;
alter table garment_types enable row level security;
create policy "read all" on slots         for select using (true);
create policy "read all" on garment_types for select using (true);
-- sin políticas de escritura: solo las migraciones modifican estas tablas
```

**Waitlist (caso especial):**

```sql
create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now()
);
create unique index waitlist_email_uniq on waitlist (lower(email));

alter table waitlist enable row level security;
create policy "anyone can join" on waitlist for insert to anon, authenticated with check (true);
-- sin política de select: nadie puede leer los emails ajenos
```

## 6. Almacenamiento de fotos

- **Un bucket privado** (`garments`) con rutas `{user_id}/{garment_id}/cutout.webp` y `{user_id}/{garment_id}/thumb.webp`.
- **Políticas de Storage** equivalentes a la RLS: cada usuario solo lee, sube y borra dentro de su carpeta (`(storage.foldername(name))[1] = auth.uid()::text`).
- **Acceso por URLs firmadas** (decidido el 01-10-2026).
- Al **eliminar una prenda**, la app borra también sus dos archivos. Al **cambiar la foto**, se sobrescribe el recorte y la miniatura.

## 7. Cuentas por invitación

- Registro público **desactivado** en Supabase Auth: las cuentas las crea quien administra.
- El trigger sobre `auth.users` crea la fila de `profiles` con los valores por defecto.
- La waitlist es independiente de las cuentas: apuntarse no crea usuario. John la consulta e invita **desde el panel de Supabase**; no hay rol de administrador en la app.

## 8. Decisiones pendientes

**Cerradas (01-10-2026):** color = selector + familia calculada; favorito vacío se elimina solo; waitlist e invitaciones las gestiona John desde el panel de Supabase (sin rol de admin en la app).

**También cerradas (01-10-2026):** fotos con bucket privado y URLs firmadas; **sin máximo** de etiquetas por prenda; **archivado en lote** en la v1 (un `UPDATE` de varias filas, sin cambios de esquema); el historial de deshacer vive en memoria, no en la base de datos; login con email + contraseña, cuentas creadas a mano.

**Del 25-10-2026:** el límite de 500 prendas por usuario lo comprueba la API, sin cambios de esquema. La API habla con Supabase con la sesión del usuario, así que las políticas RLS siguen aplicando igual.

**Sin pendientes de base de datos.**

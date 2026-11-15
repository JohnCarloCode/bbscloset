-- 0002 · Tablas de usuario
-- Ref.: doc-ai/database.md sec. 3 (copiado tal cual, con nombres calificados en public).
-- La RLS se activa en 0004; los triggers van en 0005.

create table public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  language      text not null default 'es' check (language in ('es','en')),
  jewelry_max   int  not null default 3 check (jewelry_max between 1 and 10),
  random_slots  text[] not null
                default array['base_layer','bottom','footwear','bag'],  -- "Outfit aleatorio"
  created_at    timestamptz not null default now()
);

create table public.garments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type_id     text not null references public.garment_types(id),
  name        text,                                   -- opcional
  seasons     text[] not null default '{}'
              check (seasons <@ array['spring','summer','autumn','winter']),
  color_hex   text check (color_hex ~ '^#[0-9a-f]{6}$'),  -- color exacto elegido (opcional; en minúsculas)
  color_family text check (color_family in (
              'black','white','gray','beige','brown','red','orange','yellow',
              'green','blue','purple','pink','multicolor')),   -- la calcula la app; es la que filtra
  brand       text,                                   -- texto libre
  image_path  text not null,                          -- recorte en Storage
  thumb_path  text not null,                          -- miniatura
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.tags (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null
);
create unique index tags_user_name_uniq on public.tags (user_id, lower(name));  -- evita "Elegante" / "elegante"

create table public.garment_tags (
  garment_id  uuid not null references public.garments(id) on delete cascade,
  tag_id      uuid not null references public.tags(id)     on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (garment_id, tag_id)
);

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,                                   -- opcional; si no, se muestra la fecha
  created_at  timestamptz not null default now()
);

create table public.favorite_items (
  id           uuid primary key default gen_random_uuid(),
  favorite_id  uuid not null references public.favorites(id) on delete cascade,
  garment_id   uuid not null references public.garments(id)  on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  x            real,       -- NULL = "colócalo tú, app" (spec 3.4)
  y            real,
  scale        real,
  rotation     real,
  z            int
);

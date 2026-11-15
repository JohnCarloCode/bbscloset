-- 0001 · Listas cerradas: huecos (slots) y tipos de prenda (garment_types)
-- Ref.: doc-ai/database.md sec. 2 y 5; doc-ai/spec.md sec. 2.1.
-- Solo las migraciones modifican estas tablas; para la app son de solo lectura.

create table public.slots (
  id            text primary key,       -- 'base_layer', 'mid_layer', 'outer_layer', 'bottom',
                                        -- 'full_body', 'footwear', 'bag', 'jewelry', 'accessories'
  sort_order    int  not null,
  default_z     int  not null,          -- orden de superposición por defecto
  size_weight   real not null,          -- peso de tamaño para la colocación automática
  multi         boolean not null default false  -- true solo en 'jewelry'
);

create table public.garment_types (
  id       text primary key,            -- 'tshirt', 'shirt', 'jeans', 'dress'…
  slot_id  text not null references public.slots(id)
);

-- RLS: lectura para todos, sin políticas de escritura.
alter table public.slots         enable row level security;
alter table public.garment_types enable row level security;
create policy "read all" on public.slots         for select using (true);
create policy "read all" on public.garment_types for select using (true);

-- Semilla: 9 huecos (orden de spec 2.1).
-- default_z y size_weight son una propuesta inicial; se ajustan en el paso 4.2 del plan.
insert into public.slots (id, sort_order, default_z, size_weight, multi) values
  ('base_layer',  1, 40, 0.8,  false),
  ('mid_layer',   2, 50, 0.85, false),
  ('outer_layer', 3, 60, 0.9,  false),
  ('bottom',      4, 30, 1.0,  false),
  ('full_body',   5, 40, 1.1,  false),
  ('footwear',    6, 20, 0.45, false),
  ('bag',         7, 70, 0.4,  false),
  ('jewelry',     8, 80, 0.25, true),
  ('accessories', 9, 90, 0.35, false)
on conflict (id) do nothing;

-- Semilla: 33 tipos de prenda (spec 2.1). Los nombres visibles ES/EN viven en src/messages/.
insert into public.garment_types (id, slot_id) values
  -- capa base (4)
  ('tshirt',     'base_layer'),
  ('shirt',      'base_layer'),
  ('top',        'base_layer'),
  ('bodysuit',   'base_layer'),
  -- capa media (4)
  ('sweater',    'mid_layer'),
  ('sweatshirt', 'mid_layer'),
  ('cardigan',   'mid_layer'),
  ('vest',       'mid_layer'),
  -- capa exterior (4)
  ('jacket',     'outer_layer'),
  ('coat',       'outer_layer'),
  ('bomber',     'outer_layer'),
  ('trench',     'outer_layer'),
  -- parte inferior (4)
  ('trousers',   'bottom'),
  ('jeans',      'bottom'),
  ('skirt',      'bottom'),
  ('shorts',     'bottom'),
  -- cuerpo entero (2)
  ('dress',      'full_body'),
  ('jumpsuit',   'full_body'),
  -- calzado (4)
  ('sneakers',   'footwear'),
  ('boots',      'footwear'),
  ('sandals',    'footwear'),
  ('heels',      'footwear'),
  -- bolso (3)
  ('handbag',    'bag'),
  ('backpack',   'bag'),
  ('crossbody',  'bag'),
  -- joyería (4)
  ('necklace',   'jewelry'),
  ('earrings',   'jewelry'),
  ('ring',       'jewelry'),
  ('bracelet',   'jewelry'),
  -- accesorios (4)
  ('hat',        'accessories'),
  ('glasses',    'accessories'),
  ('belt',       'accessories'),
  ('scarf',      'accessories')
on conflict (id) do nothing;

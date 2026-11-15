-- 0004 · Row Level Security de las tablas de usuario
-- Ref.: doc-ai/database.md sec. 5.
-- Siempre (select auth.uid()), nunca auth.uid() a pelo: Postgres lo calcula una vez por consulta.

alter table public.profiles       enable row level security;
alter table public.garments       enable row level security;
alter table public.tags           enable row level security;
alter table public.garment_tags   enable row level security;
alter table public.favorites      enable row level security;
alter table public.favorite_items enable row level security;

-- Regla general: cada usuario solo ve y toca sus filas.
create policy "own rows" on public.profiles
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own rows" on public.garments
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own rows" on public.tags
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own rows" on public.favorites
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Tablas hijas: además de user_id, la prenda, la etiqueta y el favorito
-- enlazados deben ser del mismo usuario (nadie enlaza una prenda ajena).
create policy "own rows" on public.garment_tags
  for all
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.garments g
                where g.id = garment_tags.garment_id and g.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t
                where t.id = garment_tags.tag_id and t.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.garments g
                where g.id = garment_tags.garment_id and g.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t
                where t.id = garment_tags.tag_id and t.user_id = (select auth.uid()))
  );

create policy "own rows" on public.favorite_items
  for all
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.favorites f
                where f.id = favorite_items.favorite_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.garments g
                where g.id = favorite_items.garment_id and g.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.favorites f
                where f.id = favorite_items.favorite_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.garments g
                where g.id = favorite_items.garment_id and g.user_id = (select auth.uid()))
  );

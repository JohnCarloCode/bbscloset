-- 0008 · Funciones RPC de prendas (paso 3.2 del plan)
-- Las dos son `security invoker`: se ejecutan con los permisos de quien llama,
-- así que la RLS de 0004 sigue aplicándose (cada usuario solo ve y toca lo suyo).

-- 1) Prendas que tienen TODAS las etiquetas dadas (filtro del catálogo con Y,
-- spec 3.1). Con un array vacío devuelve todas. Devuelve filas de garments, así
-- que la API encadena encima el resto de filtros, el cursor, el límite, los
-- recuentos y el embebido de etiquetas como en una tabla normal.
create or replace function public.garments_with_all_tags(p_tag_ids uuid[])
returns setof public.garments
language sql
stable
security invoker
set search_path = ''
as $$
  select g.*
  from public.garments g
  where (
    select count(distinct gt.tag_id)
    from public.garment_tags gt
    where gt.garment_id = g.id
      and gt.tag_id = any (coalesce(p_tag_ids, '{}'))
  ) = (
    select count(distinct t) from unnest(coalesce(p_tag_ids, '{}')) as t
  );
$$;

-- 2) Reemplaza el conjunto de etiquetas de una prenda por los nombres dados,
-- en una sola transacción: crea las que no existen (únicas por lower(name);
-- si ya existe, se reutiliza con su escritura original) y deja en
-- garment_tags exactamente esas. Nombres recortados; los vacíos se ignoran.
create or replace function public.set_garment_tags(p_garment_id uuid, p_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_keys text[];
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Con la RLS, una prenda ajena tampoco se ve: mismo error que inexistente.
  if not exists (select 1 from public.garments g where g.id = p_garment_id) then
    raise exception 'garment not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct lower(btrim(n))), '{}')
  into v_keys
  from unnest(coalesce(p_names, '{}')) as n
  where btrim(n) <> '';

  insert into public.tags (user_id, name)
  select distinct on (lower(btrim(n))) v_user, btrim(n)
  from unnest(coalesce(p_names, '{}')) as n
  where btrim(n) <> ''
  order by lower(btrim(n))
  on conflict (user_id, (lower(name))) do nothing;

  delete from public.garment_tags gt
  where gt.garment_id = p_garment_id
    and not exists (
      select 1 from public.tags t
      where t.id = gt.tag_id and lower(t.name) = any (v_keys)
    );

  insert into public.garment_tags (garment_id, tag_id, user_id)
  select p_garment_id, t.id, v_user
  from public.tags t
  where t.user_id = v_user and lower(t.name) = any (v_keys)
  on conflict (garment_id, tag_id) do nothing;
end;
$$;

revoke execute on function public.garments_with_all_tags(uuid[]) from public, anon;
revoke execute on function public.set_garment_tags(uuid, text[]) from public, anon;
grant execute on function public.garments_with_all_tags(uuid[]) to authenticated;
grant execute on function public.set_garment_tags(uuid, text[]) to authenticated;

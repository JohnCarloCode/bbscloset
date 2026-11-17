-- 0009 · Funciones RPC de favoritos (paso 5.1 del plan)
-- Las dos son `security invoker`: se ejecutan con los permisos de quien llama,
-- así que la RLS de 0004 sigue aplicándose (una prenda o un favorito ajenos no
-- se ven ni se pueden enlazar).
--
-- Items en `p_items` (jsonb): array de objetos
--   { garment_id, x, y, scale, rotation, z }
-- con x/y/scale/rotation/z numéricos o null (null = "colócalo tú, app").
-- La API ya valida y normaliza; aquí solo se insertan.

-- 1) Crea el favorito y sus items en una sola transacción. Devuelve su id.
create or replace function public.create_favorite(p_name text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'favorite without items' using errcode = '22023';
  end if;

  insert into public.favorites (user_id, name)
  values (v_user, p_name)
  returning id into v_id;

  insert into public.favorite_items (favorite_id, garment_id, user_id, x, y, scale, rotation, z)
  select v_id, i.garment_id, v_user, i.x, i.y, i.scale, i.rotation, i.z
  from jsonb_to_recordset(p_items)
    as i(garment_id uuid, x real, y real, scale real, rotation real, z int);

  return v_id;
end;
$$;

-- 2) Cambia el nombre (si p_set_name) y/o reemplaza los items (si p_items no
-- es null) de un favorito. Los items nuevos deben ser exactamente las mismas
-- prendas que ya tiene (desde el detalle no se añaden ni se quitan, screens 11).
-- Borrar e insertar van en la misma transacción: el trigger diferido de 0005
-- ve el favorito con items al final y no lo borra.
create or replace function public.update_favorite(
  p_id uuid,
  p_set_name boolean,
  p_name text,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Con la RLS, un favorito ajeno tampoco se ve: mismo error que inexistente.
  if not exists (select 1 from public.favorites f where f.id = p_id) then
    raise exception 'favorite not found' using errcode = 'P0002';
  end if;

  if p_set_name then
    update public.favorites set name = p_name where id = p_id;
  end if;

  if p_items is not null then
    if (
      select coalesce(array_agg(fi.garment_id order by fi.garment_id), '{}')
      from public.favorite_items fi
      where fi.favorite_id = p_id
    ) is distinct from (
      select coalesce(array_agg(i.garment_id order by i.garment_id), '{}')
      from jsonb_to_recordset(p_items) as i(garment_id uuid)
    ) then
      raise exception 'favorite garments changed' using errcode = '22023';
    end if;

    delete from public.favorite_items where favorite_id = p_id;

    insert into public.favorite_items (favorite_id, garment_id, user_id, x, y, scale, rotation, z)
    select p_id, i.garment_id, (select auth.uid()), i.x, i.y, i.scale, i.rotation, i.z
    from jsonb_to_recordset(p_items)
      as i(garment_id uuid, x real, y real, scale real, rotation real, z int);
  end if;
end;
$$;

revoke execute on function public.create_favorite(text, jsonb) from public, anon;
revoke execute on function public.update_favorite(uuid, boolean, text, jsonb) from public, anon;
grant execute on function public.create_favorite(text, jsonb) to authenticated;
grant execute on function public.update_favorite(uuid, boolean, text, jsonb) to authenticated;

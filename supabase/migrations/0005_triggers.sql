-- 0005 · Triggers
-- Ref.: doc-ai/database.md sec. 3 ("Decisiones del esquema") y 7.

-- 1) Crear la fila de profiles (valores por defecto) al crearse un usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Borrar el favorito que se queda sin prendas.
-- Salta al borrar una prenda (cascade sobre favorite_items) o al quitar items a mano.
-- Es un constraint trigger diferido: se comprueba al final de la transacción, así que
-- "borrar todos los items y volver a insertarlos" dentro de una misma transacción no
-- borra el favorito. Fuera de una transacción (peticiones sueltas), sí lo borraría.
create or replace function public.delete_empty_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.favorites f
  where f.id = old.favorite_id
    and not exists (
      select 1 from public.favorite_items fi where fi.favorite_id = old.favorite_id
    );
  return null;
end;
$$;

revoke execute on function public.delete_empty_favorite() from public, anon, authenticated;

drop trigger if exists favorite_items_delete_empty_favorite on public.favorite_items;
create constraint trigger favorite_items_delete_empty_favorite
  after delete on public.favorite_items
  deferrable initially deferred
  for each row execute function public.delete_empty_favorite();

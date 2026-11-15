-- 0007 · Storage: bucket privado de fotos
-- Ref.: doc-ai/database.md sec. 6; doc-ai/architecture.md 4.1.
-- Rutas: {user_id}/{garment_id}/cutout.webp y {user_id}/{garment_id}/thumb.webp
-- Acceso por URLs firmadas; cada usuario solo lee, sube, sobrescribe y borra en su carpeta.

insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

drop policy if exists "garments: read own folder"   on storage.objects;
drop policy if exists "garments: upload own folder" on storage.objects;
drop policy if exists "garments: update own folder" on storage.objects;
drop policy if exists "garments: delete own folder" on storage.objects;

create policy "garments: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garments: upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Cambiar la foto sobrescribe recorte y miniatura (upsert = select + update).
create policy "garments: update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garments: delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

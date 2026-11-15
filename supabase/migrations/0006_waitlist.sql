-- 0006 · Lista de espera
-- Ref.: doc-ai/database.md sec. 5 (caso especial) y 7.
-- Insert abierto a anon y authenticated; sin select: nadie lee los emails desde la app.
-- John la consulta desde el panel de Supabase.
-- Ojo en la app: insertar sin pedir la fila de vuelta (sin .select() / return=minimal),
-- porque devolverla exige permiso de select.

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now()
);
create unique index waitlist_email_uniq on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
create policy "anyone can join" on public.waitlist
  for insert to anon, authenticated with check (true);
-- sin política de select: nadie puede leer los emails ajenos

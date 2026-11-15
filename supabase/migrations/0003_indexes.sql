-- 0003 · Índices
-- Ref.: doc-ai/database.md sec. 4. (tags_user_name_uniq ya está en 0002.)
-- El catálogo se pagina con cursor sobre (created_at, id).

create index garments_user_archived on public.garments (user_id, archived, created_at desc);
create index garments_user_type     on public.garments (user_id, type_id);
create index garments_user_brand    on public.garments (user_id, brand);
create index garments_user_color    on public.garments (user_id, color_family);
create index garment_tags_tag       on public.garment_tags (tag_id);
create index favorite_items_garment on public.favorite_items (garment_id);
create index favorite_items_fav     on public.favorite_items (favorite_id);
create index favorites_user_created on public.favorites (user_id, created_at desc);

-- ============================================================
-- BETA 1.4 - VTT: bucket de mapas (Storage)
-- ============================================================
-- Aplicar depois de 09. Pode rodar mais de uma vez.
-- Bucket publico para leitura; envio/alteracao apenas do mestre.

begin;

insert into storage.buckets (id, name, public)
values ('battle-maps', 'battle-maps', true)
on conflict (id) do update set public = true;

drop policy if exists battle_maps_storage_read on storage.objects;
create policy battle_maps_storage_read on storage.objects
  for select using (bucket_id = 'battle-maps');

drop policy if exists battle_maps_storage_write on storage.objects;
create policy battle_maps_storage_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'battle-maps' and public.is_mestre());

drop policy if exists battle_maps_storage_update on storage.objects;
create policy battle_maps_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'battle-maps' and public.is_mestre())
  with check (bucket_id = 'battle-maps' and public.is_mestre());

drop policy if exists battle_maps_storage_delete on storage.objects;
create policy battle_maps_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'battle-maps' and public.is_mestre());

commit;
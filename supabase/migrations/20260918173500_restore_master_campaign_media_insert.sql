-- Restore MASTER upload access that is shared by the campaign library.
drop policy if exists "Master can upload campaign media"
  on storage.objects;
create policy "Master can upload campaign media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-media'
    and public.is_master()
  );

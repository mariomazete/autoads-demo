-- Manager-owned campaign controls.
-- Store managers can only edit/delete campaigns created by themselves for their own store.

alter table public.campaign_templates
  alter column store_id drop not null;

create index if not exists campaign_templates_store_id_idx
  on public.campaign_templates (store_id);

create index if not exists campaign_templates_created_by_idx
  on public.campaign_templates (created_by);

drop policy if exists "Store managers can update own store campaigns"
  on public.campaign_templates;
create policy "Store managers can update own store campaigns"
  on public.campaign_templates
  for update
  to authenticated
  using (
    public.is_store_admin()
    and store_id = public.current_store_id()
    and created_by = auth.uid()
  )
  with check (
    public.is_store_admin()
    and store_id = public.current_store_id()
    and created_by = auth.uid()
  );

drop policy if exists "Store managers can delete own store campaigns"
  on public.campaign_templates;
create policy "Store managers can delete own store campaigns"
  on public.campaign_templates
  for delete
  to authenticated
  using (
    public.is_store_admin()
    and store_id = public.current_store_id()
    and created_by = auth.uid()
  );

drop policy if exists "Store managers can delete campaign media"
  on storage.objects;
create policy "Store managers can delete campaign media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'campaign-media'
    and public.is_store_admin()
    and name like ('manager/' || public.current_store_id()::text || '/%')
  );

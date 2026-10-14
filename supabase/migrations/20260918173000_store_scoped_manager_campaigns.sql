-- Store-scoped campaigns created by store managers.
-- Global templates created by MASTER keep store_id NULL and remain visible
-- across the operation according to the existing brand assignment rules.

alter table public.campaign_templates
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists campaign_templates_store_id_idx
  on public.campaign_templates (store_id);

create index if not exists campaign_templates_created_by_idx
  on public.campaign_templates (created_by);

-- Replace the previous template visibility policy with store-aware visibility.
drop policy if exists "Users can view campaigns from assigned brands"
  on public.campaign_templates;
drop policy if exists "Authenticated users can view active campaign templates"
  on public.campaign_templates;
drop policy if exists templates_select
  on public.campaign_templates;
drop policy if exists campaign_templates_select_tenant
  on public.campaign_templates;

create policy "Users can view campaigns from assigned brands and store"
  on public.campaign_templates
  for select
  to authenticated
  using (
    public.is_master()
    or (
      status = 'active'
      and (period_start is null or period_start <= current_date)
      and (period_end is null or period_end >= current_date)
      and exists (
        select 1
        from public.seller_brands sb
        where sb.seller_id = auth.uid()
          and sb.brand_id = campaign_templates.brand_id
      )
      and (
        campaign_templates.store_id is null
        or campaign_templates.store_id = public.current_store_id()
      )
    )
  );

-- Managers may create templates only for their own store.
drop policy if exists "Store managers can create store campaigns"
  on public.campaign_templates;
create policy "Store managers can create store campaigns"
  on public.campaign_templates
  for insert
  to authenticated
  with check (
    public.is_store_admin()
    and store_id = public.current_store_id()
    and group_id = public.current_group_id()
    and created_by = auth.uid()
  );

-- Keep master as the only role that can edit/delete the shared library.
drop policy if exists "Master can manage campaign templates"
  on public.campaign_templates;
create policy "Master can manage campaign templates"
  on public.campaign_templates
  for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Allow a manager to upload media only inside their own store folder.
drop policy if exists "Master can upload campaign media"
  on storage.objects;
drop policy if exists "Store managers can upload campaign media"
  on storage.objects;
create policy "Store managers can upload campaign media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-media'
    and public.is_store_admin()
    and name like ('manager/' || public.current_store_id()::text || '/%')
  );

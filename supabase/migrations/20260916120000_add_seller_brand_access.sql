-- Relaciona vendedores às marcas que podem operar.
create table if not exists public.seller_brands (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seller_id, brand_id)
);

create index if not exists seller_brands_seller_id_idx
  on public.seller_brands (seller_id);

create index if not exists seller_brands_brand_id_idx
  on public.seller_brands (brand_id);

alter table public.seller_brands enable row level security;

drop policy if exists "Sellers can view their own brands" on public.seller_brands;
create policy "Sellers can view their own brands"
  on public.seller_brands
  for select
  to authenticated
  using (
    seller_id = auth.uid()
    or public.is_master()
  );

drop policy if exists "Master can manage seller brands" on public.seller_brands;
create policy "Master can manage seller brands"
  on public.seller_brands
  for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

grant select, insert, update, delete on public.seller_brands to authenticated;

-- Remove as políticas amplas que permitiam ao vendedor consultar
-- qualquer campanha do próprio grupo.
drop policy if exists templates_select on public.campaign_templates;
drop policy if exists campaign_templates_select_tenant
  on public.campaign_templates;
drop policy if exists "Authenticated users can view active campaign templates"
  on public.campaign_templates;

create policy "Users can view campaigns from assigned brands"
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
    )
  );
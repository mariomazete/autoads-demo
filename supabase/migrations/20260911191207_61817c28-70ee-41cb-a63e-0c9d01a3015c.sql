alter table public.leads add column if not exists group_id uuid references public.groups(id);
create index if not exists leads_group_id_idx on public.leads(group_id);
create index if not exists leads_created_at_idx on public.leads(created_at);

alter table public.seller_campaigns
  add column if not exists total_budget numeric(12,2),
  add column if not exists daily_budget numeric(12,2),
  add column if not exists spent_amount numeric(12,2),
  add column if not exists duration_days integer,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists store_location text;

update public.seller_campaigns
set total_budget = coalesce(total_budget, budget_amount, 0),
    spent_amount = coalesce(spent_amount, spend, 0),
    duration_days = coalesce(duration_days, 30),
    daily_budget = coalesce(daily_budget, coalesce(total_budget, budget_amount, 0) / 30)
where total_budget is null or spent_amount is null or duration_days is null or daily_budget is null;

alter table public.seller_campaigns
  alter column total_budget set default 0,
  alter column daily_budget set default 0,
  alter column spent_amount set default 0,
  alter column duration_days set default 30;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.brands to authenticated;
grant all on public.brands to service_role;

insert into public.brands (name, slug, active) values
  ('Fiat','fiat',true),('Jeep','jeep',true),('Ford','ford',true),
  ('Peugeot','peugeot',true),('Citroën','citroen',true),('Renault','renault',true),
  ('GAC','gac',true),('Geely','geely',true),('Omoda & Jaecoo','omoda-jaecoo',true),
  ('Leapmotor','leapmotor',true)
on conflict (slug) do update set name = excluded.name, active = true, updated_at = now();

alter table public.brands enable row level security;

drop policy if exists "Authenticated users can view brands" on public.brands;
create policy "Authenticated users can view brands" on public.brands
  for select to authenticated using (active = true or public.is_master());

drop policy if exists "Master can manage brands" on public.brands;
create policy "Master can manage brands" on public.brands
  for all to authenticated using (public.is_master()) with check (public.is_master());

alter table public.campaign_templates
  add column if not exists brand_id uuid references public.brands(id),
  add column if not exists model text,
  add column if not exists version text,
  add column if not exists title text,
  add column if not exists price numeric(12,2),
  add column if not exists promotional_price numeric(12,2),
  add column if not exists offer_condition text,
  add column if not exists media_type text,
  add column if not exists media_url text;

alter table public.campaign_templates drop constraint if exists campaign_templates_media_type_check;
alter table public.campaign_templates add constraint campaign_templates_media_type_check
  check (media_type is null or media_type in ('image','video'));

create index if not exists campaign_templates_brand_id_idx on public.campaign_templates (brand_id);

alter table public.campaign_templates enable row level security;

create table if not exists public.seller_brands (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seller_id, brand_id)
);

create index if not exists seller_brands_seller_id_idx on public.seller_brands (seller_id);
create index if not exists seller_brands_brand_id_idx on public.seller_brands (brand_id);

alter table public.seller_brands enable row level security;

grant select, insert, update, delete on public.seller_brands to authenticated;
grant all on public.seller_brands to service_role;

drop policy if exists "Sellers can view their own brands" on public.seller_brands;
create policy "Sellers can view their own brands" on public.seller_brands
  for select to authenticated using (seller_id = auth.uid() or public.is_master());

drop policy if exists "Master can manage seller brands" on public.seller_brands;
create policy "Master can manage seller brands" on public.seller_brands
  for all to authenticated using (public.is_master()) with check (public.is_master());

drop policy if exists templates_select on public.campaign_templates;
drop policy if exists campaign_templates_select_tenant on public.campaign_templates;
drop policy if exists "Authenticated users can view active campaign templates" on public.campaign_templates;
drop policy if exists "Users can view campaigns from assigned brands" on public.campaign_templates;
create policy "Users can view campaigns from assigned brands" on public.campaign_templates
  for select to authenticated using (
    public.is_master()
    or (
      status = 'active'
      and (period_start is null or period_start <= current_date)
      and (period_end is null or period_end >= current_date)
      and exists (
        select 1 from public.seller_brands sb
        where sb.seller_id = auth.uid() and sb.brand_id = campaign_templates.brand_id
      )
    )
  );

drop policy if exists "Master can manage campaign templates" on public.campaign_templates;
create policy "Master can manage campaign templates" on public.campaign_templates
  for all to authenticated using (public.is_master()) with check (public.is_master());

drop policy if exists "Authenticated users can view campaign media" on storage.objects;
create policy "Authenticated users can view campaign media" on storage.objects
  for select to authenticated using (bucket_id = 'campaign-media');

drop policy if exists "Master can upload campaign media" on storage.objects;
create policy "Master can upload campaign media" on storage.objects
  for insert to authenticated with check (bucket_id = 'campaign-media' and public.is_master());

drop policy if exists "Master can update campaign media" on storage.objects;
create policy "Master can update campaign media" on storage.objects
  for update to authenticated using (bucket_id = 'campaign-media' and public.is_master())
  with check (bucket_id = 'campaign-media' and public.is_master());

drop policy if exists "Master can delete campaign media" on storage.objects;
create policy "Master can delete campaign media" on storage.objects
  for delete to authenticated using (bucket_id = 'campaign-media' and public.is_master());
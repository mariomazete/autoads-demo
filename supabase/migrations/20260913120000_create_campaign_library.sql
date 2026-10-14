-- Campaign library managed by ADMIN_MASTER.
-- This migration only adds the catalog structure and storage required for
-- campaign materials. It does not publish campaigns to Meta or WhatsApp.

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.brands (name, slug)
values
  ('Fiat', 'fiat'),
  ('Jeep', 'jeep'),
  ('Ford', 'ford'),
  ('Peugeot', 'peugeot'),
  ('Citroën', 'citroen'),
  ('Renault', 'renault'),
  ('GAC', 'gac'),
  ('Geely', 'geely'),
  ('Omoda & Jaecoo', 'omoda-jaecoo'),
  ('Leapmotor', 'leapmotor')
on conflict (slug) do nothing;

alter table public.campaign_templates
  add column if not exists brand_id uuid references public.brands(id),
  add column if not exists model text,
  add column if not exists version text,
  add column if not exists title text,
  add column if not exists price numeric(12, 2),
  add column if not exists promotional_price numeric(12, 2),
  add column if not exists offer_condition text,
  add column if not exists media_type text,
  add column if not exists media_url text;

alter table public.campaign_templates
  drop constraint if exists campaign_templates_media_type_check;

alter table public.campaign_templates
  add constraint campaign_templates_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

create index if not exists campaign_templates_brand_id_idx
  on public.campaign_templates (brand_id);

create index if not exists campaign_templates_status_period_idx
  on public.campaign_templates (status, period_start, period_end);

alter table public.brands enable row level security;

drop policy if exists "Authenticated users can view brands" on public.brands;
create policy "Authenticated users can view brands"
  on public.brands
  for select
  to authenticated
  using (active = true or public.is_master());

drop policy if exists "Master can manage brands" on public.brands;
create policy "Master can manage brands"
  on public.brands
  for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

alter table public.campaign_templates enable row level security;

drop policy if exists "Authenticated users can view active campaign templates"
  on public.campaign_templates;
create policy "Authenticated users can view active campaign templates"
  on public.campaign_templates
  for select
  to authenticated
  using (
    public.is_master()
    or (
      status = 'active'
      and (period_start is null or period_start <= current_date)
      and (period_end is null or period_end >= current_date)
    )
  );

drop policy if exists "Master can manage campaign templates"
  on public.campaign_templates;
create policy "Master can manage campaign templates"
  on public.campaign_templates
  for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

insert into storage.buckets (id, name, public)
values ('campaign-media', 'campaign-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can view campaign media"
  on storage.objects;
create policy "Authenticated users can view campaign media"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'campaign-media');

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

drop policy if exists "Master can update campaign media"
  on storage.objects;
create policy "Master can update campaign media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'campaign-media'
    and public.is_master()
  )
  with check (
    bucket_id = 'campaign-media'
    and public.is_master()
  );

drop policy if exists "Master can delete campaign media"
  on storage.objects;
create policy "Master can delete campaign media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'campaign-media'
    and public.is_master()
  );
-- Prepara o isolamento Meta por vendedor.
-- A integração OAuth real e o armazenamento de tokens permanecem fora desta etapa.

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'meta'
    check (provider = 'meta'),
  external_user_id text,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error')),
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, provider),
  unique (id, seller_id)
);

create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  meta_connection_id uuid not null,
  external_account_id text not null,
  name text,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meta_connection_id, external_account_id),
  unique (id, seller_id),
  constraint meta_ad_accounts_connection_owner_fk
    foreign key (meta_connection_id, seller_id)
    references public.meta_connections (id, seller_id)
    on delete cascade
);

alter table public.seller_campaigns
  add column if not exists meta_ad_account_id uuid;

alter table public.seller_campaigns
  drop constraint if exists seller_campaigns_meta_ad_account_owner_fk;

alter table public.seller_campaigns
  add constraint seller_campaigns_meta_ad_account_owner_fk
  foreign key (meta_ad_account_id, seller_id)
  references public.meta_ad_accounts (id, seller_id)
  on delete restrict;

create index if not exists meta_connections_seller_id_idx
  on public.meta_connections (seller_id);

create index if not exists meta_ad_accounts_seller_id_idx
  on public.meta_ad_accounts (seller_id);

create index if not exists seller_campaigns_meta_ad_account_id_idx
  on public.seller_campaigns (meta_ad_account_id);

alter table public.meta_connections enable row level security;
alter table public.meta_ad_accounts enable row level security;

drop policy if exists "Sellers can view their own Meta connection"
  on public.meta_connections;

create policy "Sellers can view their own Meta connection"
  on public.meta_connections
  for select
  to authenticated
  using (
    seller_id = auth.uid()
    or public.has_role('ADMIN_MASTER', auth.uid())
  );

drop policy if exists "Sellers can view their own Meta ad accounts"
  on public.meta_ad_accounts;

create policy "Sellers can view their own Meta ad accounts"
  on public.meta_ad_accounts
  for select
  to authenticated
  using (
    seller_id = auth.uid()
    or public.has_role('ADMIN_MASTER', auth.uid())
  );
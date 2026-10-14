-- AutoAds: camada genérica de integrações CRM.
-- Credenciais/tokens NÃO devem ser armazenados em texto puro nesta tabela.
-- O conector deve guardar segredos em um secret manager/Edge Function e
-- persistir apenas uma referência segura em credentials_ref.

create table if not exists public.crm_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  display_name text not null,
  status text not null default 'disconnected' check (status in ('disconnected','connecting','connected','error','disabled')),
  credentials_ref text,
  external_account_id text,
  webhook_url text,
  last_sync_at timestamptz,
  last_error text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider)
);

create index if not exists crm_integrations_store_idx on public.crm_integrations(store_id);
create index if not exists crm_integrations_provider_idx on public.crm_integrations(provider);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.crm_integrations(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.seller_campaigns(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  external_lead_id text,
  name text,
  phone text,
  email text,
  source text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  status text not null default 'new',
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_store_idx on public.crm_leads(store_id);
create index if not exists crm_leads_campaign_idx on public.crm_leads(campaign_id);
create index if not exists crm_leads_seller_idx on public.crm_leads(seller_id);
create index if not exists crm_leads_external_idx on public.crm_leads(external_lead_id);

alter table public.crm_integrations enable row level security;
alter table public.crm_leads enable row level security;

-- Master pode administrar todas as integrações/leads.
create policy "master manages crm integrations" on public.crm_integrations
for all to authenticated
using (public.has_role('ADMIN_MASTER', auth.uid()))
with check (public.has_role('ADMIN_MASTER', auth.uid()));

create policy "owner manages own crm integrations" on public.crm_integrations
for all to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "master manages crm leads" on public.crm_leads
for all to authenticated
using (public.has_role('ADMIN_MASTER', auth.uid()))
with check (public.has_role('ADMIN_MASTER', auth.uid()));

create policy "seller reads own crm leads" on public.crm_leads
for select to authenticated
using (seller_id = auth.uid());

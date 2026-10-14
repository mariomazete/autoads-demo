-- Multi-tenant isolation for the MVP.
-- Sensitive Meta credentials must remain in server-side storage/functions only.

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.companies enable row level security;
alter table public.stores enable row level security;
alter table public.vehicles enable row level security;
alter table public.campaign_templates enable row level security;
alter table public.seller_campaigns enable row level security;
alter table public.meta_connections enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.campaign_assets enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.leads enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_role('ADMIN_MASTER', auth.uid())
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists vehicles_select_tenant on public.vehicles;
create policy vehicles_select_tenant
on public.vehicles
for select
to authenticated
using (
  public.has_role('ADMIN_MASTER', auth.uid())
  or group_id = public.current_group_id()
);

drop policy if exists campaign_templates_select_tenant on public.campaign_templates;
create policy campaign_templates_select_tenant
on public.campaign_templates
for select
to authenticated
using (
  public.has_role('ADMIN_MASTER', auth.uid())
  or group_id = public.current_group_id()
);

drop policy if exists seller_campaigns_select_owner_or_admin on public.seller_campaigns;
create policy seller_campaigns_select_owner_or_admin
on public.seller_campaigns
for select
to authenticated
using (
  seller_id = auth.uid()
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
  or public.has_role('ADMIN_MASTER', auth.uid())
);

drop policy if exists seller_campaigns_insert_owner on public.seller_campaigns;
create policy seller_campaigns_insert_owner
on public.seller_campaigns
for insert
to authenticated
with check (seller_id = auth.uid());

drop policy if exists seller_campaigns_update_owner_or_admin on public.seller_campaigns;
create policy seller_campaigns_update_owner_or_admin
on public.seller_campaigns
for update
to authenticated
using (
  seller_id = auth.uid()
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
  or public.has_role('ADMIN_MASTER', auth.uid())
)
with check (
  seller_id = auth.uid()
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
  or public.has_role('ADMIN_MASTER', auth.uid())
);

drop policy if exists meta_connections_owner_only on public.meta_connections;
create policy meta_connections_owner_only
on public.meta_connections
for all
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists meta_ad_accounts_owner_only on public.meta_ad_accounts;
create policy meta_ad_accounts_owner_only
on public.meta_ad_accounts
for all
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists campaign_metrics_owner_or_admin on public.campaign_metrics;
create policy campaign_metrics_owner_or_admin
on public.campaign_metrics
for select
to authenticated
using (
  seller_id = auth.uid()
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
  or public.has_role('ADMIN_MASTER', auth.uid())
);

drop policy if exists leads_owner_or_admin on public.leads;
create policy leads_owner_or_admin
on public.leads
for select
to authenticated
using (
  seller_id = auth.uid()
  or (
    public.has_role('ADMIN_LOJA', auth.uid())
    and store_id = public.current_store_id()
  )
  or public.has_role('ADMIN_MASTER', auth.uid())
);
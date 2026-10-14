-- Lead tracking for WhatsApp-originated contacts.
alter table public.leads
add column if not exists group_id uuid references public.groups(id);

create index if not exists leads_group_id_idx
on public.leads(group_id);

create index if not exists leads_created_at_idx
on public.leads(created_at);

drop policy if exists leads_insert_tracking on public.leads;
create policy leads_insert_tracking
on public.leads
for insert
to anon, authenticated
with check (
  seller_id is not null
  and source is not null
);

drop policy if exists leads_select_owner_or_admin on public.leads;
create policy leads_select_owner_or_admin
on public.leads
for select
to authenticated
using (
  seller_id = auth.uid()
  or public.has_role('ADMIN_LOJA', auth.uid())
  or public.has_role('ADMIN_MASTER', auth.uid())
);
-- Read-only readiness of each seller of a store to publish on Meta.
-- Store managers see their own store; masters may pass any store.
create or replace function public.get_store_seller_readiness(p_store_id uuid default null)
returns table (
  seller_id uuid,
  full_name text,
  whatsapp text,
  meta_connected boolean,
  meta_error text,
  has_ad_account boolean,
  has_page boolean,
  page_name text,
  connected_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if public.is_master() then
    v_store := coalesce(p_store_id, public.current_store_id());
  elsif public.is_store_admin() then
    v_store := public.current_store_id();
  else
    raise exception 'Acesso restrito a gerentes e master';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.whatsapp,
    coalesce(mc.status = 'connected' and mc.access_token is not null, false),
    mcv.last_error,
    exists (select 1 from public.meta_ad_accounts_v2 a where a.seller_id = p.id and a.status = 'active'),
    exists (select 1 from public.meta_pages mp where mp.seller_id = p.id and mp.status = 'active'),
    (select mp.page_name from public.meta_pages mp where mp.seller_id = p.id and mp.status = 'active' order by mp.created_at desc limit 1),
    mcv.connected_at
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'VENDEDOR'
  left join public.meta_connections mc on mc.seller_id = p.id
  left join public.meta_connections_v2 mcv on mcv.seller_id = p.id and mcv.provider = 'meta'
  where p.store_id = v_store
    and p.status = 'active'
  order by p.full_name;
end;
$$;

revoke all on function public.get_store_seller_readiness(uuid) from public, anon;
grant execute on function public.get_store_seller_readiness(uuid) to authenticated;

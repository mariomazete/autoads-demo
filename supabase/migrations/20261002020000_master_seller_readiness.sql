-- Read-only readiness of every active seller in all stores (master only).
create or replace function public.get_master_seller_readiness()
returns table (
  seller_id uuid,
  full_name text,
  whatsapp text,
  meta_connected boolean,
  meta_error text,
  has_ad_account boolean,
  has_page boolean,
  page_name text,
  connected_at timestamptz,
  store_id uuid,
  store_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if not public.is_master() then
    raise exception 'Acesso restrito ao master';
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
    mcv.connected_at,
    p.store_id,
    s.name
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'VENDEDOR'
  left join public.stores s on s.id = p.store_id
  left join public.meta_connections mc on mc.seller_id = p.id
  left join public.meta_connections_v2 mcv on mcv.seller_id = p.id and mcv.provider = 'meta'
  where p.status = 'active'
  order by s.name nulls last, p.full_name;
end;
$$;

revoke all on function public.get_master_seller_readiness() from public, anon;
grant execute on function public.get_master_seller_readiness() to authenticated;

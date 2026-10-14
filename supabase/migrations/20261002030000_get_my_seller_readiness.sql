-- Prontidão do próprio vendedor para publicar (sem expor tokens).
create or replace function public.get_my_seller_readiness()
returns table(seller_id uuid, full_name text, whatsapp text, meta_connected boolean, meta_error text, has_ad_account boolean, has_page boolean, page_name text, connected_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
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
  left join public.meta_connections mc on mc.seller_id = p.id
  left join public.meta_connections_v2 mcv on mcv.seller_id = p.id and mcv.provider = 'meta'
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_seller_readiness() from public, anon;
grant execute on function public.get_my_seller_readiness() to authenticated;

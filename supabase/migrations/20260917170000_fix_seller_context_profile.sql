-- Corrige o contexto do vendedor no painel.
-- O perfil deve ser retornado para qualquer usuário autenticado;
-- a validação de função/acesso não deve fazer o painel perder os dados do perfil.

create or replace function public.get_current_seller_context()
returns table (
  full_name text,
  job_title text,
  whatsapp text,
  group_id uuid,
  company_id uuid,
  store_id uuid,
  store_name text,
  brand_id uuid,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.full_name,
    p.job_title,
    p.whatsapp,
    p.group_id,
    p.company_id,
    p.store_id,
    s.name as store_name,
    s.brand_id,
    b.name as brand_name
  from public.profiles p
  left join public.stores s on s.id = p.store_id
  left join public.brands b on b.id = s.brand_id
  where p.id = auth.uid();
$$;

grant execute on function public.get_current_seller_context() to authenticated;

create or replace function public.manager_create_campaign_for_store(
  p_template_id uuid,
  p_total_budget numeric,
  p_duration_days integer
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_company_id uuid;
  v_group_id uuid;
  v_brand_id uuid;
  v_template public.campaign_templates;
  v_store public.stores;
  v_seller record;
  v_start timestamptz := now();
  v_end timestamptz;
  v_count integer := 0;
begin
  if v_user_id is null or not public.is_store_admin() then
    raise exception 'Acesso restrito ao gerente da loja';
  end if;

  if p_total_budget is null or p_total_budget <= 0 then
    raise exception 'Orçamento inválido';
  end if;
  if p_duration_days not in (3,7,14,30) then
    raise exception 'Duração inválida';
  end if;

  select p.store_id, p.company_id, p.group_id into v_store_id, v_company_id, v_group_id
  from public.profiles p where p.id = v_user_id;

  if v_store_id is null then raise exception 'Gerente sem loja vinculada'; end if;

  select * into v_store from public.stores where id = v_store_id;
  if not found then raise exception 'Loja do gerente não encontrada'; end if;
  v_brand_id := v_store.brand_id;

  select * into v_template from public.campaign_templates
  where id = p_template_id and status = 'active';
  if not found then raise exception 'Oferta/campanha não encontrada ou inativa'; end if;
  if v_template.brand_id is distinct from v_brand_id then
    raise exception 'A oferta selecionada não pertence à marca da loja';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    join public.profiles sp on sp.id = ur.user_id
    where ur.role = 'VENDEDOR' and sp.store_id = v_store_id
      and coalesce(trim(sp.whatsapp),'') <> ''
  ) then
    raise exception 'A loja não possui vendedor com WhatsApp cadastrado';
  end if;

  v_end := v_start + make_interval(days => p_duration_days);

  for v_seller in
    select sp.id as seller_id, sp.whatsapp
    from public.user_roles ur
    join public.profiles sp on sp.id = ur.user_id
    where ur.role = 'VENDEDOR'
      and sp.store_id = v_store_id
      and coalesce(trim(sp.whatsapp),'') <> ''
  loop
    insert into public.seller_campaigns (
      tenant_id, company_id, store_id, seller_id, template_id, name,
      budget_type, budget_amount, total_budget, daily_budget, spent_amount,
      duration_days, start_date, end_date, radius_km, store_location,
      whatsapp, status, objective, source, utm_source, utm_medium, utm_campaign,
      brand_id
    ) values (
      v_group_id, v_company_id, v_store_id, v_seller.seller_id,
      v_template.id,
      coalesce(nullif(trim(coalesce(v_template.title,'')),''), nullif(trim(coalesce(v_template.model,'')),''), 'Campanha'),
      'total'::public.budget_type, p_total_budget, p_total_budget,
      p_total_budget / p_duration_days, 0, p_duration_days, v_start, v_end,
      10, concat_ws(', ', v_store.address, v_store.city, v_store.state),
      v_seller.whatsapp, 'active'::public.campaign_status, 'LEAD', 'autoads',
      'meta', 'paid_social', coalesce(v_template.title, v_template.model, 'campanha'),
      v_brand_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.manager_create_campaign_for_store(uuid,numeric,integer) to authenticated;

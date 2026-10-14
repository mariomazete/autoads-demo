-- Conferência da proposta: o gerente da loja (ou o master) confere o número da proposta
-- no sistema da concessionária e marca a venda como conferida.
-- O vendedor não consegue marcar a própria venda; se ele alterar os dados de uma venda
-- já conferida, a conferência é desfeita.

alter table public.sales
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles(id) on delete set null;

create index sales_pending_verification_idx on public.sales (store_id) where verified_at is null;

create or replace function public.sales_before_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_store uuid;
  v_group uuid;
  v_can_verify boolean;
begin
  v_can_verify := public.is_master() or public.is_store_admin();

  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then
      raise exception 'Sessão não encontrada.';
    end if;
    if not public.has_role((select auth.uid()), 'VENDEDOR') then
      raise exception 'Apenas vendedores podem registrar vendas.';
    end if;
    select p.store_id, p.group_id into v_store, v_group
    from public.profiles p
    where p.id = (select auth.uid());
    if v_store is null then
      raise exception 'Seu usuário não está vinculado a uma loja.';
    end if;
    new.seller_id := (select auth.uid());
    new.store_id := v_store;
    new.group_id := v_group;
    new.created_at := now();
    new.verified_at := null;
    new.verified_by := null;
  else
    new.seller_id := old.seller_id;
    new.store_id := old.store_id;
    new.group_id := old.group_id;
    new.created_at := old.created_at;

    if v_can_verify then
      -- Gerente/master: marcar ou desmarcar. Quem e quando são sempre registrados pelo banco.
      if new.verified_at is null then
        new.verified_by := null;
      elsif old.verified_at is null then
        new.verified_at := now();
        new.verified_by := (select auth.uid());
      else
        new.verified_at := old.verified_at;
        new.verified_by := old.verified_by;
      end if;
    else
      -- Vendedor: não mexe na conferência; se mudar os dados, ela é desfeita.
      if btrim(new.proposal_number) is distinct from old.proposal_number
        or btrim(new.vehicle_model) is distinct from old.vehicle_model
        or new.sale_date is distinct from old.sale_date
        or new.seller_campaign_id is distinct from old.seller_campaign_id then
        new.verified_at := null;
        new.verified_by := null;
      else
        new.verified_at := old.verified_at;
        new.verified_by := old.verified_by;
      end if;
    end if;
  end if;

  new.proposal_number := btrim(new.proposal_number);
  new.vehicle_model := btrim(new.vehicle_model);
  new.updated_at := now();

  if not exists (
    select 1 from public.seller_campaigns c
    where c.id = new.seller_campaign_id
      and c.seller_id = new.seller_id
  ) then
    raise exception 'A campanha escolhida não pertence a este vendedor.';
  end if;

  if new.sale_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data da venda não pode ser no futuro.';
  end if;

  return new;
end;
$$;

revoke all on function public.sales_before_write() from public, anon, authenticated;

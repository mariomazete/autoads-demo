-- Registro manual de vendas pelo vendedor.
-- A plataforma continua sem guardar leads nem dados de clientes: a venda guarda só a campanha
-- de origem, o número da proposta da concessionária, o carro e a data.
-- Visibilidade: vendedor vê só as próprias vendas, gerente (ADMIN_LOJA) vê as da loja dele,
-- master vê todas.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  group_id uuid references public.groups(id) on delete set null,
  seller_campaign_id uuid not null references public.seller_campaigns(id) on delete restrict,
  proposal_number text not null,
  vehicle_model text not null,
  sale_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_proposal_number_not_blank check (length(btrim(proposal_number)) > 0),
  constraint sales_vehicle_model_not_blank check (length(btrim(vehicle_model)) > 0),
  constraint sales_sale_date_reasonable check (sale_date >= date '2024-01-01')
);

-- O mesmo número de proposta não pode ser registrado duas vezes na mesma loja
-- (ignora espaços e maiúsculas/minúsculas).
create unique index sales_store_proposal_unique
  on public.sales (store_id, upper(btrim(proposal_number)));

create index sales_seller_date_idx on public.sales (seller_id, sale_date desc);
create index sales_store_date_idx on public.sales (store_id, sale_date desc);
create index sales_campaign_idx on public.sales (seller_campaign_id);

-- Preenche vendedor, loja e grupo a partir do perfil (nunca do formulário) e
-- garante que a campanha é do próprio vendedor.
create or replace function public.sales_before_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_store uuid;
  v_group uuid;
begin
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
  else
    -- Dono, loja e grupo da venda não mudam depois de registrada.
    new.seller_id := old.seller_id;
    new.store_id := old.store_id;
    new.group_id := old.group_id;
    new.created_at := old.created_at;
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

create trigger trg_sales_before_write
  before insert or update on public.sales
  for each row execute function public.sales_before_write();

alter table public.sales enable row level security;

-- Leitura
create policy sales_select_own on public.sales
  for select to authenticated
  using (seller_id = (select auth.uid()));

create policy sales_select_store on public.sales
  for select to authenticated
  using (public.is_store_admin() and store_id = public.current_store_id());

create policy sales_select_master on public.sales
  for select to authenticated
  using (public.is_master());

-- Registro: só o próprio vendedor (o trigger confirma o papel e preenche os dados).
create policy sales_insert_own on public.sales
  for insert to authenticated
  with check (seller_id = (select auth.uid()));

-- Correção
create policy sales_update_own on public.sales
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy sales_update_store on public.sales
  for update to authenticated
  using (public.is_store_admin() and store_id = public.current_store_id())
  with check (public.is_store_admin() and store_id = public.current_store_id());

create policy sales_update_master on public.sales
  for update to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Exclusão
create policy sales_delete_own on public.sales
  for delete to authenticated
  using (seller_id = (select auth.uid()));

create policy sales_delete_store on public.sales
  for delete to authenticated
  using (public.is_store_admin() and store_id = public.current_store_id());

create policy sales_delete_master on public.sales
  for delete to authenticated
  using (public.is_master());

revoke all on public.sales from anon;
revoke all on public.sales from authenticated;
grant select, insert, update, delete on public.sales to authenticated;

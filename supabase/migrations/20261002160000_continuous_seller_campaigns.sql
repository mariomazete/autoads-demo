-- Campanhas contínuas (sem data de fim, orçamento diário até o vendedor pausar ou acabar o saldo)
-- usam duration_days = null; o limite de gasto pelo orçamento total só vale para campanhas com período.
alter table public.seller_campaigns drop constraint if exists seller_campaigns_spent_within_budget;
alter table public.seller_campaigns add constraint seller_campaigns_spent_within_budget
  check (duration_days is null or spent_amount <= total_budget);

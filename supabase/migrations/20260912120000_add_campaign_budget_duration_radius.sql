-- Campaign budget, duration and local targeting configuration.
alter table public.seller_campaigns
  add column if not exists total_budget numeric(12, 2);

alter table public.seller_campaigns
  add column if not exists daily_budget numeric(12, 2);

alter table public.seller_campaigns
  add column if not exists spent_amount numeric(12, 2);

alter table public.seller_campaigns
  add column if not exists duration_days integer;

alter table public.seller_campaigns
  add column if not exists start_date timestamptz;

alter table public.seller_campaigns
  add column if not exists end_date timestamptz;

alter table public.seller_campaigns
  add column if not exists store_location text;

-- Preserve existing campaign data while adopting the total-budget model.
update public.seller_campaigns
set
  total_budget = coalesce(total_budget, budget_amount, 0),
  spent_amount = coalesce(spent_amount, spend, 0),
  duration_days = coalesce(duration_days, 30),
  daily_budget = coalesce(
    daily_budget,
    case
      when coalesce(duration_days, 30) > 0
        then coalesce(total_budget, budget_amount, 0) / coalesce(duration_days, 30)
      else 0
    end
  )
where total_budget is null
   or spent_amount is null
   or duration_days is null
   or daily_budget is null;

alter table public.seller_campaigns
  alter column total_budget set default 0,
  alter column daily_budget set default 0,
  alter column spent_amount set default 0,
  alter column duration_days set default 30;

alter table public.seller_campaigns
  add constraint seller_campaigns_total_budget_nonnegative
  check (total_budget >= 0);

alter table public.seller_campaigns
  add constraint seller_campaigns_spent_amount_nonnegative
  check (spent_amount >= 0);

alter table public.seller_campaigns
  add constraint seller_campaigns_duration_days_positive
  check (duration_days in (3, 7, 14, 30));

alter table public.seller_campaigns
  add constraint seller_campaigns_spent_within_budget
  check (spent_amount <= total_budget);
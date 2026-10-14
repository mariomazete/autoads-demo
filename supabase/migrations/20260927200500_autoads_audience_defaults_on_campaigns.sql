create or replace function public.apply_autoads_audience_defaults()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_default public.autoads_audience_defaults;
begin
  select * into v_default
  from public.autoads_audience_defaults
  where active = true
  order by updated_at desc
  limit 1;

  if found then
    new.audience_age_min := v_default.age_min;
    new.audience_age_max := v_default.age_max;
    new.audience_gender := v_default.gender;
    new.audience_interest_names := coalesce(v_default.interest_names, '[]'::jsonb);
    new.audience_interest_ids := coalesce(v_default.interest_ids, '[]'::jsonb);
    new.objective := v_default.objective;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seller_campaign_autoads_audience_defaults on public.seller_campaigns;

create trigger trg_seller_campaign_autoads_audience_defaults
before insert on public.seller_campaigns
for each row
execute function public.apply_autoads_audience_defaults();

-- Prevent seller campaigns from running outside the validity period
-- configured by the campaign template.
create or replace function public.enforce_seller_campaign_template_validity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_start date;
  template_end date;
begin
  if new.template_id is null then
    return new;
  end if;

  select period_start, period_end
    into template_start, template_end
  from public.campaign_templates
  where id = new.template_id;

  if template_start is not null and current_date < template_start then
    if new.status = 'active' then
      new.status := 'pending';
    end if;
  elsif template_end is not null and current_date > template_end then
    if new.status in ('active', 'pending') then
      new.status := 'paused';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists seller_campaign_template_validity_trigger
on public.seller_campaigns;

create trigger seller_campaign_template_validity_trigger
before insert or update of status, template_id, start_date, end_date
on public.seller_campaigns
for each row
execute function public.enforce_seller_campaign_template_validity();

-- If an offer is edited after seller campaigns already exist, pause campaigns
-- that are no longer inside the new validity window.
create or replace function public.pause_campaigns_outside_template_validity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.seller_campaigns
  set status = 'paused',
      updated_at = now()
  where template_id = new.id
    and status in ('active', 'pending')
    and (
      (new.period_start is not null and current_date < new.period_start)
      or (new.period_end is not null and current_date > new.period_end)
    );

  return new;
end;
$$;

drop trigger if exists campaign_template_validity_update_trigger
on public.campaign_templates;

create trigger campaign_template_validity_update_trigger
after update of period_start, period_end
on public.campaign_templates
for each row
execute function public.pause_campaigns_outside_template_validity();
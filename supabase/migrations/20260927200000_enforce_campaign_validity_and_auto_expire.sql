create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.autoads_cron_config (
  id boolean primary key default true,
  secret text not null,
  updated_at timestamptz not null default now(),
  constraint autoads_cron_config_singleton check (id = true)
);

insert into public.autoads_cron_config (id, secret)
values (true, md5(random()::text || clock_timestamp()::text || txid_current()::text))
on conflict (id) do nothing;

alter table public.autoads_cron_config enable row level security;

create or replace function public.enforce_campaign_template_validity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_period_start date;
  v_period_end date;
  v_today date := current_date;
begin
  if new.template_id is null then
    return new;
  end if;

  select period_start, period_end
    into v_period_start, v_period_end
  from public.campaign_templates
  where id = new.template_id;

  if not found then
    raise exception 'A campanha selecionada não possui uma oferta válida.';
  end if;

  if v_period_start is not null and new.start_date is not null and new.start_date::date < v_period_start then
    raise exception 'A campanha não pode começar antes do início da validade da oferta (%).', v_period_start;
  end if;

  if v_period_end is not null and new.end_date is not null and new.end_date::date > v_period_end then
    raise exception 'A campanha não pode ultrapassar a validade da oferta (%).', v_period_end;
  end if;

  if new.status in ('active'::public.campaign_status, 'pending'::public.campaign_status) then
    if v_period_start is not null and v_today < v_period_start then
      raise exception 'A oferta ainda não está vigente. A publicação só é permitida a partir de %.', v_period_start;
    end if;
    if v_period_end is not null and v_today > v_period_end then
      raise exception 'A oferta está fora da validade. A publicação está bloqueada desde %.', v_period_end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_campaign_template_validity on public.seller_campaigns;
create trigger trg_enforce_campaign_template_validity
before insert or update of template_id, start_date, end_date, status
on public.seller_campaigns
for each row execute function public.enforce_campaign_template_validity();

create index if not exists idx_seller_campaigns_expiry on public.seller_campaigns (status, end_date);

select cron.unschedule(jobid)
from cron.job
where jobname = 'autoads-expire-seller-campaigns';

select cron.schedule(
  'autoads-expire-seller-campaigns',
  '* * * * *',
  $$select net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/meta-expire-seller-campaigns-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-autoads-cron-secret', (select secret from public.autoads_cron_config where id = true)
    ),
    body := '{}'::jsonb
  );$$
);

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
    if new.end_date is not null and new.end_date <= now() then
      raise exception 'A campanha já está fora da data de vigência. A publicação foi bloqueada.';
    end if;
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

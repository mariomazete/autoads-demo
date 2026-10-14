-- Impede que o vendedor publique a mesma oferta duas vezes enquanto a anterior ainda está
-- sendo publicada ou rodando na Meta (ex.: clique duplo ou "tentar de novo" sem esperar).
create or replace function public.prevent_duplicate_seller_campaign()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.template_id is null or new.seller_id is null then
    return new;
  end if;
  if exists (
    select 1
    from public.seller_campaigns c
    where c.seller_id = new.seller_id
      and c.template_id = new.template_id
      and c.id <> new.id
      and (
        c.status = 'pending'::public.campaign_status
        or (c.status = 'active'::public.campaign_status and c.meta_campaign_id is not null)
      )
  ) then
    raise exception 'Você já tem uma campanha desta oferta publicada ou em publicação. Pause a atual antes de criar outra.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_duplicate_seller_campaign
  before insert on public.seller_campaigns
  for each row execute function public.prevent_duplicate_seller_campaign();

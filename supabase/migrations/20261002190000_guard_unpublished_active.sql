-- Uma campanha só pode ficar "ativa" se existir na Meta; e não pode ser excluída enquanto está sendo publicada.
create or replace function public.prevent_unpublished_active_campaign()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.status = 'active'::public.campaign_status
     and old.status is distinct from new.status
     and new.meta_campaign_id is null then
    raise exception 'Esta campanha não foi publicada na Meta e não pode ser marcada como ativa.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_unpublished_active_campaign
  before update on public.seller_campaigns
  for each row execute function public.prevent_unpublished_active_campaign();

create or replace function public.archive_seller_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  campaign_status public.campaign_status;
  campaign_seller uuid;
  campaign_meta text;
begin
  select status, seller_id, meta_campaign_id
    into campaign_status, campaign_seller, campaign_meta
  from public.seller_campaigns
  where id = p_campaign_id;

  if campaign_seller is null then
    raise exception 'Campanha não encontrada.';
  end if;

  if campaign_seller <> auth.uid() then
    raise exception 'Você não pode excluir esta campanha.';
  end if;

  if campaign_status = 'pending'::public.campaign_status then
    raise exception 'A campanha ainda está sendo publicada. Aguarde alguns segundos.';
  end if;

  if campaign_status = 'active'::public.campaign_status and campaign_meta is not null then
    raise exception 'Pause o anúncio antes de excluir a campanha.';
  end if;

  update public.seller_campaigns
  set archived_at = now(), updated_at = now()
  where id = p_campaign_id and seller_id = auth.uid();
end;
$$;

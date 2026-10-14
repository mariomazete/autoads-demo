alter table public.seller_campaigns add column if not exists archived_at timestamptz;

create index if not exists seller_campaigns_seller_archived_created_idx
  on public.seller_campaigns (seller_id, archived_at, created_at desc);

create or replace function public.archive_seller_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  campaign_status public.campaign_status;
  campaign_seller uuid;
begin
  select status, seller_id
    into campaign_status, campaign_seller
  from public.seller_campaigns
  where id = p_campaign_id;

  if campaign_seller is null then
    raise exception 'Campanha não encontrada.';
  end if;

  if campaign_seller <> auth.uid() then
    raise exception 'Você não pode excluir esta campanha.';
  end if;

  if campaign_status = 'active'::public.campaign_status then
    raise exception 'Pause o anúncio antes de excluir a campanha.';
  end if;

  update public.seller_campaigns
  set archived_at = now(), updated_at = now()
  where id = p_campaign_id and seller_id = auth.uid();
end;
$function$;

grant execute on function public.archive_seller_campaign(uuid) to authenticated;

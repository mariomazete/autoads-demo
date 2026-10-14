-- Fix seller campaign status updates by explicitly casting the text RPC parameter
-- to the campaign_status enum used by seller_campaigns.status.

create or replace function public.set_seller_campaign_status(p_campaign_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if p_status not in ('active', 'paused') then
    raise exception 'Status inválido';
  end if;

  update public.seller_campaigns
  set status = p_status::public.campaign_status,
      updated_at = now()
  where id = p_campaign_id
    and seller_id = auth.uid();

  if not found then
    raise exception 'Campanha não encontrada ou sem permissão';
  end if;
end;
$function$;

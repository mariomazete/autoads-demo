-- Reativar oferta arquivada (master): a oferta volta para a biblioteca, ativa, e os vendedores
-- podem publicar com ela de novo. As campanhas antigas dos vendedores continuam arquivadas
-- (os anúncios delas foram pausados na Meta); cada vendedor publica uma campanha nova.

create or replace function public.unarchive_campaign_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_master() then raise exception 'Apenas Master pode reativar ofertas'; end if;

  update public.campaign_templates
    set archived_at = null, status = 'active'::public.entity_status, updated_at = now()
  where id = p_template_id;
  if not found then raise exception 'Oferta não encontrada'; end if;
end;
$function$;

revoke execute on function public.unarchive_campaign_template(uuid) from public, anon;
grant execute on function public.unarchive_campaign_template(uuid) to authenticated, service_role;

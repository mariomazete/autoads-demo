-- Arquivar oferta (master): a oferta sai da biblioteca e dos vendedores, e as campanhas dos
-- vendedores que usam a oferta são arquivadas (somem de "no ar" / "Minhas campanhas"). Os
-- resultados (campaign_metrics, vendas) continuam guardados.
-- Os anúncios publicados são pausados na Meta pelo app ANTES de chamar esta função
-- (meta-set-campaign-status-v1); se algum não puder ser pausado, o app não arquiva.

alter table public.campaign_templates add column if not exists archived_at timestamptz;

create or replace function public.archive_campaign_template(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if not public.is_master() then raise exception 'Apenas Master pode arquivar ofertas'; end if;

  update public.campaign_templates
    set status = 'inactive'::public.entity_status, archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = p_template_id;
  if not found then raise exception 'Oferta não encontrada'; end if;

  update public.seller_campaigns
    set archived_at = now(), updated_at = now()
  where template_id = p_template_id and archived_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute on function public.archive_campaign_template(uuid) from public, anon;
grant execute on function public.archive_campaign_template(uuid) to authenticated, service_role;

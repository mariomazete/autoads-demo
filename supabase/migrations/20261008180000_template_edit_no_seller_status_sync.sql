-- Editar ou pausar uma oferta (campaign_templates) não mexe mais, por conta própria, no status
-- das campanhas dos vendedores. Antes, as funções marcavam essas campanhas como "active" ou
-- "paused" só no AutoAds, sem mudar nada na Meta: o painel podia mostrar "ativa" um anúncio
-- parado (ou "pausada" um anúncio gastando), e salvar a oferta podia falhar com
-- "fora da data de vigência" quando as campanhas já tinham vencido.
--
-- Agora:
-- - status das campanhas dos vendedores só muda pela Meta (meta-set-campaign-status-v1);
--   pausar a oferta no painel do master pausa também os anúncios na Meta, pelo app;
-- - fotos e nome novos só são copiados para campanhas ainda não publicadas na Meta, para o
--   painel não mostrar fotos que não estão no anúncio real.

create or replace function public.update_campaign_template(
  p_template_id uuid, p_brand_id uuid, p_model text, p_version text, p_title text,
  p_description text, p_price numeric, p_promotional_price numeric, p_offer_condition text,
  p_media_type text, p_media_url text, p_media_items jsonb, p_period_start date,
  p_period_end date, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_master() then raise exception 'Apenas Master pode editar campanhas'; end if;
  if p_status not in ('active', 'inactive') then raise exception 'Status de campanha inválido'; end if;
  if jsonb_typeof(coalesce(p_media_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_media_items, '[]'::jsonb)) > 10 then
    raise exception 'A campanha pode ter no máximo 10 mídias';
  end if;

  update public.campaign_templates set
    brand_id = p_brand_id, model = p_model, version = p_version, title = p_title, name = p_title,
    description = p_description, primary_text = p_description, price = p_price,
    promotional_price = p_promotional_price, offer_condition = p_offer_condition,
    media_type = p_media_type, media_url = p_media_url, media_items = coalesce(p_media_items, '[]'::jsonb),
    image_url = case when p_media_type = 'image' then p_media_url else null end,
    period_start = p_period_start, period_end = p_period_end, status = p_status::public.entity_status,
    objective = 'LEAD', cta = 'WhatsApp', updated_at = now()
  where id = p_template_id;
  if not found then raise exception 'Campanha não encontrada'; end if;

  -- Só campanhas que ainda não foram para a Meta acompanham as fotos e o nome da oferta.
  update public.seller_campaigns set
    brand_id = p_brand_id, media_items = coalesce(p_media_items, '[]'::jsonb), name = p_title,
    updated_at = now()
  where template_id = p_template_id
    and meta_campaign_id is null;
end;
$function$;

create or replace function public.set_campaign_template_status(p_template_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_master() then raise exception 'Apenas Master pode alterar campanhas'; end if;
  if p_status not in ('active', 'inactive') then raise exception 'Status de campanha inválido'; end if;

  update public.campaign_templates set status = p_status::public.entity_status, updated_at = now() where id = p_template_id;
  if not found then raise exception 'Campanha não encontrada'; end if;

  -- Campanhas ainda não publicadas na Meta podem ser pausadas aqui mesmo.
  -- As publicadas são pausadas na Meta pelo app (meta-set-campaign-status-v1).
  if p_status = 'inactive' then
    update public.seller_campaigns set status = 'paused', updated_at = now()
    where template_id = p_template_id and meta_campaign_id is null
      and status in ('draft', 'pending', 'active');
  end if;
end;
$function$;

revoke execute on function public.update_campaign_template(uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, jsonb, date, date, text) from public, anon;
grant execute on function public.update_campaign_template(uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, jsonb, date, date, text) to authenticated, service_role;
revoke execute on function public.set_campaign_template_status(uuid, text) from public, anon;
grant execute on function public.set_campaign_template_status(uuid, text) to authenticated, service_role;

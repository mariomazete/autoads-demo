-- Sellers may pause/reactivate their own campaigns.
-- Keep the existing trigger guard for all protected campaign fields,
-- but allow status changes because they are handled by the dedicated RPC.

create or replace function public.guard_seller_campaign_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.seller_id is distinct from old.seller_id
     or new.store_id is distinct from old.store_id
     or new.tenant_id is distinct from old.tenant_id
     or new.company_id is distinct from old.company_id
     or new.template_id is distinct from old.template_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.brand_id is distinct from old.brand_id
     or new.name is distinct from old.name
     or new.radius_km is distinct from old.radius_km
     or new.whatsapp is distinct from old.whatsapp
     or new.destination_url is distinct from old.destination_url
     or new.meta_ad_account_id_v2 is distinct from old.meta_ad_account_id_v2
     or new.audience_age_min is distinct from old.audience_age_min
     or new.audience_age_max is distinct from old.audience_age_max
     or new.audience_gender is distinct from old.audience_gender
     or new.objective is distinct from old.objective
     or new.audience_interest_names is distinct from old.audience_interest_names
     or new.audience_interest_ids is distinct from old.audience_interest_ids
     or new.total_budget is distinct from old.total_budget
     or new.daily_budget is distinct from old.daily_budget
     or new.duration_days is distinct from old.duration_days
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date
     or new.store_location is distinct from old.store_location
     or new.meta_campaign_id is distinct from old.meta_campaign_id
     or new.meta_adset_id is distinct from old.meta_adset_id
     or new.meta_ad_id is distinct from old.meta_ad_id
     or new.meta_ad_account_id is distinct from old.meta_ad_account_id
     or new.published_at is distinct from old.published_at
     or new.source is distinct from old.source
     or new.utm_source is distinct from old.utm_source
     or new.utm_medium is distinct from old.utm_medium
     or new.utm_campaign is distinct from old.utm_campaign
     or new.utm_content is distinct from old.utm_content
     or new.spend is distinct from old.spend
     or new.clicks is distinct from old.clicks
     or new.impressions is distinct from old.impressions
     or new.leads_count is distinct from old.leads_count
     or new.spent_amount is distinct from old.spent_amount
     or new.error_message is distinct from old.error_message
     or new.source is distinct from old.source
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Sellers may only update campaign budget fields';
  end if;

  return new;
end;
$function$;

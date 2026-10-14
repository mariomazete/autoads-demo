-- Applied manually in the SQL editor on 2026-10-01. Idempotent.

-- Failed/archived campaign attempts (no spend, no metrics); their empty Meta campaigns were deleted first.
delete from public.seller_campaigns
where archived_at is not null
  and status in ('error', 'paused', 'draft')
  and coalesce(spent_amount, 0) = 0
  and not exists (select 1 from public.campaign_metrics m where m.seller_campaign_id = seller_campaigns.id);

-- Leads go straight to the seller's WhatsApp: no lead storage, CRM or routing in AutoAds.
drop table if exists public.leads;
drop table if exists public.store_lead_routing;
drop table if exists public.crm_integrations;
-- Carousel media lives in campaign_templates.media_items.
drop table if exists public.campaign_assets;

-- Used or expired OAuth states are no longer needed.
delete from public.meta_oauth_states where used_at is not null or expires_at < now();

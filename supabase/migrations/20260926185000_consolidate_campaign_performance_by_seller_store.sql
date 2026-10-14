-- Keep seller_campaigns.store_id aligned with the seller's current store.
-- CampaignPerformance aggregates metrics by campaign/store, so the seller ->
-- store relationship is authoritative for the store performance cards.

create or replace function public.sync_seller_campaign_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_store_id uuid;
begin
  if new.seller_id is not null then
    select p.store_id
      into seller_store_id
      from public.profiles p
     where p.id = new.seller_id;

    if seller_store_id is not null then
      new.store_id := seller_store_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_seller_campaign_store on public.seller_campaigns;

create trigger trg_sync_seller_campaign_store
before insert or update of seller_id, store_id
on public.seller_campaigns
for each row
execute function public.sync_seller_campaign_store();

-- Backfill current campaigns so the existing performance screen immediately
-- uses the seller's actual store relationship.
update public.seller_campaigns c
   set store_id = p.store_id
  from public.profiles p
 where p.id = c.seller_id
   and p.store_id is not null
   and c.archived_at is null
   and c.store_id is distinct from p.store_id;

-- Keep campaign_metrics.store_id aligned for future consumers/reporting too.
update public.campaign_metrics m
   set store_id = p.store_id
  from public.profiles p
 where p.id = m.seller_id
   and p.store_id is not null
   and m.store_id is distinct from p.store_id;

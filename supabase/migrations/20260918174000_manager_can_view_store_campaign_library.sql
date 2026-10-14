-- Managers can view the campaigns that belong to their own store,
-- including store-scoped campaigns they created and global offers of their brand.
drop policy if exists "Users can view campaigns from assigned brands and store"
  on public.campaign_templates;

create policy "Users can view campaigns from assigned brands and store"
  on public.campaign_templates
  for select
  to authenticated
  using (
    public.is_master()
    or (
      status = 'active'
      and (period_start is null or period_start <= current_date)
      and (period_end is null or period_end >= current_date)
      and (
        (
          public.is_store_admin()
          and (
            campaign_templates.store_id = public.current_store_id()
            or (
              campaign_templates.store_id is null
              and campaign_templates.brand_id = (
                select s.brand_id
                from public.stores s
                where s.id = public.current_store_id()
              )
            )
          )
        )
        or (
          exists (
            select 1
            from public.seller_brands sb
            where sb.seller_id = auth.uid()
              and sb.brand_id = campaign_templates.brand_id
          )
          and (
            campaign_templates.store_id is null
            or campaign_templates.store_id = public.current_store_id()
          )
        )
      )
    )
  );

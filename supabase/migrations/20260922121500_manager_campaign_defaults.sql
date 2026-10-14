-- Automatically scope campaigns created by a store manager to their store and user.

create or replace function public.set_manager_campaign_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_store_admin() then
    new.store_id := public.current_store_id();
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists t_campaign_templates_manager_owner on public.campaign_templates;
create trigger t_campaign_templates_manager_owner
before insert on public.campaign_templates
for each row
execute function public.set_manager_campaign_owner();

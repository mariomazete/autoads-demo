-- Ensure manager-created campaigns are always scoped to the manager's own store.
create or replace function public.set_manager_campaign_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_store_admin() then
    new.store_id := public.current_store_id();
    new.created_by := auth.uid();
    new.group_id := public.current_group_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_manager_campaign_scope on public.campaign_templates;
create trigger trg_set_manager_campaign_scope
before insert on public.campaign_templates
for each row
execute function public.set_manager_campaign_scope();

create or replace function public.prevent_non_master_whatsapp_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Edge functions (service_role) already verify that the caller is ADMIN_MASTER.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.whatsapp is distinct from new.whatsapp
     and not public.is_master() then
    raise exception 'WhatsApp do vendedor é definido pelo administrador e não pode ser alterado pelo próprio vendedor.';
  end if;
  return new;
end;
$$;

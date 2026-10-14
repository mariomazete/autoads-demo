-- bootstrap_current_user() tinha sido fechada na auditoria de 14/09/2026, mas voltou a ser
-- executável por usuários logados. O app não usa; fica só para o servidor.
revoke execute on function public.bootstrap_current_user(text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_current_user(text, text) to service_role;

-- Reforço de segurança (auditoria de 04/10/2026).
--
-- 1. Remove o acesso público (sem login) aos perfis, veículos e empresas.
--    A regra "profiles_public" deixava qualquer pessoa ler nome, e-mail, WhatsApp e loja
--    dos vendedores usando só a chave pública do site. O AutoAds não usa leitura pública.
-- 2. Tira de "anon" (quem não está logado) qualquer acesso direto às tabelas.
-- 3. Tira de "anon" a execução de funções do banco; funções de trigger também deixam de ser
--    chamáveis por usuários logados (os triggers continuam funcionando normalmente).
-- 4. Garante que tabelas/funções criadas no futuro não nasçam abertas para "anon".
-- 5. Fixa o search_path da função que o linter apontou.
--
-- Nenhum dado é apagado.

-- 1. Regras públicas (profiles_public, companies_public, vehicles_public)
-- O acesso é fechado no passo 2: sem nenhum privilégio de tabela para "anon", essas regras
-- deixam de ter efeito. Remover as regras em si (DROP POLICY) fica para uma limpeza posterior.

-- 2. Tabelas: nada para quem não está logado
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Tabelas internas, usadas só pelo servidor (service_role)
revoke all on public.autoads_cron_config from authenticated;
revoke all on public.meta_connections from authenticated;
revoke all on public.meta_pages from authenticated;

-- 3. Funções
-- Antes de tirar o PUBLIC, garante explicitamente o acesso que usuários logados e o servidor
-- já tinham às funções normais (RPCs e as usadas nas regras de acesso), para nada quebrar.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
grant execute on all functions in schema public to service_role;

revoke execute on all functions in schema public from public, anon;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from authenticated', f.sig);
  end loop;
end $$;

-- 4. Padrão para objetos novos
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- 5. search_path fixo
alter function public.activate_seller_template_campaign() set search_path = public;

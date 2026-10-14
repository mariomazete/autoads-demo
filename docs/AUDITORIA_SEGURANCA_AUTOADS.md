# Auditoria de Segurança — AutoAds

**Data de consolidação:** 14/09/2026  
**Projeto:** AutoAds  
**Repositório:** `mariomazete/autoads-demo`  
**Status:** auditoria em andamento

## Objetivo

Registrar de forma permanente no próprio projeto o histórico das revisões de segurança realizadas no AutoAds, incluindo problemas encontrados, correções aplicadas, decisões de arquitetura e próximos pontos da auditoria.

A regra adotada é fazer a auditoria em pequenas etapas, aplicar uma mudança por vez e verificar o resultado antes de avançar.

---

## Princípios adotados

- RLS habilitado nas tabelas expostas pelo Data API.
- Menor privilégio possível para `anon` e `authenticated`.
- Funções `SECURITY DEFINER` com `search_path` fixado em `''` sempre que aplicável.
- Objetos usados por funções com `SECURITY DEFINER` devem ser referenciados com schema explícito.
- `EXECUTE` de funções sensíveis não deve ficar aberto para `anon`.
- Operações administrativas sensíveis devem usar RPC segura quando apropriado.
- Histórico de campanhas com movimentação/gasto deve ser preservado.
- Exclusão física só deve ocorrer quando não houver dependências ou histórico que precise ser mantido.
- Frontend nunca deve ser tratado como única camada de segurança; RLS, grants e funções do banco são a autoridade final.

---

# Histórico das correções realizadas

## 1. Funções de trigger internas

Foram revisadas funções internas usadas por triggers, incluindo:

- `apply_brand_audience_to_campaign()`
- `ensure_unique_profile_slug()`

A execução direta por clientes (`anon` / `authenticated`) foi revogada quando não era necessária. Essas funções devem ser acionadas pelo mecanismo interno do banco, e não diretamente pelo navegador.

### `apply_brand_audience_to_campaign()`

- Mantida como `SECURITY DEFINER` para executar a lógica de trigger.
- `EXECUTE` direto para `anon` e `authenticated` revogado.
- Execução interna preservada para `postgres` / `service_role`.
- Responsabilidade: copiar as configurações de audiência da marca para uma nova campanha.

---

## 2. `bootstrap_current_user()`

Foi identificada uma função legada que permanecia acessível de forma indevida.

A função foi investigada e não havia dependências de triggers ou outras rotinas que exigissem sua exposição ao cliente.

Correções:

- `anon = false`
- `authenticated = false`
- `service_role = true`
- `search_path = ''`
- referências internas ajustadas para schema explícito

Resultado: função isolada para uso interno/administrativo.

---

## 3. `has_role()`

A função de verificação de papel foi endurecida.

Correções principais:

- `SECURITY DEFINER`
- `search_path = ''`
- tabela referenciada como `public.user_roles`
- usuário consultado fica restrito ao próprio `auth.uid()` quando chamada por usuário autenticado
- `anon` não possui execução
- `authenticated` possui apenas a execução necessária
- `service_role` preservado

Isso evita que um usuário autenticado use a função para consultar arbitrariamente o papel de outro usuário.

---

## 4. `is_master()` e `is_store_admin()`

As funções de autorização foram endurecidas.

Ambas agora:

- usam `SECURITY DEFINER`
- usam `search_path = ''`
- chamam `public.has_role(...)`
- usam o usuário autenticado atual (`auth.uid()`)
- não ficam expostas para `anon`

Essas funções são usadas como base para políticas administrativas e de gerente.

---

## 5. `current_group_id()` e `current_store_id()`

As funções de contexto do usuário foram endurecidas.

Correções:

- `search_path = ''`
- tabelas referenciadas explicitamente em `public`
- uso de `(select auth.uid())`
- execução permitida apenas onde necessária
- `anon` sem acesso

Objetivo: impedir que o contexto de grupo ou loja seja obtido de forma manipulável pelo cliente.

---

## 6. `get_current_seller_context()`

Função revisada para retornar somente o contexto do vendedor autenticado.

Regras:

- exige papel `VENDEDOR`
- utiliza `auth.uid()` como identidade do usuário
- referências qualificadas com `public`
- `search_path = ''`
- sem execução para `anon`

---

## 7. `manager_set_campaign_status()`

RPC usada pelo gerente para ativar/pausar campanhas.

Foi endurecida para:

- `SECURITY DEFINER`
- `search_path = ''`
- referências qualificadas com `public`
- exigir `ADMIN_LOJA`
- limitar a campanha à loja do gerente
- permitir somente mudanças de status suportadas (`active` / `paused`)
- bloquear execução anônima

A ideia é evitar que o gerente possa alterar arbitrariamente outros campos da campanha através de um `UPDATE` direto.

---

## 8. Política insegura de UPDATE em `seller_campaigns`

Foi encontrada uma política de atualização de gerente com condições tautológicas, equivalentes a comparações como:

```sql
seller_id = seller_id
company_id = company_id
store_id = store_id
```

Essas condições não protegiam os valores antigos e novos como deveriam.

Correção:

- política `seller_campaigns_update_store_status` removida
- alteração de status do gerente passou a depender da RPC segura `manager_set_campaign_status()`

---

## 9. Política insegura de UPDATE em `leads`

A política `leads_update_own` permitia que um vendedor atualizasse colunas do próprio lead desde que mantivesse o mesmo `seller_id`.

Foi verificado que o código da aplicação não dependia dessa capacidade.

Correção:

- política `leads_update_own` removida
- atualmente não existem políticas de `UPDATE` para `leads`

Resultado: leads tornam-se efetivamente somente leitura para os usuários após a criação, conforme o fluxo atual.

---

## 10. Auditoria ampla de RLS

Foi realizada revisão das políticas das tabelas públicas do AutoAds.

Tabelas verificadas:

- `brand_audience_defaults`
- `brands`
- `campaign_assets`
- `campaign_metrics`
- `campaign_templates`
- `companies`
- `groups`
- `leads`
- `meta_ad_accounts`
- `meta_ad_accounts_v2`
- `meta_connections`
- `meta_connections_v2`
- `meta_oauth_states`
- `profiles`
- `seller_brands`
- `seller_campaigns`
- `stores`
- `user_roles`
- `vehicles`

Todas estavam com RLS habilitado na revisão.

---

## 11. `seller_campaigns` — remoção de leitura pública

Foi identificada a política pública `sc_public`, que permitia leitura anônima de campanhas ativas.

Foi investigado o código do frontend e não foi encontrada necessidade de vendedores anônimos ou visitantes públicos consultarem `seller_campaigns`.

Correção aplicada:

```sql
drop policy if exists "sc_public" on public.seller_campaigns;
```

Migration registrada:

`remove_public_seller_campaigns_select`

Após a correção, as leituras de `seller_campaigns` ficam restritas aos contextos autenticados necessários:

- Master do grupo
- Vendedor dono da campanha
- Gerente da loja

Também existe a política de seleção da loja, mantida por compatibilidade com o fluxo atual.

---

# Estado atual das principais políticas de `seller_campaigns`

- `sc_select_group` — Master dentro do próprio grupo
- `sc_select_own` — Vendedor somente suas campanhas
- `sc_select_store` — Gerente somente sua loja
- `seller_campaigns_insert_secure` — criação autenticada conforme regras do fluxo
- `seller_campaigns_select_store` — política adicional de leitura da loja, atualmente duplicada/compatível com o fluxo
- `seller_campaigns_update_secure` — vendedor atualiza somente sua própria campanha

Não existe mais política pública anônima de SELECT para `seller_campaigns`.

---

# Exclusão de campanhas

O AutoAds possui a função segura:

`public.delete_campaign_template(p_template_id uuid)`

Características:

- `SECURITY DEFINER`
- `search_path = ''`
- somente `ADMIN_MASTER`
- valida que a campanha pertence ao grupo atual
- impede exclusão se já tiver sido utilizada por qualquer `seller_campaigns`
- permite exclusão somente quando não houver dependências de campanhas de vendedores

Mensagem de proteção utilizada:

> Esta campanha já foi utilizada por vendedores e não pode ser excluída. Desative ou edite a oferta.

Isso preserva o histórico comercial e evita apagar referências de campanhas já utilizadas.

---

# Segurança do frontend x banco

O frontend possui controles de interface para Master, Gerente e Vendedor, mas a auditoria considera que esses controles não são suficientes isoladamente.

A segurança real deve permanecer no banco por meio de:

1. Supabase Auth
2. grants PostgreSQL
3. RLS
4. funções/RPCs seguras
5. validações de ownership/tenant/store

---

# Integração Meta

A integração Meta foi desenhada para que cada vendedor conecte sua própria conta/ad account.

Regras de segurança planejadas:

- token Meta armazenado no backend/servidor
- App Secret nunca exposto ao frontend
- vendedor somente acessa sua conexão
- `meta_ad_account_id_v2` deve pertencer ao vendedor autenticado
- campanha deve ser publicada somente na conta Meta vinculada ao vendedor
- OAuth callback executa no backend

Secrets esperados no ambiente:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_GRAPH_VERSION`
- `AUTOADS_APP_URL`

**Nenhum secret deve ser registrado neste documento.**

---

# Pontos ainda pendentes da auditoria

A auditoria ainda não terminou. Próximos pontos devem ser tratados um por vez.

## Próximo alvo

### `campaign_templates`

Existe/foi identificada uma política pública de SELECT (`templates_public`) para campanhas ativas.

Antes de remover, deve-se confirmar se existe algum fluxo público real que dependa dela.

Se não houver necessidade pública, a política deve ser removida e o fluxo autenticado deve ser validado.

## Outros pontos para revisão posterior

- revisar políticas duplicadas de `campaign_metrics`
- revisar políticas duplicadas de `seller_campaigns`
- revisar política `stores_master_all`, que possui `roles = public` embora a condição use `is_master()`
- revisar demais funções de trigger, especialmente qualquer `SECURITY DEFINER` ainda com `search_path` não fixado
- auditar grants de todas as funções expostas
- auditar grants de todas as tabelas expostas
- revisar colunas sensíveis que ainda podem ser retornadas por SELECT amplo
- criar/fortalecer testes automatizados de RLS para `anon`, `authenticated`, vendedor, gerente e master
- executar uma revisão final de produção antes do deploy

---

# Regra operacional da auditoria

**Uma alteração por vez → aplicar → verificar → registrar → próximo item.**

Não alterar várias políticas simultaneamente sem validação intermediária.

---

# Referências técnicas

A auditoria segue principalmente as recomendações oficiais do Supabase para:

- Row Level Security (RLS)
- grants + RLS
- `SECURITY DEFINER`
- `search_path = ''`
- schema qualification
- princípio do menor privilégio

Documentação oficial:

- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api

---

## Registro de continuidade

**Último ponto concluído:** remoção da leitura pública de `seller_campaigns` (`sc_public`).

**Próximo ponto:** investigar a necessidade real da política pública `templates_public` em `campaign_templates` antes de decidir pela remoção.

---

## Revisão de 04/10/2026

**Encontrado**

- Leitura pública (sem login) de perfis: a regra `profiles_public` permitia que qualquer pessoa com a chave pública do site lesse nome, e-mail, WhatsApp e loja de 7 vendedores. Mesmo caso, com dados menos sensíveis, para `vehicles_public` e `companies_public`. O AutoAds não usa leitura pública.
- 14 funções `SECURITY DEFINER` executáveis por `anon`. Todas verificavam o usuário por dentro, então não eram exploráveis, mas ficavam expostas.
- `bootstrap_current_user()` voltou a ser executável por usuários logados (tinha sido fechada em 14/09).
- `activate_seller_template_campaign()` sem `search_path` fixo.

**Corrigido** (migrations `20261004200000_security_hardening` e `20261004201000_relock_bootstrap_current_user`)

- `anon` sem nenhum privilégio em tabelas, sequências e funções do schema `public`, inclusive para objetos criados no futuro (default privileges).
- `autoads_cron_config`, `meta_connections` e `meta_pages` sem acesso para `authenticated` (só o servidor).
- Funções de trigger não podem mais ser chamadas diretamente por usuários logados (os triggers continuam funcionando).
- `bootstrap_current_user()` fechada de novo.
- `search_path` fixado em `activate_seller_template_campaign()`.

**Verificado**: simulando um visitante sem login, perfis, veículos e RPCs ficam bloqueados; um vendedor logado continua vendo o próprio perfil, as próprias campanhas e métricas.

**Pendente**

- Ligar a proteção contra senhas vazadas (Supabase → Authentication → Passwords). Só pelo painel.
- Remover as regras públicas inertes (`DROP POLICY`), quando der para aprovar comandos destrutivos.
- Criptografar os tokens da Meta (`meta_connections.access_token`) com o Vault do Supabase. Mexe em todas as funções que falam com a Meta; fazer em etapa própria, com teste.
- Mover a extensão `pg_net` para fora do schema `public`.

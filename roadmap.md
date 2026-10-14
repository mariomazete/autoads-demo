# Roadmap — SaaS Multi-Tenant para Vendedores de Veículos

## Decisões

## Etapa 1 — Fundação
- [ ] Ativar backend (Lovable Cloud)
- [ ] Schema multi-tenant + RLS (groups, companies, stores, sellers, vehicles, campaign_templates, seller_campaigns, meta_connections, meta_ad_accounts, campaign_metrics, leads)
- [ ] Papéis: ADMIN_MASTER, ADMIN_LOJA, VENDEDOR (tabela user_roles + has_role)
- [ ] Autenticação (login/e-mail+senha) e proteção de rotas
- [ ] Design system SaaS (limpo, premium, responsivo)

## Etapa 2 — Vendedor
- [ ] Dashboard do vendedor (cards + conexões)
- [ ] Perfil + cadastro de WhatsApp
- [ ] Catálogo "Escolha o que anunciar" (seleção múltipla)
- [ ] Definição de orçamento e confirmação
- [ ] Dashboard "Minhas campanhas"
- [ ] Vitrine pública /v/:slug

## Etapa 3 — Admin
- [ ] Gestão de grupos, empresas, lojas, vendedores
- [ ] Cadastro de veículos
- [ ] Biblioteca de campanhas / Campanhas do mês
- [ ] Visão consolidada

## Etapa 4 — Meta
- [ ] Estrutura backend MetaAdsService (OAuth, contas, campanhas, insights)
- [ ] Tela "Conectar Meta" + escolha de conta de anúncios
- [ ] Bloqueado por: credenciais META_APP_ID / META_APP_SECRET do usuário

## Fase 2 (não implementar agora)
- WhatsApp Cloud API, IA de atendimento, CRM de leads, automações, controle de custos

- [ ] Publicação real na Meta: bloqueada — conexão Meta sem permissão de Páginas (pages_show_list, pages_read_engagement, pages_manage_ads); aguarda decisão do usuário sobre o OAuth

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ADMIN_MASTER','ADMIN_LOJA','VENDEDOR');
CREATE TYPE public.campaign_status AS ENUM ('draft','pending','active','paused','finished','error');
CREATE TYPE public.entity_status AS ENUM ('active','inactive');
CREATE TYPE public.budget_type AS ENUM ('daily','lifetime');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- GROUPS
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, slug)
);
CREATE INDEX idx_companies_group ON public.companies(group_id);

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  default_radius_km INTEGER NOT NULL DEFAULT 15,
  phone TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_group ON public.stores(group_id);
CREATE INDEX idx_stores_company ON public.stores(company_id);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  job_title TEXT,
  avatar_url TEXT,
  whatsapp TEXT,
  slug TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_store ON public.profiles(store_id);
CREATE INDEX idx_profiles_group ON public.profiles(group_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_group_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT group_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN_MASTER');
$$;

CREATE OR REPLACE FUNCTION public.is_store_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN_LOJA');
$$;

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT,
  model_year INTEGER,
  price NUMERIC(12,2),
  promo_price NUMERIC(12,2),
  down_payment NUMERIC(12,2),
  installments INTEGER,
  installment_value NUMERIC(12,2),
  description TEXT,
  main_image_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_group ON public.vehicles(group_id);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);

-- CAMPAIGN TEMPLATES
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  month_label TEXT,
  headline TEXT,
  primary_text TEXT,
  description TEXT,
  cta TEXT NOT NULL DEFAULT 'Enviar mensagem',
  image_url TEXT,
  objective TEXT NOT NULL DEFAULT 'LEAD_GENERATION',
  placements JSONB NOT NULL DEFAULT '["facebook","instagram"]'::jsonb,
  radius_km INTEGER NOT NULL DEFAULT 15,
  min_daily_budget NUMERIC(10,2) NOT NULL DEFAULT 20,
  period_start DATE,
  period_end DATE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_group ON public.campaign_templates(group_id);

CREATE TABLE public.campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.campaign_templates(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'image',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_template ON public.campaign_assets(template_id);

-- META CONNECTIONS (server-only)
CREATE TABLE public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE,
  meta_user_id TEXT,
  meta_user_name TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  act_id TEXT NOT NULL,
  name TEXT,
  currency TEXT,
  account_status TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, act_id)
);
CREATE INDEX idx_ad_accounts_seller ON public.meta_ad_accounts(seller_id);

-- SELLER CAMPAIGNS
CREATE TABLE public.seller_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL,
  template_id UUID REFERENCES public.campaign_templates(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  budget_type public.budget_type NOT NULL DEFAULT 'daily',
  budget_amount NUMERIC(10,2) NOT NULL DEFAULT 20,
  radius_km INTEGER NOT NULL DEFAULT 15,
  whatsapp TEXT,
  destination_url TEXT,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  error_message TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  meta_ad_account_id TEXT,
  published_at TIMESTAMPTZ,
  source TEXT DEFAULT 'meta',
  utm_source TEXT DEFAULT 'meta',
  utm_medium TEXT DEFAULT 'paid_social',
  utm_campaign TEXT,
  utm_content TEXT,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  leads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sc_seller ON public.seller_campaigns(seller_id);
CREATE INDEX idx_sc_store ON public.seller_campaigns(store_id);
CREATE INDEX idx_sc_tenant ON public.seller_campaigns(tenant_id);
CREATE INDEX idx_sc_status ON public.seller_campaigns(status);

CREATE TABLE public.campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_campaign_id UUID NOT NULL REFERENCES public.seller_campaigns(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  cost_per_lead NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_campaign_id, metric_date)
);
CREATE INDEX idx_metrics_seller ON public.campaign_metrics(seller_id);

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.seller_campaigns(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT,
  source TEXT DEFAULT 'whatsapp_click',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  click_id TEXT,
  facebook_lead_id TEXT,
  conversion_id TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_seller ON public.leads(seller_id);
CREATE INDEX idx_leads_store ON public.leads(store_id);

-- updated_at triggers
CREATE TRIGGER t_groups_upd BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_companies_upd BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_stores_upd BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_vehicles_upd BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_templates_upd BEFORE UPDATE ON public.campaign_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_assets_upd BEFORE UPDATE ON public.campaign_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_mc_upd BEFORE UPDATE ON public.meta_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_maa_upd BEFORE UPDATE ON public.meta_ad_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_sc_upd BEFORE UPDATE ON public.seller_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_cm_upd BEFORE UPDATE ON public.campaign_metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_leads_upd BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_campaigns TO authenticated;
GRANT SELECT ON public.campaign_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT ON public.stores TO anon;
GRANT SELECT ON public.companies TO anon;
GRANT SELECT ON public.seller_campaigns TO anon;
GRANT SELECT ON public.campaign_templates TO anon;

GRANT ALL ON public.groups TO service_role;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.stores TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.vehicles TO service_role;
GRANT ALL ON public.campaign_templates TO service_role;
GRANT ALL ON public.campaign_assets TO service_role;
GRANT ALL ON public.seller_campaigns TO service_role;
GRANT ALL ON public.campaign_metrics TO service_role;
GRANT ALL ON public.meta_connections TO service_role;
GRANT ALL ON public.meta_ad_accounts TO service_role;
GRANT ALL ON public.leads TO service_role;

-- RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- groups
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated USING (id = public.current_group_id() OR public.is_master());
CREATE POLICY groups_master_all ON public.groups FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

-- companies
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated USING (group_id = public.current_group_id());
CREATE POLICY companies_public ON public.companies FOR SELECT TO anon USING (status = 'active');
CREATE POLICY companies_master_all ON public.companies FOR ALL TO authenticated USING (public.is_master() AND group_id = public.current_group_id()) WITH CHECK (public.is_master() AND group_id = public.current_group_id());

-- stores
CREATE POLICY stores_select ON public.stores FOR SELECT TO authenticated USING (group_id = public.current_group_id());
CREATE POLICY stores_public ON public.stores FOR SELECT TO anon USING (status = 'active');
CREATE POLICY stores_master_all ON public.stores FOR ALL TO authenticated USING (public.is_master() AND group_id = public.current_group_id()) WITH CHECK (public.is_master() AND group_id = public.current_group_id());

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_select_store ON public.profiles FOR SELECT TO authenticated USING (public.is_store_admin() AND store_id = public.current_store_id());
CREATE POLICY profiles_select_group ON public.profiles FOR SELECT TO authenticated USING (public.is_master() AND group_id = public.current_group_id());
CREATE POLICY profiles_public ON public.profiles FOR SELECT TO anon USING (is_public = true AND status = 'active');
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_master_all ON public.profiles FOR ALL TO authenticated USING (public.is_master() AND group_id = public.current_group_id()) WITH CHECK (public.is_master() AND group_id = public.current_group_id());

-- user_roles (read only from client)
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master());

-- vehicles
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (group_id = public.current_group_id());
CREATE POLICY vehicles_public ON public.vehicles FOR SELECT TO anon USING (status = 'active');
CREATE POLICY vehicles_manage ON public.vehicles FOR ALL TO authenticated USING ((public.is_master() OR public.is_store_admin()) AND group_id = public.current_group_id()) WITH CHECK ((public.is_master() OR public.is_store_admin()) AND group_id = public.current_group_id());

-- campaign templates
CREATE POLICY templates_select ON public.campaign_templates FOR SELECT TO authenticated USING (group_id = public.current_group_id());
CREATE POLICY templates_public ON public.campaign_templates FOR SELECT TO anon USING (status = 'active');
CREATE POLICY templates_manage ON public.campaign_templates FOR ALL TO authenticated USING (public.is_master() AND group_id = public.current_group_id()) WITH CHECK (public.is_master() AND group_id = public.current_group_id());

-- campaign assets
CREATE POLICY assets_select ON public.campaign_assets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.campaign_templates t WHERE t.id = template_id AND t.group_id = public.current_group_id()));
CREATE POLICY assets_manage ON public.campaign_assets FOR ALL TO authenticated USING (public.is_master() AND EXISTS (SELECT 1 FROM public.campaign_templates t WHERE t.id = template_id AND t.group_id = public.current_group_id())) WITH CHECK (public.is_master() AND EXISTS (SELECT 1 FROM public.campaign_templates t WHERE t.id = template_id AND t.group_id = public.current_group_id()));

-- seller campaigns
CREATE POLICY sc_select_own ON public.seller_campaigns FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY sc_select_store ON public.seller_campaigns FOR SELECT TO authenticated USING (public.is_store_admin() AND store_id = public.current_store_id());
CREATE POLICY sc_select_group ON public.seller_campaigns FOR SELECT TO authenticated USING (public.is_master() AND tenant_id = public.current_group_id());
CREATE POLICY sc_public ON public.seller_campaigns FOR SELECT TO anon USING (status = 'active');
CREATE POLICY sc_insert_own ON public.seller_campaigns FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY sc_update_own ON public.seller_campaigns FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY sc_delete_own ON public.seller_campaigns FOR DELETE TO authenticated USING (seller_id = auth.uid());

-- metrics
CREATE POLICY cm_select_own ON public.campaign_metrics FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY cm_select_store ON public.campaign_metrics FOR SELECT TO authenticated USING (public.is_store_admin() AND store_id = public.current_store_id());
CREATE POLICY cm_select_group ON public.campaign_metrics FOR SELECT TO authenticated USING (public.is_master() AND EXISTS (SELECT 1 FROM public.seller_campaigns s WHERE s.id = seller_campaign_id AND s.tenant_id = public.current_group_id()));

-- meta connections: server-only, no policies for anon/authenticated

-- meta ad accounts
CREATE POLICY maa_select_own ON public.meta_ad_accounts FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY maa_update_own ON public.meta_ad_accounts FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- leads
CREATE POLICY leads_select_own ON public.leads FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY leads_select_store ON public.leads FOR SELECT TO authenticated USING (public.is_store_admin() AND store_id = public.current_store_id());
CREATE POLICY leads_select_group ON public.leads FOR SELECT TO authenticated USING (public.is_master() AND tenant_id = public.current_group_id());
CREATE POLICY leads_update_own ON public.leads FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- BOOTSTRAP: create profile + role on first login
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name TEXT DEFAULT NULL, _email TEXT DEFAULT NULL)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _profile public.profiles;
  _has_master BOOLEAN;
  _group_id UUID;
  _base_slug TEXT;
  _slug TEXT;
  _i INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  IF FOUND THEN RETURN _profile; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADMIN_MASTER') INTO _has_master;

  IF NOT _has_master THEN
    SELECT id INTO _group_id FROM public.groups ORDER BY created_at LIMIT 1;
    IF _group_id IS NULL THEN
      INSERT INTO public.groups (name, slug) VALUES ('Meu Grupo', 'meu-grupo') RETURNING id INTO _group_id;
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'ADMIN_MASTER');
  ELSE
    SELECT id INTO _group_id FROM public.groups ORDER BY created_at LIMIT 1;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'VENDEDOR');
  END IF;

  _base_slug := regexp_replace(lower(coalesce(nullif(trim(_full_name), ''), split_part(coalesce(_email,'usuario'), '@', 1))), '[^a-z0-9]+', '-', 'g');
  _base_slug := trim(both '-' from _base_slug);
  IF _base_slug = '' THEN _base_slug := 'vendedor'; END IF;
  _slug := _base_slug;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = _slug) LOOP
    _i := _i + 1;
    _slug := _base_slug || '-' || _i;
  END LOOP;

  INSERT INTO public.profiles (id, email, full_name, slug, group_id)
  VALUES (_uid, _email, _full_name, _slug, _group_id)
  RETURNING * INTO _profile;

  RETURN _profile;
END; $$;

GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(TEXT, TEXT) TO authenticated;
CREATE TABLE IF NOT EXISTS public.crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','pending','connected','error')),
  external_account_id TEXT,
  credential_ref TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_lead_routing (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  crm_routing_enabled BOOLEAN NOT NULL DEFAULT false,
  allow_sellers_to_use_crm BOOLEAN NOT NULL DEFAULT true,
  fallback_to_seller_whatsapp BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS destination_type TEXT NOT NULL DEFAULT 'seller_whatsapp',
  ADD COLUMN IF NOT EXISTS destination_phone TEXT,
  ADD COLUMN IF NOT EXISTS attribution_key TEXT,
  ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_adset_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_integration_id UUID REFERENCES public.crm_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_status TEXT,
  ADD COLUMN IF NOT EXISTS routing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.leads
SET attribution_key = COALESCE(attribution_key, id::text)
WHERE attribution_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_attribution_key ON public.leads(attribution_key);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_store ON public.crm_integrations(store_id);
CREATE INDEX IF NOT EXISTS idx_leads_crm_integration ON public.leads(crm_integration_id);
CREATE INDEX IF NOT EXISTS idx_leads_crm_lead ON public.leads(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_destination ON public.leads(destination_type);

DROP TRIGGER IF EXISTS t_crm_integrations_upd ON public.crm_integrations;
CREATE TRIGGER t_crm_integrations_upd BEFORE UPDATE ON public.crm_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_lead_routing TO authenticated;
GRANT ALL ON public.crm_integrations TO service_role;
GRANT ALL ON public.store_lead_routing TO service_role;

ALTER TABLE public.crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_lead_routing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_integrations_select ON public.crm_integrations;
CREATE POLICY crm_integrations_select ON public.crm_integrations
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = crm_integrations.store_id
      AND s.group_id = public.current_group_id()
      AND (public.is_store_admin() AND s.id = public.current_store_id())
  )
);

DROP POLICY IF EXISTS crm_integrations_manage ON public.crm_integrations;
CREATE POLICY crm_integrations_manage ON public.crm_integrations
FOR ALL TO authenticated
USING (
  public.is_master()
  OR (public.is_store_admin() AND store_id = public.current_store_id())
)
WITH CHECK (
  public.is_master()
  OR (public.is_store_admin() AND store_id = public.current_store_id())
);

DROP POLICY IF EXISTS store_lead_routing_select ON public.store_lead_routing;
CREATE POLICY store_lead_routing_select ON public.store_lead_routing
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (public.is_store_admin() AND store_id = public.current_store_id())
  OR store_id = public.current_store_id()
);

DROP POLICY IF EXISTS store_lead_routing_manage ON public.store_lead_routing;
CREATE POLICY store_lead_routing_manage ON public.store_lead_routing
FOR ALL TO authenticated
USING (
  public.is_master()
  OR (public.is_store_admin() AND store_id = public.current_store_id())
)
WITH CHECK (
  public.is_master()
  OR (public.is_store_admin() AND store_id = public.current_store_id())
);

COMMENT ON TABLE public.crm_integrations IS 'One CRM connector per store. Credentials must be stored outside this table; credential_ref points to secure secret storage.';
COMMENT ON TABLE public.store_lead_routing IS 'Controls whether new leads from a store route to its connected CRM or fall back to the seller WhatsApp.';
COMMENT ON COLUMN public.leads.attribution_key IS 'Stable AutoAds lead attribution key linking campaign, seller, store, vehicle and ad.';
COMMENT ON COLUMN public.leads.routing_snapshot IS 'Immutable routing context captured when the lead is created.';

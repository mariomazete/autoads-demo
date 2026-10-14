import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-autoads-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function pauseMetaObject(version: string, token: string, id: string) {
  const url = new URL(`https://graph.facebook.com/${version}/${id}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ status: "PAUSED" }) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) throw new Error(data?.error?.message || `Meta HTTP ${response.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const version = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Integração não configurada." }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const cronSecret = req.headers.get("x-autoads-cron-secret");
  const { data: config } = await admin.from("autoads_cron_config").select("secret").eq("id", true).maybeSingle();
  if (!cronSecret || !config?.secret || cronSecret !== config.secret) return json({ error: "Não autorizado." }, 401);

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const { data: campaigns, error } = await admin
    .from("seller_campaigns")
    .select("id, meta_campaign_id, meta_adset_id, meta_ad_id, seller_id, status, end_date, template_id, campaign_templates(period_end, period_start)")
    .eq("status", "active");
  if (error) return json({ error: error.message }, 500);

  const expired = (campaigns ?? []).filter((campaign: any) => {
    const template = Array.isArray(campaign.campaign_templates) ? campaign.campaign_templates[0] : campaign.campaign_templates;
    const endExpired = campaign.end_date && new Date(campaign.end_date).getTime() <= now;
    const offerExpired = template?.period_end && template.period_end < today;
    return Boolean(endExpired || offerExpired);
  });

  const results: Array<Record<string, unknown>> = [];
  for (const campaign of expired) {
    const template = Array.isArray(campaign.campaign_templates) ? campaign.campaign_templates[0] : campaign.campaign_templates;
    const reason = new Date(campaign.end_date).getTime() <= now ? "data final da campanha" : `fim da validade da oferta (${template?.period_end ?? "sem data"})`;
    const { data: connection } = await admin.from("meta_connections").select("access_token, status").eq("seller_id", campaign.seller_id).maybeSingle();
    const ids = [campaign.meta_ad_id, campaign.meta_adset_id, campaign.meta_campaign_id].filter((id): id is string => typeof id === "string" && id.length > 0);
    try {
      if (ids.length && connection?.access_token && connection.status === "connected") {
        for (const id of ids) await pauseMetaObject(version, connection.access_token, id);
      } else if (ids.length) {
        throw new Error("Conta Meta do vendedor não está conectada para pausar a campanha.");
      }
      const { error: updateError } = await admin.from("seller_campaigns").update({ status: "paused", error_message: null, updated_at: new Date().toISOString() }).eq("id", campaign.id);
      if (updateError) throw updateError;
      results.push({ id: campaign.id, status: "paused", reason, meta_objects: ids.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin.from("seller_campaigns").update({ error_message: `Validade expirada: não foi possível pausar na Meta: ${message}` }).eq("id", campaign.id);
      results.push({ id: campaign.id, status: "retry_pending", reason, error: message });
    }
  }

  return json({ success: true, checked: campaigns?.length ?? 0, expired: expired.length, results });
});

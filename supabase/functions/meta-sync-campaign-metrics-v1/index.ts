import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Pulls daily results (spend, impressions, clicks, WhatsApp conversations) of every
// published AutoAds campaign from Meta and stores them in campaign_metrics, which feeds
// the master/manager performance panels. Called by the panels (master or store manager)
// and by a cron job (x-autoads-cron-secret).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-autoads-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CONVERSATION_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];

function conversations(actions: unknown) {
  if (!Array.isArray(actions)) return 0;
  for (const type of CONVERSATION_ACTIONS) {
    const match = actions.find((item: any) => item?.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

async function dailyInsights(version: string, campaignId: string, token: string) {
  const rows: any[] = [];
  let next: string | null = (() => {
    const url = new URL(`https://graph.facebook.com/${version}/${campaignId}/insights`);
    url.searchParams.set("fields", "spend,impressions,clicks,actions");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("date_preset", "maximum");
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", token);
    return url.toString();
  })();
  // A campaign lasts at most 30 days, but follow paging defensively (max 5 pages).
  for (let page = 0; next && page < 5; page++) {
    const response = await fetch(next);
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.error) throw new Error(data?.error?.message || `Meta HTTP ${response.status}`);
    rows.push(...(Array.isArray(data?.data) ? data.data : []));
    next = typeof data?.paging?.next === "string" ? data.paging.next : null;
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const version = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
  if (!url || !anon || !service) return json({ error: "Integração não configurada." }, 503);
  const admin = createClient(url, service);

  // Who is calling: the cron job (all campaigns), a master (all), a store manager (own store) or a seller (own campaigns).
  let storeScope: string | null = null;
  let sellerScope: string | null = null;
  const cronSecret = req.headers.get("x-autoads-cron-secret");
  if (cronSecret) {
    const { data: config } = await admin.from("autoads_cron_config").select("secret").eq("id", true).maybeSingle();
    if (!config?.secret || cronSecret !== config.secret) return json({ error: "Não autorizado." }, 401);
  } else {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida." }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((item) => String(item.role));
    if (!roleNames.includes("ADMIN_MASTER") && !roleNames.includes("ADMIN_LOJA")) {
      // Vendedor: atualiza só as próprias campanhas.
      if (!roleNames.includes("VENDEDOR")) return json({ error: "Acesso não permitido." }, 403);
      sellerScope = user.id;
    } else if (!roleNames.includes("ADMIN_MASTER")) {
      const { data: profile } = await admin.from("profiles").select("store_id").eq("id", user.id).maybeSingle();
      if (!profile?.store_id) return json({ error: "Gerente sem loja vinculada." }, 403);
      storeScope = profile.store_id;
    }
  }

  let query = admin
    .from("seller_campaigns")
    .select("id, seller_id, store_id, meta_campaign_id")
    .not("meta_campaign_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (storeScope) query = query.eq("store_id", storeScope);
  if (sellerScope) query = query.eq("seller_id", sellerScope);
  const { data: campaigns, error: campaignsError } = await query;
  if (campaignsError) return json({ error: campaignsError.message }, 500);
  if (!campaigns?.length) return json({ synced: 0, failed: 0 });

  const sellerIds = Array.from(new Set(campaigns.map((c) => c.seller_id)));
  const { data: connections } = await admin
    .from("meta_connections")
    .select("seller_id, access_token, status")
    .in("seller_id", sellerIds);
  const tokens = new Map(
    (connections ?? [])
      .filter((c) => c.access_token && c.status === "connected")
      .map((c) => [c.seller_id, String(c.access_token)]),
  );

  let synced = 0;
  const failures: Array<{ campaign_id: string; error: string }> = [];

  await Promise.all(
    campaigns.map(async (campaign) => {
      const token = tokens.get(campaign.seller_id);
      if (!token) {
        failures.push({ campaign_id: campaign.id, error: "Vendedor sem conexão Meta ativa." });
        return;
      }
      try {
        const rows = await dailyInsights(version, String(campaign.meta_campaign_id), token);
        if (!rows.length) return;
        const records = rows.map((row) => {
          const spend = Number(row.spend) || 0;
          const leads = conversations(row.actions);
          return {
            seller_campaign_id: campaign.id,
            seller_id: campaign.seller_id,
            store_id: campaign.store_id,
            metric_date: String(row.date_start),
            spend,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            leads,
            cost_per_lead: leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
            updated_at: new Date().toISOString(),
          };
        });
        const { error } = await admin
          .from("campaign_metrics")
          .upsert(records, { onConflict: "seller_campaign_id,metric_date" });
        if (error) throw new Error(error.message);
        // Mantém os totais da campanha iguais à soma dos dias (date_preset=maximum = vida toda).
        // Antes eles só eram atualizados quando o vendedor abria o painel, e os cards do
        // master ficavam desatualizados em relação ao gráfico e ao ranking.
        const totals = records.reduce(
          (sum, record) => ({
            spend: sum.spend + record.spend,
            impressions: sum.impressions + record.impressions,
            clicks: sum.clicks + record.clicks,
            leads: sum.leads + record.leads,
          }),
          { spend: 0, impressions: 0, clicks: 0, leads: 0 },
        );
        const spend = Math.round(totals.spend * 100) / 100;
        const { error: totalsError } = await admin
          .from("seller_campaigns")
          .update({
            spend,
            spent_amount: spend,
            impressions: totals.impressions,
            clicks: totals.clicks,
            leads_count: totals.leads,
          })
          .eq("id", campaign.id);
        if (totalsError) console.error("meta-sync-campaign-metrics-v1 totals update failed", campaign.id, totalsError.message);
        synced++;
      } catch (error) {
        failures.push({ campaign_id: campaign.id, error: error instanceof Error ? error.message : String(error) });
      }
    }),
  );

  if (failures.length) console.error("meta-sync-campaign-metrics-v1 failures", JSON.stringify(failures));
  console.log("meta-sync-campaign-metrics-v1 done", JSON.stringify({ synced, failed: failures.length, scope: storeScope ?? "all" }));
  return json({ synced, failed: failures.length, failures });
});

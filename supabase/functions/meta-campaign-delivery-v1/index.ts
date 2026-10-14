import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Mirrors the Meta delivery status (in review, delivering, rejected...) of the
// seller's published ads into seller_campaigns and returns it to the dashboard.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Delivery = { status: string; detail: string | null };

function firstText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstText(item);
      if (text) return text;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const text = firstText(item);
      if (text) return text;
    }
  }
  return null;
}

function mapDelivery(ad: any, now: number): Delivery {
  const status = String(ad?.effective_status ?? "").toUpperCase();
  const adset = ad?.adset ?? {};
  const start = adset.start_time ? new Date(adset.start_time).getTime() : null;
  const end = adset.end_time ? new Date(adset.end_time).getTime() : null;

  switch (status) {
    case "PENDING_REVIEW":
    case "IN_PROCESS":
      return { status: "in_review", detail: null };
    case "PREAPPROVED":
      return { status: "approved", detail: null };
    case "ACTIVE":
      if (end && end < now) return { status: "completed", detail: null };
      if (start && start > now) return { status: "scheduled", detail: null };
      return { status: "delivering", detail: null };
    case "DISAPPROVED":
      return {
        status: "rejected",
        detail: firstText(ad?.ad_review_feedback?.global) ?? firstText(ad?.ad_review_feedback) ?? null,
      };
    case "WITH_ISSUES": {
      const issue = Array.isArray(ad?.issues_info) ? ad.issues_info[0] : null;
      return { status: "with_issues", detail: issue?.error_summary || issue?.error_message || null };
    }
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      if (end && end < now) return { status: "completed", detail: null };
      return { status: "paused", detail: null };
    case "PENDING_BILLING_INFO":
      return { status: "billing", detail: "A conta de anúncios precisa de uma forma de pagamento válida." };
    case "ARCHIVED":
    case "DELETED":
      return { status: "deleted", detail: null };
    default:
      return { status: "unknown", detail: null };
  }
}

type Metrics = { spend: number; impressions: number; reach: number; clicks: number; conversations: number };

function actionValue(actions: unknown, types: string[]) {
  if (!Array.isArray(actions)) return 0;
  for (const type of types) {
    const match = actions.find((item: any) => item?.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

async function fetchMetrics(version: string, campaignId: string, token: string): Promise<Metrics | null> {
  const url = new URL(`https://graph.facebook.com/${version}/${campaignId}/insights`);
  url.searchParams.set("fields", "impressions,reach,clicks,spend,actions");
  url.searchParams.set("date_preset", "maximum");
  url.searchParams.set("access_token", token);
  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      console.error("meta-campaign-delivery-v1 insights error", campaignId, JSON.stringify(data?.error ?? { http: response.status }));
      return null;
    }
    const row = Array.isArray(data?.data) ? data.data[0] : null;
    // No row yet means the campaign has not delivered anything.
    if (!row) return { spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 };
    return {
      spend: Number(row.spend) || 0,
      impressions: Number(row.impressions) || 0,
      reach: Number(row.reach) || 0,
      clicks: Number(row.clicks) || 0,
      conversations: actionValue(row.actions, [
        "onsite_conversion.messaging_conversation_started_7d",
        "onsite_conversion.total_messaging_connection",
      ]),
    };
  } catch (error) {
    console.error("meta-campaign-delivery-v1 insights fetch failed", campaignId, String(error));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const version = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
  if (!url || !anon || !service) return json({ error: "Integração não configurada." }, 503);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Sessão inválida." }, 401);

  const admin = createClient(url, service);

  const { data: campaigns, error: campaignsError } = await admin
    .from("seller_campaigns")
    .select("id, meta_ad_id, meta_campaign_id")
    .eq("seller_id", user.id)
    .is("archived_at", null)
    .not("meta_ad_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (campaignsError) return json({ error: "Não foi possível carregar as campanhas." }, 500);
  if (!campaigns?.length) {
    console.log("meta-campaign-delivery-v1 no published campaigns", user.id);
    return json({ statuses: [] });
  }

  const { data: connection } = await admin
    .from("meta_connections")
    .select("access_token, status")
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!connection?.access_token || connection.status !== "connected") {
    console.error("meta-campaign-delivery-v1 no connection", user.id);
    return json({ error: "Conta Meta não conectada.", statuses: [] }, 200);
  }

  // The batch "ids" parameter was removed in Graph v26, so each ad is fetched individually.
  const fields = "effective_status,configured_status,issues_info,ad_review_feedback,adset{start_time,end_time}";
  const token = String(connection.access_token);
  const ads: Record<string, any> = {};
  const failed = new Set<string>();
  await Promise.all(
    campaigns.map(async (campaign) => {
      const adId = String(campaign.meta_ad_id);
      const graphUrl = new URL(`https://graph.facebook.com/${version}/${adId}`);
      graphUrl.searchParams.set("fields", fields);
      graphUrl.searchParams.set("access_token", token);
      try {
        const response = await fetch(graphUrl);
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.error) {
          // Code 100 / subcode 33: the object does not exist anymore (deleted on Meta's side).
          if (data?.error?.code === 100 && data?.error?.error_subcode === 33) return;
          console.error("meta-campaign-delivery-v1 graph error", adId, JSON.stringify(data?.error ?? { http: response.status }));
          failed.add(adId);
          return;
        }
        ads[adId] = data;
      } catch (error) {
        console.error("meta-campaign-delivery-v1 fetch failed", adId, String(error));
        failed.add(adId);
      }
    }),
  );

  const metrics: Record<string, Metrics | null> = {};
  await Promise.all(
    campaigns
      .filter((campaign) => campaign.meta_campaign_id)
      .map(async (campaign) => {
        metrics[campaign.id] = await fetchMetrics(version, String(campaign.meta_campaign_id), token);
      }),
  );

  const now = Date.now();
  const checkedAt = new Date().toISOString();
  const statuses = [];

  for (const campaign of campaigns) {
    const adId = String(campaign.meta_ad_id);
    if (failed.has(adId)) continue;
    const ad = ads[adId];
    // An ad Meta reports as nonexistent was deleted on Meta's side.
    const delivery = ad ? mapDelivery(ad, now) : { status: "deleted", detail: null };
    const metric = metrics[campaign.id] ?? null;
    statuses.push({ campaign_id: campaign.id, ...delivery, metrics: metric, checked_at: checkedAt });

    const { error } = await admin
      .from("seller_campaigns")
      .update({
        meta_delivery_status: delivery.status,
        meta_delivery_detail: delivery.detail,
        meta_delivery_checked_at: checkedAt,
        ...(metric
          ? {
              spend: metric.spend,
              spent_amount: metric.spend,
              impressions: metric.impressions,
              clicks: metric.clicks,
              leads_count: metric.conversations,
            }
          : {}),
      })
      .eq("id", campaign.id)
      .eq("seller_id", user.id);
    if (error) console.error("meta-campaign-delivery-v1 update failed", campaign.id, error.message);
  }

  console.log("meta-campaign-delivery-v1 synced", JSON.stringify(statuses.map((s) => ({ id: s.campaign_id, status: s.status }))));
  return json({ statuses, checked_at: checkedAt });
});

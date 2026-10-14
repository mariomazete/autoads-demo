import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const n = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? number : 0; };
const action = (actions: unknown, types: string[]) => Array.isArray(actions) ? actions.reduce((sum: number, item: any) => types.includes(String(item?.action_type ?? "")) ? sum + n(item?.value) : sum, 0) : 0;
const emptyMetrics = () => ({ spend: 0, impressions: 0, clicks: 0, conversations: 0, reach: 0, ctr: 0, cpc: 0, cpm: 0 });
const addMetrics = (target: any, row: any) => { target.spend += n(row?.spend); target.impressions += n(row?.impressions); target.clicks += n(row?.clicks); target.conversations += action(row?.actions, ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_conversation_started"]); target.reach = Math.max(target.reach, n(row?.reach)); };
const finalize = (metrics: any) => ({ ...metrics, ctr: metrics.impressions ? (metrics.clicks / metrics.impressions) * 100 : 0, cpc: metrics.clicks ? metrics.spend / metrics.clicks : 0, cpm: metrics.impressions ? (metrics.spend / metrics.impressions) * 1000 : 0 });
async function graph(url: URL) { const response = await fetch(url); const data = await response.json(); if (!response.ok || data?.error) throw new Error(data?.error?.message || "A Meta não permitiu consultar os insights."); return data; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const version = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Integração não configurada." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Sessão inválida." }, 401);

  const { data: profile, error: profileError } = await admin.from("profiles").select("store_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.store_id) return json({ error: "Gerente sem loja vinculada." }, 403);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "ADMIN_LOJA").maybeSingle();
  if (!role) return json({ error: "Acesso permitido somente ao gerente da loja." }, 403);

  const { data: sellers, error: sellersError } = await admin.from("profiles").select("id,full_name").eq("store_id", profile.store_id).eq("status", "active");
  if (sellersError) return json({ error: "Não foi possível carregar os vendedores da loja." }, 500);
  const sellerIds = (sellers ?? []).map((seller) => seller.id);
  if (!sellerIds.length) return json({ period: "last_30d", store_id: profile.store_id, store: finalize(emptyMetrics()), sellers: [] });

  const { data: campaigns } = await admin.from("seller_campaigns").select("seller_id,meta_campaign_id").eq("store_id", profile.store_id).in("seller_id", sellerIds).not("meta_campaign_id", "is", null);
  const campaignIdsBySeller = new Map<string, string[]>();
  for (const campaign of campaigns ?? []) { const id = String(campaign.meta_campaign_id ?? "").trim(); if (!id) continue; const list = campaignIdsBySeller.get(campaign.seller_id) ?? []; list.push(id); campaignIdsBySeller.set(campaign.seller_id, list); }

  const { data: connections } = await admin.from("meta_connections").select("seller_id,access_token,status").in("seller_id", sellerIds).eq("status", "connected");
  const { data: accounts } = await admin.from("meta_ad_accounts_v2").select("seller_id,external_account_id,name,status").in("seller_id", sellerIds).eq("status", "active");
  const connectionBySeller = new Map((connections ?? []).map((row) => [row.seller_id, row]));
  const accountBySeller = new Map((accounts ?? []).map((row) => [row.seller_id, row]));
  const fields = "impressions,clicks,spend,reach,actions";

  const sellerResults = await Promise.all((sellers ?? []).map(async (seller) => {
    const result = emptyMetrics();
    const connection = connectionBySeller.get(seller.id);
    const account = accountBySeller.get(seller.id);
    const campaignIds = campaignIdsBySeller.get(seller.id) ?? [];
    if (!connection?.access_token || !account?.external_account_id) return { seller_id: seller.id, seller_name: seller.full_name ?? "Sem nome", metrics: finalize(result), connected: false, campaigns_mapped: campaignIds.length };

    try {
      const url = new URL(`https://graph.facebook.com/${version}/${account.external_account_id}/insights`);
      url.searchParams.set("fields", fields);
      url.searchParams.set("date_preset", "last_30d");
      url.searchParams.set("level", campaignIds.length ? "campaign" : "account");
      url.searchParams.set("time_increment", "all_days");
      url.searchParams.set("limit", "100");
      if (campaignIds.length) url.searchParams.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]));
      url.searchParams.set("access_token", connection.access_token);
      const data = await graph(url);
      for (const row of Array.isArray(data?.data) ? data.data : []) addMetrics(result, row);
      return { seller_id: seller.id, seller_name: seller.full_name ?? "Sem nome", metrics: finalize(result), connected: true, campaigns_mapped: campaignIds.length, source: campaignIds.length ? "campaigns" : "ad_account" };
    } catch (error) {
      return { seller_id: seller.id, seller_name: seller.full_name ?? "Sem nome", metrics: finalize(result), connected: true, campaigns_mapped: campaignIds.length, error: error instanceof Error ? error.message : "Erro ao consultar a Meta" };
    }
  }));

  const storeMetrics = emptyMetrics();
  for (const seller of sellerResults) { storeMetrics.spend += seller.metrics.spend; storeMetrics.impressions += seller.metrics.impressions; storeMetrics.clicks += seller.metrics.clicks; storeMetrics.conversations += seller.metrics.conversations; storeMetrics.reach = Math.max(storeMetrics.reach, seller.metrics.reach); }
  return json({ period: "last_30d", store_id: profile.store_id, store: finalize(storeMetrics), sellers: sellerResults, fetched_at: new Date().toISOString() });
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Pauses or reactivates a seller campaign on Meta and keeps seller_campaigns in sync.
// Pausing on Meta happens first, so the ad really stops even if the DB update fails.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function setMetaStatus(version: string, objectId: string, status: "PAUSED" | "ACTIVE", token: string) {
  const response = await fetch(`https://graph.facebook.com/${version}/${objectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status, access_token: token }).toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    const error = data?.error ?? {};
    throw new Error(error.error_user_msg || error.message || `Meta HTTP ${response.status}`);
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

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaign_id === "string" ? body.campaign_id : null;
  const target = body?.status === "paused" ? "paused" : body?.status === "active" ? "active" : null;
  if (!campaignId || !target) return json({ error: "Parâmetros inválidos." }, 400);

  const admin = createClient(url, service);
  const { data: campaign, error: campaignError } = await admin
    .from("seller_campaigns")
    .select("id, status, meta_campaign_id, seller_id, store_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) return json({ error: "Não foi possível carregar a campanha." }, 500);
  if (!campaign) return json({ error: "Campanha não encontrada." }, 404);

  // The seller owns the campaign; the store manager and the master may also pause/reactivate it.
  if (campaign.seller_id !== user.id) {
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((item) => String(item.role));
    let allowed = roleNames.includes("ADMIN_MASTER");
    if (!allowed && roleNames.includes("ADMIN_LOJA")) {
      const { data: profile } = await admin.from("profiles").select("store_id").eq("id", user.id).maybeSingle();
      allowed = Boolean(profile?.store_id) && profile?.store_id === campaign.store_id;
    }
    if (!allowed) return json({ error: "Campanha não encontrada." }, 404);
  }
  const ownerId = String(campaign.seller_id);

  const updateDb = (status: string) =>
    admin
      .from("seller_campaigns")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === "paused" ? { meta_delivery_status: "paused", meta_delivery_detail: null } : {}),
      })
      .eq("id", campaign.id)
      .eq("seller_id", ownerId);

  // Campaign never reached Meta: it can be paused in AutoAds, but never marked as running.
  if (!campaign.meta_campaign_id) {
    if (target === "active") {
      return json(
        { error: "Esta campanha não foi publicada na Meta. Exclua o card e publique de novo depois de resolver o erro." },
        400,
      );
    }
    const { error } = await updateDb(target);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true, status: target, meta_updated: false });
  }

  const { data: connection } = await admin
    .from("meta_connections")
    .select("access_token, status")
    .eq("seller_id", ownerId)
    .maybeSingle();
  if (!connection?.access_token || connection.status !== "connected") {
    return json({ error: "A conta Meta do vendedor não está conectada. Reconecte a Meta ou pause pelo Gerenciador de Anúncios." }, 409);
  }
  const token = String(connection.access_token);
  const metaCampaignId = String(campaign.meta_campaign_id);

  if (target === "paused") {
    try {
      await setMetaStatus(version, metaCampaignId, "PAUSED", token);
    } catch (error) {
      return json({ error: `A Meta não pausou o anúncio: ${error instanceof Error ? error.message : String(error)}` }, 502);
    }
    const { error } = await updateDb("paused");
    if (error) console.error("meta-set-campaign-status-v1: paused on Meta but DB update failed", error.message);
    return json({ success: true, status: "paused", meta_updated: true });
  }

  // Reactivation: the DB update runs first so validity rules (expired offer, etc.) can block it.
  const previousStatus = campaign.status;
  const { error: activateError } = await updateDb("active");
  if (activateError) return json({ error: activateError.message }, 400);
  try {
    await setMetaStatus(version, metaCampaignId, "ACTIVE", token);
  } catch (error) {
    await updateDb(previousStatus);
    return json({ error: `A Meta não reativou o anúncio: ${error instanceof Error ? error.message : String(error)}` }, 502);
  }
  return json({ success: true, status: "active", meta_updated: true });
});

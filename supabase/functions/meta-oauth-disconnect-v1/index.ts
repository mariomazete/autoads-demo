import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "v26.0";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: "Integração Supabase não configurada." }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Não autenticado." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ success: false, error: "Sessão inválida ou expirada." }, 401);

  const sellerId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error: connectionError } = await admin
    .from("meta_connections")
    .select("id, access_token")
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (connectionError) return json({ success: false, error: "Não foi possível localizar a conexão Meta." }, 500);

  let metaRevoked = false;
  let revokeWarning = "";

  if (connection?.access_token) {
    try {
      const revokeUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/permissions`);
      revokeUrl.searchParams.set("access_token", connection.access_token);
      const revokeResponse = await fetch(revokeUrl, { method: "DELETE" });
      const revokeData = await revokeResponse.json().catch(() => ({}));
      if (revokeResponse.ok && revokeData?.success !== false) {
        metaRevoked = true;
      } else {
        revokeWarning = revokeData?.error?.message || "A Meta não confirmou a revogação da autorização.";
      }
    } catch (error) {
      revokeWarning = error instanceof Error ? error.message : "Não foi possível confirmar a revogação na Meta.";
    }
  }

  const { data: referencedAccounts } = await admin
    .from("seller_campaigns")
    .select("id")
    .eq("seller_id", sellerId)
    .not("meta_ad_account_id_v2", "is", null)
    .limit(1);

  if ((referencedAccounts ?? []).length > 0) {
    await admin.from("meta_ad_accounts_v2").update({ status: "disabled" }).eq("seller_id", sellerId);
  } else {
    const { error: deleteV2Error } = await admin.from("meta_ad_accounts_v2").delete().eq("seller_id", sellerId);
    if (deleteV2Error) return json({ success: false, error: "Não foi possível limpar a conta de anúncios vinculada." }, 500);
  }

  await admin.from("meta_ad_accounts").delete().eq("seller_id", sellerId);

  const { error: legacyError } = await admin
    .from("meta_connections")
    .update({
      status: "disconnected",
      access_token: null,
      token_expires_at: null,
      scopes: null,
      last_error: revokeWarning ? revokeWarning.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("seller_id", sellerId);

  if (legacyError) return json({ success: false, error: "A conexão não pôde ser encerrada." }, 500);

  const { error: v2Error } = await admin
    .from("meta_connections_v2")
    .update({
      status: "disconnected",
      last_error: revokeWarning ? revokeWarning.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("seller_id", sellerId)
    .eq("provider", "meta");

  if (v2Error) return json({ success: false, error: "A conexão Meta foi parcialmente encerrada. Tente novamente." }, 500);

  return json({
    success: true,
    meta_revoked: metaRevoked,
    warning: revokeWarning || null,
  });
});

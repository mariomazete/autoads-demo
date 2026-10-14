import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (event: string, details: Record<string, unknown> = {}) =>
  console.log("autoads-meta-diagnostic", JSON.stringify({ event, timestamp: new Date().toISOString(), ...details }));

function redirect(url: string) { return Response.redirect(url, 302); }

function safeRedirect(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function graph(version: string, path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    const error = data?.error ?? {};
    throw new Error(error.message || `Meta Graph HTTP ${response.status}`);
  }
  return data;
}

async function discoverPages(version: string, token: string, sellerId: string) {
  const found: any[] = [];
  let businessCount = 0;

  try {
    const businesses = await graph(version, "me/businesses", { fields: "id,name", limit: "100", access_token: token });
    const rows = Array.isArray(businesses?.data) ? businesses.data : [];
    businessCount = rows.length;
    log("meta_businesses_lookup", { seller_id: sellerId, result_count: rows.length });

    for (const business of rows) {
      if (!business?.id) continue;
      try {
        const pages = await graph(version, `${business.id}/owned_pages`, {
          fields: "id,name",
          limit: "100",
          access_token: token,
        });
        for (const page of Array.isArray(pages?.data) ? pages.data : []) {
          if (page?.id) found.push({ id: String(page.id), name: page.name ?? null, business_id: String(business.id), business_name: business.name ?? null });
        }
      } catch (error) {
        log("meta_business_owned_pages_failed", { seller_id: sellerId, business_id: business.id, error: String(error) });
      }
    }
  } catch (error) {
    log("meta_businesses_lookup_failed", { seller_id: sellerId, error: String(error) });
  }

  if (!found.length) {
    try {
      const pages = await graph(version, "me/accounts", { fields: "id,name", limit: "100", access_token: token });
      for (const page of Array.isArray(pages?.data) ? pages.data : []) {
        if (page?.id) found.push({ id: String(page.id), name: page.name ?? null, business_id: null, business_name: null });
      }
      log("meta_pages_lookup_fallback", { seller_id: sellerId, result_count: found.length });
    } catch (error) {
      log("meta_pages_lookup_fallback_failed", { seller_id: sellerId, error: String(error) });
    }
  }

  return { pages: Array.from(new Map(found.map((p) => [p.id, p])).values()), businessCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const version = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
  const redirectUri = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/meta-oauth-callback-v1` : "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appId || !appSecret || !redirectUri) return new Response("Integração Meta não configurada.", { status: 503 });

  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === "POST") {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json().catch(() => ({}));
    let returnTo: URL;
    try {
      returnTo = new URL(body?.return_to);
      if (returnTo.protocol !== "https:" && returnTo.hostname !== "localhost") throw new Error();
    } catch {
      return json({ error: "Endereço de retorno inválido." }, 400);
    }

    const state = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { error } = await admin.from("meta_oauth_states").insert({
      seller_id: userData.user.id,
      state,
      redirect_to: returnTo.toString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: "Não foi possível iniciar a conexão Meta." }, 500);

    const requestedScopes = [
      "ads_management",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ];
    // WhatsApp scopes are intentionally NOT requested: the Meta app does not have the
    // WhatsApp product enabled (Meta rejects them as "Invalid Scopes"), and click-to-WhatsApp
    // ads only require the WhatsApp number to be linked to the Facebook Page.

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: requestedScopes.join(","),
    });

    log("oauth_started", {
      seller_id: userData.user.id,
      graph_version: version,
      requested_scopes: requestedScopes,
      whatsapp_authorization_requested: false,
    });

    return json({ url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}` });
  }

  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);

  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const metaError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  if (!state) return new Response("Estado OAuth ausente.", { status: 400 });

  const { data: oauthState, error: stateError } = await admin
    .from("meta_oauth_states")
    .select("id,seller_id,redirect_to,expires_at,used_at")
    .eq("state", state)
    .maybeSingle();

  if (stateError || !oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
    return new Response("Estado OAuth inválido ou expirado.", { status: 400 });
  }

  const finish = async (params: Record<string, string>) => {
    await admin.from("meta_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", oauthState.id);
    return redirect(safeRedirect(oauthState.redirect_to, params));
  };

  if (metaError || !code) return finish({ meta: "error", reason: "autorizacao_negada" });

  try {
    const shortToken = await graph(version, "oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    let accessToken = String(shortToken.access_token);
    let expiresIn = Number(shortToken.expires_in || 3600);

    try {
      const longToken = await graph(version, "oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: accessToken,
      });
      if (longToken.access_token) accessToken = String(longToken.access_token);
      if (longToken.expires_in) expiresIn = Number(longToken.expires_in);
    } catch {
      // Keep short token when Meta does not allow exchange in the current app state.
    }

    const me = await graph(version, "me", { fields: "id,name", access_token: accessToken });
    let availablePermissions: string[] = [];
    try {
      const permissions = await graph(version, "me/permissions", { access_token: accessToken });
      availablePermissions = Array.isArray(permissions?.data)
        ? permissions.data.filter((p: any) => String(p?.status || "").toLowerCase() === "granted").map((p: any) => String(p.permission))
        : [];
    } catch (error) {
      log("meta_permissions_lookup_failed", { seller_id: oauthState.seller_id, error: String(error) });
    }

    const requiredWhatsappPermissions = ["whatsapp_business_management", "whatsapp_business_messaging"];
    const missingWhatsappPermissions = requiredWhatsappPermissions.filter((p) => !availablePermissions.includes(p));

    log("effective_permissions_summary", {
      seller_id: oauthState.seller_id,
      meta_user_id: me?.id ?? null,
      permissions: availablePermissions,
      whatsapp_permissions_granted: requiredWhatsappPermissions.filter((p) => availablePermissions.includes(p)),
      whatsapp_permissions_missing: missingWhatsappPermissions,
    });

    const accounts = await graph(version, "me/adaccounts", {
      fields: "id,name,currency,account_status",
      limit: "100",
      access_token: accessToken,
    });
    const returnedAccounts = Array.isArray(accounts?.data) ? accounts.data : [];

    const { pages, businessCount } = await discoverPages(version, accessToken, oauthState.seller_id);
    const selectedPage = pages[0] ?? null;

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const scopes = availablePermissions.length
      ? availablePermissions.join(",")
      : "ads_management,pages_show_list,pages_read_engagement,business_management";

    const { data: existingConnection, error: existingConnectionError } = await admin
      .from("meta_connections")
      .select("id")
      .eq("seller_id", oauthState.seller_id)
      .maybeSingle();
    if (existingConnectionError) throw existingConnectionError;

    let connectionId: string;
    if (existingConnection?.id) {
      connectionId = existingConnection.id;
      const { error } = await admin.from("meta_connections").update({
        meta_user_id: String(me.id),
        meta_user_name: me.name ?? null,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        scopes,
        status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", connectionId).eq("seller_id", oauthState.seller_id);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from("meta_connections").insert({
        seller_id: oauthState.seller_id,
        meta_user_id: String(me.id),
        meta_user_name: me.name ?? null,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        scopes,
        status: "connected",
        last_error: null,
      }).select("id").single();
      if (error || !data) throw error || new Error("Conexão Meta não foi persistida.");
      connectionId = data.id;
    }

    const { data: existingV2, error: v2LookupError } = await admin
      .from("meta_connections_v2")
      .select("id")
      .eq("seller_id", oauthState.seller_id)
      .eq("provider", "meta")
      .maybeSingle();
    if (v2LookupError) throw v2LookupError;

    let v2ConnectionId: string;
    if (existingV2?.id) {
      v2ConnectionId = existingV2.id;
      const { error } = await admin.from("meta_connections_v2").update({
        external_user_id: String(me.id),
        status: "connected",
        connected_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", v2ConnectionId).eq("seller_id", oauthState.seller_id);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from("meta_connections_v2").insert({
        seller_id: oauthState.seller_id,
        provider: "meta",
        external_user_id: String(me.id),
        status: "connected",
        connected_at: new Date().toISOString(),
        last_error: null,
      }).select("id").single();
      if (error || !data) throw error || new Error("Conexão Meta v2 não foi persistida.");
      v2ConnectionId = data.id;
    }

    await admin.from("meta_ad_accounts").delete().eq("seller_id", oauthState.seller_id);
    const accountRows = returnedAccounts.map((account: any) => ({
      connection_id: connectionId,
      seller_id: oauthState.seller_id,
      act_id: String(account.id),
      name: account.name ?? `Conta ${account.id}`,
      currency: account.currency ?? null,
      account_status: account.account_status == null ? null : String(account.account_status),
      is_selected: false,
    }));
    if (accountRows.length) {
      const { error } = await admin.from("meta_ad_accounts").insert(accountRows);
      if (error) throw error;
    }
    const selectedAccount = accountRows.find((a: any) => a.account_status === "1") ?? accountRows[0] ?? null;

    await admin.from("meta_pages").delete().eq("seller_id", oauthState.seller_id);
    if (selectedPage?.id) {
      const { error } = await admin.from("meta_pages").insert({
        seller_id: oauthState.seller_id,
        meta_connection_id: v2ConnectionId,
        page_id: String(selectedPage.id),
        page_name: selectedPage.name ?? null,
        status: "active",
      });
      if (error) throw error;
    }

    await admin.from("meta_ad_accounts_v2").delete().eq("seller_id", oauthState.seller_id);
    if (selectedAccount) {
      const { error } = await admin.from("meta_ad_accounts_v2").insert({
        seller_id: oauthState.seller_id,
        meta_connection_id: v2ConnectionId,
        external_account_id: selectedAccount.act_id,
        name: selectedAccount.name,
        status: "active",
      });
      if (error) throw error;
      const { error: selectError } = await admin.from("meta_ad_accounts").update({ is_selected: true })
        .eq("seller_id", oauthState.seller_id).eq("act_id", selectedAccount.act_id);
      if (selectError) throw selectError;
    }

    log("oauth_persisted_assets", {
      seller_id: oauthState.seller_id,
      meta_user_id: me?.id ?? null,
      selected_ad_account_id: selectedAccount?.act_id ?? null,
      selected_page_id: selectedPage?.id ?? null,
      selected_page_name: selectedPage?.name ?? null,
      page_count: pages.length,
      business_count: businessCount,
      whatsapp_permissions_missing: missingWhatsappPermissions,
    });

    return finish({
      meta: "connected",
      accounts: String(accountRows.length),
      pages: String(pages.length),
      whatsapp_permissions: missingWhatsappPermissions.length ? "missing" : "granted",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("meta-oauth-callback-v1 failed", message);
    await admin.from("meta_connections_v2").upsert({
      seller_id: oauthState.seller_id,
      provider: "meta",
      status: "error",
      last_error: message.slice(0, 500),
    }, { onConflict: "seller_id,provider" });
    return finish({ meta: "error", reason: "falha_conexao" });
  }
});

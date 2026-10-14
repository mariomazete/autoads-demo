import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Atualiza um anúncio JÁ PUBLICADO com a versão atual da oferta (fotos, texto e título),
// mantendo a mesma campanha e o mesmo conjunto de anúncios na Meta.
// Também estende a data de fim até a validade da oferta (campanhas contínuas) e, se pedido,
// reativa o anúncio. Quem pode chamar: o próprio vendedor, o gerente da loja ou o master.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

class StepError extends Error {
  constructor(public step: string, message: string) {
    super(message);
  }
}

async function graph(version: string, step: string, path: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  const init: RequestInit = { method };
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else {
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    init.body = new URLSearchParams(params).toString();
  }
  let response: Response;
  let data: any;
  try {
    response = await fetch(url, init);
    data = await response.json().catch(() => null);
  } catch (e) {
    throw new StepError(step, String(e));
  }
  if (!response.ok || data?.error) {
    const e = data?.error ?? {};
    throw new StepError(step, e.error_user_msg || e.message || `HTTP ${response.status}`);
  }
  return data;
}

// A Meta limita alterações seguidas no mesmo objeto (#613: 1 chamada a cada 30 s; #80004/#17: limite da conta).
// Espera e tenta de novo em vez de falhar.
const isRateLimit = (e: unknown) => e instanceof StepError && /#(613|80004|17)\b|rate limit/i.test(e.message);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function graphRetry(version: string, step: string, path: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  for (let attempt = 0; ; attempt++) {
    try {
      return await graph(version, step, path, params, method);
    } catch (e) {
      if (!isRateLimit(e) || attempt >= 2) throw e;
      console.log("meta-update-seller-campaign-v1 rate-limit-wait", JSON.stringify({ step, attempt }));
      await sleep(32_000);
    }
  }
}

function whatsapp(v: string | null) {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("55") ? d : d.length === 10 || d.length === 11 ? `55${d}` : d;
}

// media_items pode vir como lista de URLs (oferta do master) ou de objetos {url,type,position} (oferta do gerente).
function carouselItems(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((x: any, i: number) => (typeof x === "string" ? { url: x, type: "image", position: i } : x))
    .filter((x: any) => x?.url && (x?.type === "image" || !x?.type))
    .sort((a: any, b: any) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .slice(0, 10);
}

// Mensagem pronta que o cliente envia ao tocar no anúncio (e saudação exibida para ele).
function welcomeMessage(title: string) {
  const offer = String(title || "").trim();
  const content = offer ? `Olá! Vi o anúncio "${offer}" e quero mais informações.` : "Olá! Vi o anúncio e quero mais informações.";
  return JSON.stringify({
    type: "VISUAL_EDITOR", version: 2, landing_screen_type: "welcome_message", media_type: "text",
    text_format: { customer_action_type: "autofill_message", message: { autofill_message: { content }, text: "Olá! Obrigado pelo interesse. Já vamos te atender por aqui." } },
  });
}

// Data local (Brasília) de hoje, YYYY-MM-DD.
const todayBr = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Foto única (primeira foto da oferta) e público fixo. Com USE_ADVANTAGE_AUDIENCE = false, a atualização desliga o
// Público Advantage+ dos anúncios em que ele estava ligado e restaura a idade da campanha.
const USE_CAROUSEL = false;
const USE_ADVANTAGE_AUDIENCE = false;

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
  const activate = body?.activate !== false;
  if (!campaignId) return json({ error: "Parâmetros inválidos." }, 400);

  const admin = createClient(url, service);
  const { data: campaign } = await admin
    .from("seller_campaigns")
    .select("id, name, seller_id, store_id, template_id, status, archived_at, duration_days, end_date, whatsapp, meta_ad_account_id, meta_campaign_id, meta_adset_id, meta_ad_id, audience_age_min, audience_age_max")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return json({ error: "Campanha não encontrada." }, 404);

  // Vendedor dono, gerente da mesma loja ou master.
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

  const fail = (step: string, message: string) => json({ success: false, step, error: message }, 200);

  if (campaign.archived_at) return fail("Campanha", "Esta campanha está arquivada.");
  if (!campaign.meta_campaign_id || !campaign.meta_adset_id || !campaign.meta_ad_id || !campaign.meta_ad_account_id)
    return fail("Campanha", "Esta campanha ainda não foi publicada na Meta. Use a publicação normal.");

  const { data: template } = await admin
    .from("campaign_templates")
    .select("id, title, model, description, primary_text, headline, image_url, media_type, media_url, media_items, period_end, status")
    .eq("id", campaign.template_id)
    .maybeSingle();
  if (!template) return fail("Oferta", "A oferta desta campanha não foi encontrada.");
  if (template.status !== "active") return fail("Oferta", "A oferta está pausada. Reative a oferta antes de atualizar os anúncios.");
  if (template.period_end && template.period_end < todayBr())
    return fail("Oferta", "A validade da oferta já passou. Atualize a data de fim da oferta antes de publicar.");
  if (template.media_type === "video") return fail("Criativo", "Atualização de anúncio com vídeo ainda não está habilitada.");

  const continuous = campaign.duration_days == null;
  if (!continuous && campaign.end_date && new Date(campaign.end_date).getTime() <= Date.now())
    return fail("Campanha", "Esta campanha tinha período fixo e já terminou. Publique uma campanha nova com a oferta.");

  const phone = whatsapp(campaign.whatsapp);
  if (!phone) return fail("Anúncio", "A campanha não possui WhatsApp do vendedor.");

  const sellerId = String(campaign.seller_id);
  const { data: connection } = await admin.from("meta_connections").select("access_token, status").eq("seller_id", sellerId).maybeSingle();
  if (!connection?.access_token || connection.status !== "connected")
    return fail("Conexão Meta", "A conta Meta deste vendedor não está conectada.");
  const token = String(connection.access_token);

  const { data: storedPage } = await admin
    .from("meta_pages")
    .select("page_id")
    .eq("seller_id", sellerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!storedPage?.page_id) return fail("Página do Facebook", "Nenhuma Página do Facebook encontrada para este vendedor. Reconecte a conta Meta.");
  const pageId = String(storedPage.page_id);
  const act = String(campaign.meta_ad_account_id).startsWith("act_") ? String(campaign.meta_ad_account_id) : `act_${campaign.meta_ad_account_id}`;

  try {
    // 0. Conjunto atual: o número do WhatsApp está gravado nele? Se sim, o anúncio usa o link genérico
    //    e a mensagem pronta (formato oficial da Meta para anúncios de WhatsApp).
    const adset = await graphRetry(version, "Conjunto de anúncios", campaign.meta_adset_id, { fields: "targeting,status,promoted_object", access_token: token });
    const adsetNumber = String(adset?.promoted_object?.whatsapp_phone_number ?? "").replace(/\D/g, "");
    console.log("meta-update-seller-campaign-v1 promoted-object", JSON.stringify({ campaign_id: campaign.id, keys: Object.keys(adset?.promoted_object ?? {}), has_number: Boolean(adsetNumber) }));
    const linkedNumber = adsetNumber !== "" && adsetNumber === phone;

    // 1. Novo criativo com foto e texto atuais da oferta (mesma estrutura da publicação).
    const carousel = carouselItems(template.media_items);
    const mediaUrl = carousel[0]?.url || template.media_url || template.image_url;
    if (!mediaUrl) return fail("Criativo", "A oferta não possui foto para o anúncio.");
    const title = template.headline || template.title || template.model || campaign.name;
    const phoneLink = `https://api.whatsapp.com/send?phone=${phone}`;
    const link = linkedNumber ? "https://api.whatsapp.com/send" : phoneLink;
    const ld: any = {
      message: template.primary_text || template.description || template.title || template.model || campaign.name,
      name: title || undefined,
      link,
      call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } },
    };
    if (USE_CAROUSEL && carousel.length > 1) ld.child_attachments = carousel.map((x: any) => ({ link, picture: String(x.url), name: title }));
    else ld.picture = mediaUrl;
    const name = `AutoAds | ${template.title || template.model || campaign.name}`;
    if (linkedNumber) ld.page_welcome_message = welcomeMessage(title);
    const createCreative = () =>
      graphRetry(version, "Criativo", `${act}/adcreatives`, {
        name: `${name} | Criativo ${todayBr()}`,
        object_story_spec: JSON.stringify({ page_id: pageId, link_data: ld }),
        access_token: token,
      }, "POST");
    let creative: any;
    try {
      creative = await createCreative();
    } catch (e) {
      // Se a Meta recusar a mensagem pronta, segue como antes (link com o número).
      if (!ld.page_welcome_message || isRateLimit(e)) throw e;
      console.log("meta-update-seller-campaign-v1 welcome-message-fallback", JSON.stringify({ campaign_id: campaign.id, message: e instanceof Error ? e.message : String(e) }));
      delete ld.page_welcome_message;
      ld.link = phoneLink;
      if (Array.isArray(ld.child_attachments)) ld.child_attachments = ld.child_attachments.map((x: any) => ({ ...x, link: phoneLink }));
      creative = await createCreative();
    }
    const creativeId = creative?.id ? String(creative.id) : null;
    if (!creativeId) return fail("Criativo", "A Meta não retornou o ID do novo criativo.");

    // 2. O mesmo anúncio passa a usar o novo criativo (e é reativado, se pedido) numa chamada só.
    const adParams: Record<string, string> = { creative: JSON.stringify({ creative_id: creativeId }), access_token: token };
    if (activate) adParams.status = "ACTIVE";
    await graphRetry(version, "Anúncio", campaign.meta_ad_id, adParams, "POST");

    // 3. Conjunto de anúncios: data de fim, público e ativação numa única alteração, porque a Meta
    //    só aceita uma alteração no mesmo conjunto a cada 30 segundos.
    const adsetParams: Record<string, string> = {};
    let newEnd: string | null = null;
    if (continuous && template.period_end) {
      const end = new Date(`${template.period_end}T23:59:59.999-03:00`);
      adsetParams.end_time = end.toISOString();
      newEnd = end.toISOString();
    }
    // Público: liga o Advantage+ ou volta ao público fixo (raio da loja, idade e interesses da campanha).
    let advantage: "on" | "off" | "unchanged" = "unchanged";
    const targeting = adset?.targeting ?? null;
    const isOn = targeting?.targeting_automation?.advantage_audience === 1;
    if (targeting && USE_ADVANTAGE_AUDIENCE && !isOn) {
      const next: any = { ...targeting, targeting_automation: { ...(targeting.targeting_automation ?? {}), advantage_audience: 1 } };
      if (next.age_min != null) next.age_min = Math.min(25, Number(next.age_min));
      delete next.age_max;
      adsetParams.targeting = JSON.stringify(next);
      advantage = "on";
    } else if (targeting && !USE_ADVANTAGE_AUDIENCE && isOn) {
      const next: any = { ...targeting, targeting_automation: { ...(targeting.targeting_automation ?? {}), advantage_audience: 0 } };
      if (campaign.audience_age_min != null) next.age_min = Number(campaign.audience_age_min);
      if (campaign.audience_age_max != null) next.age_max = Number(campaign.audience_age_max);
      adsetParams.targeting = JSON.stringify(next);
      advantage = "off";
    }
    if (activate && adset?.status !== "ACTIVE") adsetParams.status = "ACTIVE";
    // A Meta não deixa trocar o número num conjunto já publicado; para isso é preciso publicar de novo.
    let whatsappLinked: "updated" | "already" | "refused" = linkedNumber ? "already" : "refused";
    if (Object.keys(adsetParams).length) {
      try {
        await graphRetry(version, "Conjunto de anúncios", campaign.meta_adset_id, { ...adsetParams, access_token: token }, "POST");
      } catch (e) {
        // Se a Meta recusar o público, aplica o resto sem ele.
        if (!adsetParams.targeting || isRateLimit(e)) throw e;
        console.log("meta-update-seller-campaign-v1 adset-partial", JSON.stringify({ campaign_id: campaign.id, message: e instanceof Error ? e.message : String(e) }));
        delete adsetParams.targeting;
        advantage = "unchanged";
        if (Object.keys(adsetParams).length)
          await graphRetry(version, "Conjunto de anúncios", campaign.meta_adset_id, { ...adsetParams, access_token: token }, "POST");
      }
    }

    // 4. Campanha: só reativa se não estiver ativa.
    if (activate) {
      const current = await graphRetry(version, "Campanha", campaign.meta_campaign_id, { fields: "status", access_token: token });
      if (current?.status !== "ACTIVE")
        await graphRetry(version, "Ativação da campanha", campaign.meta_campaign_id, { status: "ACTIVE", access_token: token }, "POST");
    }

    const update: Record<string, unknown> = {
      meta_creative_id: creativeId,
      name: template.title || campaign.name,
      media_items: template.media_items ?? [],
      error_message: null,
      meta_delivery_status: "in_review",
      meta_delivery_detail: null,
      meta_delivery_checked_at: new Date().toISOString(),
    };
    if (newEnd) update.end_date = newEnd;
    if (activate) update.status = "active";
    const { error: dbError } = await admin.from("seller_campaigns").update(update).eq("id", campaign.id);
    if (dbError)
      return json({ success: false, step: "AutoAds", error: `O anúncio foi atualizado na Meta, mas não foi salvo no AutoAds: ${dbError.message}` }, 200);

    console.log("meta-update-seller-campaign-v1 ok", JSON.stringify({ campaign_id: campaign.id, creative_id: creativeId, activate, carousel: USE_CAROUSEL ? carousel.length : 1, advantage, whatsapp: whatsappLinked }));
    return json({ success: true, campaign_id: campaign.id, creative_id: creativeId, end_date: newEnd, activated: activate, carousel_items: USE_CAROUSEL ? carousel.length : 1, advantage_audience: advantage, whatsapp_linked: whatsappLinked });
  } catch (e) {
    const step = e instanceof StepError ? e.step : "Atualização";
    const message = e instanceof Error ? e.message : String(e);
    console.error("meta-update-seller-campaign-v1 failed", JSON.stringify({ campaign_id: campaign.id, step, message }));
    return fail(step, message);
  }
});

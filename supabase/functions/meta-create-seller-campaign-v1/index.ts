import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type MetaError = { step: string; code: number | null; subcode: number | null; message: string; user_message: string | null; fbtrace_id: string | null };
class StepError extends Error { constructor(public info: MetaError) { super(info.message); } }

async function graph(version: string, step: string, path: string, params: Record<string,string>, method: "GET"|"POST" = "GET") {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  const init: RequestInit = { method };
  if (method === "GET") for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  else { init.headers = { "Content-Type": "application/x-www-form-urlencoded" }; init.body = new URLSearchParams(params).toString(); }
  let response: Response; let data: any;
  try { response = await fetch(url, init); data = await response.json().catch(() => null); }
  catch (e) { throw new StepError({ step, code:null, subcode:null, message:String(e), user_message:null, fbtrace_id:null }); }
  if (!response.ok || data?.error) { const e=data?.error??{}; throw new StepError({ step, code:typeof e.code === "number" ? e.code : null, subcode:typeof e.error_subcode === "number" ? e.error_subcode : null, message:e.message || `HTTP ${response.status}`, user_message:e.error_user_msg ?? null, fbtrace_id:e.fbtrace_id ?? null }); }
  return data;
}
function idOf(step:string, data:any) { if (data?.id == null) throw new StepError({step,code:null,subcode:null,message:"A Meta não retornou o ID do objeto criado.",user_message:null,fbtrace_id:null}); return String(data.id); }
function errorText(e: MetaError) { return [`Etapa: ${e.step}`, e.code != null ? `Código Meta: ${e.code}${e.subcode ? `/${e.subcode}` : ""}` : "", `Mensagem: ${e.user_message || e.message}`, e.fbtrace_id ? `fbtrace_id: ${e.fbtrace_id}` : ""].filter(Boolean).join(" | "); }
function whatsapp(v:string|null) { const d=(v||"").replace(/\D/g,""); if(!d) return null; return d.startsWith("55") ? d : (d.length===10||d.length===11 ? `55${d}` : d); }
function normalize(v:any) { return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
const variants:Record<string,string[]>={GAC:["GAC Motor","GAC Motors","GAC veículos"],Leapmotor:["Leap Motor","Leapmotor veículos"],Omoda:["OMODA","Omoda Auto"],Jaecoo:["JAECOO","Jaecoo Auto"],SUVs:["SUV","SUVs (veículos)"],"Pick-up":["pickup","pick-up trucks","picapes"],"veículos elétricos":["carros elétricos","veículos elétricos","electric cars"],"veículos híbridos":["carros híbridos","veículos híbridos","hybrid cars"],"carros novos":["novos carros","new cars"],automóveis:["Automóveis (veículos)","automoveis","carros"],Webmotors:["Webmotors.com.br","site Webmotors"]};
async function interests(version:string, token:string, names:any[], stored:any[]) {
  const ids=(Array.isArray(stored)?stored:[]).map(String).filter(Boolean); const clean=(Array.isArray(names)?names:[]).map(String).filter(Boolean);
  if(ids.length) return ids.map((id,i)=>({id,name:clean[i]||id}));
  const out:any[]=[];
  for(const name of clean){
    const qs=Array.from(new Set([name,...(variants[name]||[])])); const all:any[]=[];
    for(const q of qs){ try { const d=await graph(version,"Interesses","search",{type:"adinterest",q,limit:"25",locale:"pt_BR",access_token:token}); all.push(...(Array.isArray(d?.data)?d.data:[])); } catch {} }
    const qn=normalize(name); const candidate=Array.from(new Map(all.filter(x=>x?.id).map(x=>[String(x.id),x])).values()).filter((x:any)=>{const t=normalize(`${x.name||""} ${Array.isArray(x.path)?x.path.join(" "):x.path||""}`); return t.includes("carro")||t.includes("veiculo")||t.includes("automovel")||t.includes("automotive")||t.includes("fiat")||t.includes("jeep")||t.includes("ford")||t.includes("suv")||t.includes("motor")||t.includes("webmotors")}).sort((a:any,b:any)=>(normalize(b.name).includes(qn)?1:0)-(normalize(a.name).includes(qn)?1:0))[0];
    if(candidate?.id) out.push({id:String(candidate.id),name:String(candidate.name||name)});
  }
  return out;
}

// Mensagem pronta que o cliente envia ao tocar no anúncio (e saudação exibida para ele).
function welcomeMessage(title:string){
  const offer=String(title||"").trim();
  const content=offer?`Olá! Vi o anúncio "${offer}" e quero mais informações.`:"Olá! Vi o anúncio e quero mais informações.";
  return JSON.stringify({type:"VISUAL_EDITOR",version:2,landing_screen_type:"welcome_message",media_type:"text",text_format:{customer_action_type:"autofill_message",message:{autofill_message:{content},text:"Olá! Obrigado pelo interesse. Já vamos te atender por aqui."}}});
}

// Foto única (primeira foto da oferta): o carrossel de 10/10 teve menos cliques e conversas que a foto única de 02/10.
// Público fixo: o Público Advantage+, testado em 08/10, derrubou cliques e conversas.
const USE_CAROUSEL=false;
const USE_ADVANTAGE_AUDIENCE=false;

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  const supabaseUrl=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), version=Deno.env.get("META_GRAPH_VERSION")||"v26.0";
  if(!supabaseUrl||!anon||!service) return json({error:"Integração não configurada."},503);
  const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer ")) return json({error:"Não autenticado."},401);
  const userClient=createClient(supabaseUrl,anon,{global:{headers:{Authorization:auth}}}); const {data:{user}}=await userClient.auth.getUser(); if(!user) return json({error:"Sessão inválida."},401);
  const admin=createClient(supabaseUrl,service); let requestedId:string|null=null; try{const b=await req.json(); if(typeof b?.campaign_id==="string") requestedId=b.campaign_id;}catch{}
  let q=admin.from("seller_campaigns").select("id,seller_id,name,template_id,total_budget,daily_budget,duration_days,start_date,end_date,whatsapp,store_id,radius_km,status,meta_campaign_id,audience_age_min,audience_age_max,audience_gender,audience_interest_names,audience_interest_ids").eq("seller_id",user.id).is("meta_campaign_id",null).in("status",["pending","active","error"]); if(requestedId) q=q.eq("id",requestedId);
  const {data:campaign,error:ce}=await q.order("created_at",{ascending:false}).limit(1).maybeSingle(); if(ce) return json({error:"Não foi possível localizar a campanha."},500); if(!campaign) return json({error:"Nenhuma campanha AutoAds pendente de publicação na Meta."},404);
  await admin.from("seller_campaigns").update({status:"pending",error_message:null}).eq("id",campaign.id);
  const ids={campaign_id:null as string|null,adset_id:null as string|null,creative_id:null as string|null,ad_id:null as string|null};
  let rollbackToken:string|null=null;
  const fail=async(e:MetaError)=>{const message=errorText(e);
    // Se a publicação parou no meio, apaga a campanha vazia na Meta para não deixar lixo na conta do vendedor.
    if(ids.campaign_id&&!ids.ad_id&&rollbackToken){ try{ const r=await fetch(`https://graph.facebook.com/${version}/${ids.campaign_id}?access_token=${encodeURIComponent(rollbackToken)}`,{method:"DELETE"}); if(r.ok){ console.log("autoads-meta-rollback",JSON.stringify({campaign_id:ids.campaign_id})); ids.campaign_id=null; ids.adset_id=null; ids.creative_id=null; } }catch(err){ console.log("autoads-meta-rollback-failed",String(err)); } }
    await admin.from("seller_campaigns").update({status:"error",error_message:message.slice(0,1000),meta_campaign_id:ids.campaign_id,meta_adset_id:ids.adset_id,meta_creative_id:ids.creative_id,meta_ad_id:ids.ad_id}).eq("id",campaign.id); return json({success:false,error:message,meta_error:e,partial:ids},200);};
  try{
    const {data:connection}=await admin.from("meta_connections").select("access_token,status").eq("seller_id",user.id).maybeSingle(); if(!connection?.access_token||connection.status!=="connected") return fail({step:"Conexão Meta",code:null,subcode:null,message:"A conta Meta deste vendedor não está conectada.",user_message:null,fbtrace_id:null});
    const token=String(connection.access_token); rollbackToken=token; const {data:account}=await admin.from("meta_ad_accounts_v2").select("id,external_account_id,status").eq("seller_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(); if(!account?.external_account_id) return fail({step:"Conta de anúncios",code:null,subcode:null,message:"Nenhuma conta de anúncios Meta vinculada a este vendedor.",user_message:null,fbtrace_id:null});
    const {data:template}=await admin.from("campaign_templates").select("id,title,model,description,primary_text,headline,image_url,media_type,media_url,media_items,period_end").eq("id",campaign.template_id).maybeSingle(); if(!template) return fail({step:"Oferta",code:null,subcode:null,message:"A oferta selecionada não foi encontrada.",user_message:null,fbtrace_id:null});
    const {data:store}=await admin.from("stores").select("name,latitude,longitude,default_radius_km").eq("id",campaign.store_id).maybeSingle(); if(!store?.latitude||!store?.longitude) return fail({step:"Loja",code:null,subcode:null,message:"A loja não possui localização geográfica configurada.",user_message:null,fbtrace_id:null});
    const mediaUrl=template.media_url||template.image_url; if(!mediaUrl) return fail({step:"Criativo",code:null,subcode:null,message:"A oferta não possui imagem para o anúncio.",user_message:null,fbtrace_id:null}); if(template.media_type==="video") return fail({step:"Criativo",code:null,subcode:null,message:"Publicação de vídeo ainda não está habilitada; use uma oferta com imagem.",user_message:null,fbtrace_id:null});
    const phone=whatsapp(campaign.whatsapp); if(!phone) return fail({step:"Conjunto de anúncios",code:null,subcode:null,message:"A campanha não possui WhatsApp do vendedor.",user_message:null,fbtrace_id:null});
    const accountId=String(account.external_account_id).replace(/^act_/ ,""); const act=`act_${accountId}`; const acct=await graph(version,"Conta de anúncios",act,{fields:"currency,account_status",access_token:token}); const currency=String(acct.currency||"BRL").toUpperCase(); const zero=new Set(["CLP","COP","CRC","HUF","ISK","IDR","JPY","KRW","PYG","TWD","VND"]); const continuous=campaign.duration_days==null; const unit=zero.has(currency)?1:100; const budget=Math.round(Number(continuous?campaign.daily_budget:campaign.total_budget)*unit); if(!Number.isFinite(budget)||budget<=0) return fail({step:"Orçamento",code:null,subcode:null,message:continuous?"Orçamento diário inválido.":"Orçamento total inválido.",user_message:null,fbtrace_id:null}); const days=continuous?1:Math.max(1,Number(campaign.duration_days||1)); if(currency==="BRL"&&budget/days<1300) return fail({step:"Orçamento",code:null,subcode:null,message:continuous?"A Meta exige pelo menos R$ 13 por dia.":`A Meta exige pelo menos R$ 13 por dia. Com ${days} dia(s), o orçamento mínimo é R$ ${(13*days).toFixed(2).replace(".",",")}.`,user_message:null,fbtrace_id:null});
    const {data:storedPage}=await admin.from("meta_pages").select("page_id,page_name,status").eq("seller_id",user.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
    let page:any=storedPage?.page_id?{id:String(storedPage.page_id),name:storedPage.page_name||null,source:"meta_pages"}:null;
    if(!page){ const p=await graph(version,"Página do Facebook",act,{fields:"promote_pages.limit(10){id,name}",access_token:token}); const pages=Array.isArray(p?.promote_pages?.data)?p.promote_pages.data:[]; page=pages[0]?{id:String(pages[0].id),name:pages[0].name||null,source:"promote_pages"}:null; }
    if(!page?.id) return fail({step:"Página do Facebook",code:null,subcode:null,message:"Nenhuma Página do Facebook foi encontrada na conexão Meta. Reconecte a conta para sincronizar a Página.",user_message:null,fbtrace_id:null});
    const name=`AutoAds | ${template.title||template.model||campaign.name}`;
    const cr=await graph(version,"Campanha",`${act}/campaigns`,{name,objective:"OUTCOME_ENGAGEMENT",buying_type:"AUCTION",special_ad_categories:"[]",is_adset_budget_sharing_enabled:"false",status:"PAUSED",access_token:token},"POST"); ids.campaign_id=idOf("Campanha",cr);
    const radius=Math.min(80,Math.max(1,Number(campaign.radius_km||store.default_radius_km||10))); const resolved=await interests(version,token,campaign.audience_interest_names,campaign.audience_interest_ids); const targeting:any={geo_locations:{custom_locations:[{latitude:Number(store.latitude),longitude:Number(store.longitude),radius,distance_unit:"kilometer"}],location_types:["home"]},targeting_automation:{advantage_audience:0}}; if(campaign.audience_age_min!=null) targeting.age_min=Number(campaign.audience_age_min); if(campaign.audience_age_max!=null) targeting.age_max=Number(campaign.audience_age_max); if(campaign.audience_gender==="male") targeting.genders=[1]; if(campaign.audience_gender==="female") targeting.genders=[2]; if(resolved.length) targeting.flexible_spec=[{interests:resolved}];
    // Público Advantage+: o raio da loja continua fixo; interesses e gênero viram sugestões para a Meta.
    // A Meta só aceita idade mínima fixa de até 25 nesse modo, e não aceita idade máxima fixa.
    const advantageTargeting:any={...targeting,targeting_automation:{advantage_audience:1}}; if(advantageTargeting.age_min!=null) advantageTargeting.age_min=Math.min(25,Number(advantageTargeting.age_min)); delete advantageTargeting.age_max;
    const start=new Date(Math.max(Date.now(),new Date(campaign.start_date).getTime())); const offerEnd=template.period_end?new Date(`${template.period_end}T23:59:59.999-03:00`):null; const end=continuous?(offerEnd??null):new Date(campaign.end_date); const effectiveEnd=end&&offerEnd&&offerEnd<end?offerEnd:end; if(effectiveEnd&&!(effectiveEnd.getTime()>start.getTime())) return fail({step:"Orçamento",code:null,subcode:null,message:"A oferta já perdeu a validade para esta publicação.",user_message:null,fbtrace_id:null});
    const basePromoted={page_id:page.id}; const withNumber={...basePromoted,whatsapp_phone_number:phone};
    // Contínua: orçamento diário, sem data de fim (só a validade da oferta, se houver). Com período: orçamento total.
    const adsetParams:Record<string,string>={name:`${name} | WhatsApp`,campaign_id:ids.campaign_id!,billing_event:"IMPRESSIONS",optimization_goal:"CONVERSATIONS",destination_type:"WHATSAPP",promoted_object:JSON.stringify(withNumber),targeting:JSON.stringify(USE_ADVANTAGE_AUDIENCE?advantageTargeting:targeting),start_time:start.toISOString(),bid_strategy:"LOWEST_COST_WITHOUT_CAP",status:"PAUSED",access_token:token};
    if(continuous) adsetParams.daily_budget=String(budget); else adsetParams.lifetime_budget=String(budget);
    if(effectiveEnd) adsetParams.end_time=effectiveEnd.toISOString();
    let ar:any;
    const isWhatsappPageError=(e:unknown)=>e instanceof StepError && ((e.info.code===100 && e.info.subcode===1487246) || e.info.code===200);
    let whatsappLinked=true;
    const createAdset=async(params:Record<string,string>)=>{ try { return await graph(version,"Conjunto de anúncios",`${act}/adsets`,params,"POST"); }
      catch(e) { if(isWhatsappPageError(e)) { whatsappLinked=false; console.log("autoads-meta-whatsapp-page-fallback",JSON.stringify({seller_id:user.id,ad_account_id:account.external_account_id,page_id:page.id,reason:(e as StepError).info.subcode||(e as StepError).info.code})); return await graph(version,"Conjunto de anúncios",`${act}/adsets`,{...params,promoted_object:JSON.stringify(basePromoted)},"POST"); } throw e; } };
    let advantageUsed=USE_ADVANTAGE_AUDIENCE;
    // Só quem mora no raio da loja ("home"). Se a Meta não aceitar essa opção, usa "mora ou esteve recentemente".
    const withRecent=(t:any)=>({...t,geo_locations:{...t.geo_locations,location_types:["home","recent"]}});
    try { ar=await createAdset(adsetParams); }
    catch(e) {
      if(!USE_ADVANTAGE_AUDIENCE){
        if(!(e instanceof StepError)) throw e;
        console.log("autoads-meta-location-home-fallback",JSON.stringify({seller_id:user.id,code:e.info.code,subcode:e.info.subcode,message:e.info.message}));
        ar=await createAdset({...adsetParams,targeting:JSON.stringify(withRecent(targeting))});
      } else {
      // Se a Meta recusar o Público Advantage+, publica com o público fixo de antes em vez de falhar.
      if(!(e instanceof StepError)) throw e;
      console.log("autoads-meta-advantage-fallback",JSON.stringify({seller_id:user.id,code:e.info.code,subcode:e.info.subcode,message:e.info.message}));
      advantageUsed=false; ar=await createAdset({...adsetParams,targeting:JSON.stringify(targeting)});
      }
    }
    ids.adset_id=idOf("Conjunto de anúncios",ar);
    // media_items pode ser lista de URLs (oferta do master) ou de objetos {url,type,position} (oferta do gerente).
    const raw=(Array.isArray(template.media_items)?template.media_items:[]).map((x:any,i:number)=>typeof x==="string"?{url:x,type:"image",position:i}:x); const carousel=raw.filter((x:any)=>x?.url&&(x?.type==="image"||!x?.type)).sort((a:any,b:any)=>Number(a.position||0)-Number(b.position||0)).slice(0,10); const offerTitle=template.headline||template.title||template.model||campaign.name; // Número vinculado à Página: link genérico (a Meta usa o número do conjunto) e mensagem pronta.
    const link=whatsappLinked?"https://api.whatsapp.com/send":`https://api.whatsapp.com/send?phone=${phone}`; const ld:any={message:template.primary_text||template.description||template.title||template.model||campaign.name,name:template.headline||template.title||undefined,link,call_to_action:{type:"WHATSAPP_MESSAGE",value:{app_destination:"WHATSAPP"}}}; if(USE_CAROUSEL&&carousel.length>1) ld.child_attachments=carousel.map((x:any)=>({link,picture:String(x.url),name:template.headline||template.title||template.model||campaign.name})); else ld.picture=carousel[0]?.url||mediaUrl;
    if(whatsappLinked) ld.page_welcome_message=welcomeMessage(offerTitle);
    let cr2:any;
    try { cr2=await graph(version,"Criativo",`${act}/adcreatives`,{name:`${name} | Criativo`,object_story_spec:JSON.stringify({page_id:page.id,link_data:ld}),access_token:token},"POST"); }
    catch(e) {
      // Se a Meta recusar a mensagem pronta, publica como antes (link com o número, sem mensagem pronta).
      if(!(e instanceof StepError)||!ld.page_welcome_message) throw e;
      console.log("autoads-meta-welcome-message-fallback",JSON.stringify({seller_id:user.id,code:e.info.code,subcode:e.info.subcode,message:e.info.message}));
      delete ld.page_welcome_message; ld.link=`https://api.whatsapp.com/send?phone=${phone}`; if(Array.isArray(ld.child_attachments)) ld.child_attachments=ld.child_attachments.map((x:any)=>({...x,link:ld.link}));
      cr2=await graph(version,"Criativo",`${act}/adcreatives`,{name:`${name} | Criativo`,object_story_spec:JSON.stringify({page_id:page.id,link_data:ld}),access_token:token},"POST");
    }
    ids.creative_id=idOf("Criativo",cr2);
    const ad=await graph(version,"Anúncio",`${act}/ads`,{name,adset_id:ids.adset_id!,creative:JSON.stringify({creative_id:ids.creative_id}),status:"PAUSED",access_token:token},"POST"); ids.ad_id=idOf("Anúncio",ad);
    await graph(version,"Ativação da campanha",ids.campaign_id!,{status:"ACTIVE",access_token:token},"POST"); await graph(version,"Ativação do conjunto",ids.adset_id!,{status:"ACTIVE",access_token:token},"POST"); await graph(version,"Ativação do anúncio",ids.ad_id!,{status:"ACTIVE",access_token:token},"POST");
    const {error:ue}=await admin.from("seller_campaigns").update({status:"active",meta_ad_account_id:act,meta_ad_account_id_v2:account.id||null,meta_campaign_id:ids.campaign_id,meta_adset_id:ids.adset_id,meta_creative_id:ids.creative_id,meta_ad_id:ids.ad_id,published_at:new Date().toISOString(),error_message:null}).eq("id",campaign.id).eq("seller_id",user.id); if(ue) return json({error:`A campanha foi criada na Meta, mas não foi salva no AutoAds: ${ue.message}`,partial:ids},500);
    return json({success:true,campaign_id:campaign.id,ad_account_id:act,meta_campaign_id:ids.campaign_id,meta_adset_id:ids.adset_id,meta_creative_id:ids.creative_id,meta_ad_id:ids.ad_id,page_id:page.id,page_source:page.source,audience_interest_count:resolved.length,advantage_audience:advantageUsed,carousel_items:USE_CAROUSEL?carousel.length:1});
  }catch(e){ if(e instanceof StepError) return fail(e.info); return fail({step:"Publicação",code:null,subcode:null,message:e instanceof Error?e.message:String(e),user_message:null,fbtrace_id:null}); }
});
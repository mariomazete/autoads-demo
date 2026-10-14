import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Pause,
  Play,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { loadStoreMetrics, type StoreMetrics } from "@/lib/storeMetrics";
import { loadSellerReadiness, type SellerReadiness } from "@/lib/sellerReadiness";
import { ConversationsByDayChart } from "@/components/manager/ConversationsByDayChart";
import { SellerRanking } from "@/components/manager/SellerRanking";
import { SellerReadinessCard } from "@/components/manager/SellerReadinessCard";
import { SalesSummaryCard } from "@/components/sales/SalesSummaryCard";
import { SALES_CHANGED_EVENT, SALES_REMINDER_DAYS, loadSalesGap } from "@/lib/sales";

type Store = { id: string; name: string; address: string | null; city: string | null; state: string | null; brand_id: string | null };
type Campaign = { id: string; name: string; status: string; budget_amount: number | null; spent_amount: number | null; total_budget: number | null; clicks: number | null; impressions: number | null; seller_id: string; created_at: string; start_date: string | null; end_date: string | null };
type Seller = { id: string; full_name: string | null; email: string | null; status: string };
type ManagerProfile = { full_name: string | null; email: string | null; whatsapp: string | null; job_title: string | null };
type LiveSeller = { seller_id: string; seller_name: string; connected: boolean; campaigns_mapped: number; metrics: { spend: number; impressions: number; clicks: number; conversations: number; reach: number; ctr: number; cpc: number; cpm: number }; error?: string };
type LiveInsights = { period: string; store: { spend: number; impressions: number; clicks: number; conversations: number; reach: number; ctr: number; cpc: number; cpm: number }; sellers: LiveSeller[]; fetched_at: string };

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const integer = (v: number) => v.toLocaleString("pt-BR");
const percent = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

export function ManagerDashboard({ onOpenSales }: { onOpenSales?: () => void } = {}) {
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(true);
  const [error, setError] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [live, setLive] = useState<LiveInsights | null>(null);
  const [daily, setDaily] = useState<StoreMetrics["daily"]>([]);
  const [readiness, setReadiness] = useState<SellerReadiness[] | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [brand, setBrand] = useState("AutoAds");
  const [showIdleSellers, setShowIdleSellers] = useState(false);
  // Vendedores com conversas nos últimos 7 dias e nenhuma venda registrada.
  const [salesGap, setSalesGap] = useState<Array<{ sellerId: string; conversations: number }> | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sessão não encontrada.");
      setLoading(false);
      return;
    }
    const { data: profileRow, error: profileError } = await supabase.from("profiles").select("store_id, full_name, email, whatsapp, job_title").eq("id", auth.user.id).single();
    if (profileError || !profileRow?.store_id) {
      setError(profileError?.message || "Gerente sem loja vinculada.");
      setLoading(false);
      return;
    }
    setProfile({ full_name: profileRow.full_name ?? null, email: profileRow.email ?? null, whatsapp: profileRow.whatsapp ?? null, job_title: profileRow.job_title ?? null });
    const [storeResult, campaignResult, roleResult] = await Promise.all([
      supabase.from("stores").select("id,name,address,city,state,brand_id").eq("id", profileRow.store_id).single(),
      supabase.from("seller_campaigns").select("id,name,status,budget_amount,spent_amount,total_budget,clicks,impressions,seller_id,created_at,start_date,end_date").eq("store_id", profileRow.store_id).is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "VENDEDOR"),
    ]);
    if (storeResult.error) setError(storeResult.error.message);
    if (campaignResult.error) setError(campaignResult.error.message);
    setStore(storeResult.data ?? null);
    setCampaigns(campaignResult.data ?? []);
    const sellerIds = (roleResult.data ?? []).map((row) => row.user_id);
    if (sellerIds.length) {
      const { data: sellerRows, error: sellerError } = await supabase.from("profiles").select("id,full_name,email,status").eq("store_id", profileRow.store_id).in("id", sellerIds).order("full_name");
      if (sellerError) setError(sellerError.message);
      setSellers(sellerRows ?? []);
    } else setSellers([]);
    if (storeResult.data?.brand_id) {
      const { data: brandRow } = await supabase.from("brands").select("name").eq("id", storeResult.data.brand_id).maybeSingle();
      if (brandRow?.name) setBrand(brandRow.name);
    }
    setLoading(false);
  }

  // Resultados reais da Meta: sincroniza os dados diários da loja e soma os últimos 30 dias.
  async function loadLiveInsights() {
    setLiveLoading(true);
    // Mostra na hora o que já está guardado e depois atualiza com a Meta.
    const stored = await loadStoreMetrics(30, false);
    if (stored) {
      setLive(stored);
      setDaily(stored.daily);
      setLiveLoading(false);
    }
    const storeMetrics = await loadStoreMetrics(30, true);
    if (storeMetrics) {
      setLive(storeMetrics);
      setDaily(storeMetrics.daily);
    }
    setLiveLoading(false);
  }

  async function loadReadiness() {
    setReadinessLoading(true);
    setReadiness(await loadSellerReadiness());
    setReadinessLoading(false);
  }

  useEffect(() => {
    void load();
    void loadLiveInsights();
    void loadReadiness();
    const loadGap = () => void loadSalesGap().then((gap) => setSalesGap(gap.ok ? gap.withoutSales : []));
    loadGap();
    window.addEventListener(SALES_CHANGED_EVENT, loadGap);
    return () => window.removeEventListener(SALES_CHANGED_EVENT, loadGap);
  }, []);

  async function toggleCampaign(id: string, status: string) {
    const next = status === "active" ? "paused" : "active";
    // Pausa/reativa na Meta (com a conexão do vendedor dono da campanha) e no AutoAds.
    const { data, error: invokeError } = await supabase.functions.invoke("meta-set-campaign-status-v1", {
      body: { campaign_id: id, status: next },
    });
    if (invokeError || !data?.success) {
      let detail: string | undefined = data?.error;
      const context = (invokeError as { context?: Response } | null)?.context;
      if (!detail && context && typeof context.json === "function") {
        try {
          detail = (await context.clone().json())?.error;
        } catch {
          /* sem corpo JSON */
        }
      }
      setError(detail || invokeError?.message || "Não foi possível alterar a campanha na Meta.");
    } else await load();
  }

  const localMetrics = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active");
    const paused = campaigns.filter((c) => c.status === "paused");
    const errors = campaigns.filter((c) => c.status === "error");
    const impressions = campaigns.reduce((sum, c) => sum + Number(c.impressions ?? 0), 0);
    const clicks = campaigns.reduce((sum, c) => sum + Number(c.clicks ?? 0), 0);
    const investment = campaigns.reduce((sum, c) => sum + Number(c.spent_amount ?? 0), 0);
    const budget = campaigns.reduce((sum, c) => sum + Number(c.total_budget ?? c.budget_amount ?? 0), 0);
    return { active: active.length, paused: paused.length, errors: errors.length, impressions, clicks, investment, budget, ctr: impressions ? (clicks / impressions) * 100 : 0, cpc: clicks ? investment / clicks : 0, cpm: impressions ? (investment / impressions) * 1000 : 0, activeWithoutMetrics: active.filter((c) => Number(c.impressions ?? 0) === 0 && Number(c.clicks ?? 0) === 0).length };
  }, [campaigns]);

  const sellerPerformance = useMemo(() => sellers.map((seller) => {
    const sellerCampaigns = campaigns.filter((campaign) => campaign.seller_id === seller.id);
    const active = sellerCampaigns.filter((campaign) => campaign.status === "active");
    // Sempre os últimos 30 dias da mesma fonte do gráfico e do ranking (sem misturar com totais da campanha).
    const liveSeller = live?.sellers.find((row) => row.seller_id === seller.id);
    const impressions = liveSeller?.metrics.impressions ?? 0;
    const clicks = liveSeller?.metrics.clicks ?? 0;
    const investment = liveSeller?.metrics.spend ?? 0;
    const conversations = liveSeller?.metrics.conversations ?? 0;
    return { ...seller, campaigns: sellerCampaigns.length, active: active.length, impressions, clicks, investment, conversations, ctr: impressions ? (clicks / impressions) * 100 : 0, cpc: clicks ? investment / clicks : 0 };
  }).sort((a, b) => b.conversations - a.conversations || b.investment - a.investment || b.clicks - a.clicks), [sellers, campaigns, live]);

  const metrics = useMemo(() => {
    // Indicadores de desempenho: só os últimos 30 dias (campaign_metrics). Contagens de campanha: situação atual.
    const base = live?.store;
    return { active: localMetrics.active, paused: localMetrics.paused, errors: localMetrics.errors, budget: localMetrics.budget, impressions: base?.impressions ?? 0, clicks: base?.clicks ?? 0, investment: base?.spend ?? 0, conversations: base?.conversations ?? 0, ctr: base?.ctr ?? 0, cpc: base?.cpc ?? 0, cpm: base?.cpm ?? 0, activeWithoutMetrics: localMetrics.activeWithoutMetrics };
  }, [live, localMetrics]);

  const sellersWithoutCampaign = sellerPerformance.filter((seller) => seller.active === 0);
  const recentCampaigns = campaigns.slice(0, 8);

  // Situação de cada vendedor parado, com base na última campanha dele nesta loja.
  const idleInfo = (sellerId: string) => {
    const last = campaigns
      .filter((campaign) => campaign.seller_id === sellerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (!last) return { text: "Nunca publicou campanha", tone: "critical" as const };
    const days = Math.max(0, Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86_400_000));
    const when = days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
    if (last.status === "paused") return { text: `Campanha pausada · criada ${when}`, tone: "warning" as const };
    if (last.status === "error") return { text: `Última tentativa com erro · ${when}`, tone: "critical" as const };
    return { text: `Última campanha encerrada · criada ${when}`, tone: "warning" as const };
  };
  const idleSellers = [...sellersWithoutCampaign]
    .map((seller) => ({ ...seller, info: idleInfo(seller.id) }))
    .sort((a, b) =>
      a.info.tone === b.info.tone
        ? (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR")
        : a.info.tone === "critical" ? -1 : 1,
    );
  const toggleIdleSellers = () => {
    const opening = !showIdleSellers;
    setShowIdleSellers(opening);
    if (opening) {
      window.setTimeout(
        () => document.getElementById("vendedores-sem-campanha")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando dashboard da loja...</div>;
  if (error && !store) return <div className="p-8 text-sm text-destructive">{error}</div>;

  return <div className="space-y-4">
    <section>
      <p className="text-sm font-medium text-primary">Visão da loja</p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">{store?.name || "Minha loja"}</h2><p className="text-sm text-muted-foreground">{brand} · {[store?.city, store?.state].filter(Boolean).join(" / ") || "Localização não informada"}</p></div><Badge variant="secondary">Desempenho: últimos 30 dias</Badge></div>
    </section>
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" />Investimento</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{liveLoading && !live ? "…" : money(metrics.investment)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" />Impressões</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{liveLoading && !live ? "…" : integer(metrics.impressions)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><MousePointerClick className="h-4 w-4" />Cliques</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{liveLoading && !live ? "…" : integer(metrics.clicks)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" />Conversas iniciadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{liveLoading ? "…" : integer(metrics.conversations)}</CardContent></Card>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">CTR</p><p className="mt-1 text-xl font-semibold">{metrics.impressions ? percent(metrics.ctr) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Cliques ÷ impressões</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">CPC</p><p className="mt-1 text-xl font-semibold">{metrics.clicks ? money(metrics.cpc) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Investimento ÷ cliques</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">CPM</p><p className="mt-1 text-xl font-semibold">{metrics.impressions ? money(metrics.cpm) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Investimento por mil impressões</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Campanhas ativas</p><p className="mt-1 text-xl font-semibold">{metrics.active}</p><p className="mt-1 text-xs text-muted-foreground">{metrics.paused} pausadas · {metrics.errors} com erro</p></CardContent></Card>
    </section>
    <SalesSummaryCard title="Vendas do mês" description="Vendas registradas pelos vendedores da loja. Confira o número da proposta na aba Vendas." onOpen={onOpenSales} openLabel="Ver e conferir vendas" />
    <section className="grid gap-4 xl:grid-cols-4">
      <div className="xl:col-span-3"><ConversationsByDayChart daily={daily} loading={liveLoading} /></div>
      <SellerRanking sellers={sellerPerformance} loading={liveLoading} description="Top 5 da loja, últimos 30 dias." />
    </section>
    <SellerReadinessCard sellers={readiness} loading={readinessLoading} />
    <section className="grid gap-4 xl:grid-cols-4">
      <Card className="xl:col-span-3"><CardHeader><CardTitle>Performance por vendedor</CardTitle><p className="text-sm text-muted-foreground">Resultado das campanhas da sua loja nos últimos 30 dias.</p></CardHeader><CardContent>{sellerPerformance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-3 pr-4">Vendedor</th><th className="pb-3 pr-4">Campanhas</th><th className="pb-3 pr-4">Investimento</th><th className="pb-3 pr-4">Impressões</th><th className="pb-3 pr-4">Cliques</th><th className="pb-3 pr-4">Conversas</th><th className="pb-3 pr-4">CTR</th><th className="pb-3">CPC</th></tr></thead><tbody>{sellerPerformance.map((seller) => <tr key={seller.id} className="border-b last:border-0"><td className="py-3 pr-4"><p className="font-medium">{seller.full_name || "Sem nome"}</p><p className="text-xs text-muted-foreground">{seller.active} ativa(s)</p></td><td className="py-3 pr-4">{seller.campaigns}</td><td className="py-3 pr-4">{money(seller.investment)}</td><td className="py-3 pr-4">{integer(seller.impressions)}</td><td className="py-3 pr-4">{integer(seller.clicks)}</td><td className="py-3 pr-4 font-medium">{liveLoading ? "…" : integer(seller.conversations)}</td><td className="py-3 pr-4">{seller.impressions ? percent(seller.ctr) : "—"}</td><td className="py-3">{seller.clicks ? money(seller.cpc) : "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Nenhum vendedor vinculado à loja.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Alertas da loja</CardTitle><p className="text-sm text-muted-foreground">O que precisa da atenção do gerente.</p></CardHeader><CardContent className="space-y-3">
        {sellersWithoutCampaign.length ? (
          <button
            type="button"
            aria-expanded={showIdleSellers}
            onClick={toggleIdleSellers}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-left text-red-900 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          >
            <span className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>
                <span className="block font-medium">Vendedores sem campanha ativa</span>
                <span className="block text-xs text-red-800/80 dark:text-red-200/80">
                  {showIdleSellers ? "Clique para fechar a lista." : "Clique para ver quem está parado."}
                </span>
              </span>
            </span>
            <span className="text-xl font-bold text-red-600">{sellersWithoutCampaign.length}</span>
          </button>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">Vendedores sem campanha ativa</p><p className="text-sm text-muted-foreground">Todos os vendedores estão com campanha ativa.</p></div></div>
        )}
        <div className="flex items-start gap-3 rounded-lg border p-3">{metrics.activeWithoutMetrics ? <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />}<div><p className="font-medium">Campanhas ativas sem métricas</p><p className="text-sm text-muted-foreground">{metrics.activeWithoutMetrics ? `${metrics.activeWithoutMetrics} campanha(s) ainda sem impressões ou cliques.` : "Não há campanhas ativas sem métricas."}</p></div></div>
        {(() => {
          // Só vendedores desta loja (a lista de vendedores já vem filtrada pela loja).
          const gap = (salesGap ?? []).map((row) => ({ ...row, name: sellers.find((seller) => seller.id === row.sellerId)?.full_name })).filter((row) => row.name !== undefined);
          return gap.length ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Conversas sem venda registrada</p>
                <p className="text-sm opacity-80">Nos últimos {SALES_REMINDER_DAYS} dias. Vale confirmar se algum cliente comprou:</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {gap.map((row) => <li key={row.sellerId}><span className="font-medium">{row.name || "Sem nome"}</span> · {row.conversations} {row.conversations === 1 ? "conversa" : "conversas"}</li>)}
                </ul>
              </div>
            </div>
          ) : salesGap ? (
            <div className="flex items-start gap-3 rounded-lg border p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">Conversas sem venda registrada</p><p className="text-sm text-muted-foreground">Nenhum vendedor com conversas e sem venda nos últimos {SALES_REMINDER_DAYS} dias.</p></div></div>
          ) : null;
        })()}
        <div className="flex items-start gap-3 rounded-lg border p-3"><MessageCircle className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">Conversas iniciadas</p><p className="text-sm text-muted-foreground">{liveLoading ? "Atualizando dados da Meta..." : metrics.conversations ? `${integer(metrics.conversations)} conversa(s) iniciada(s) nos últimos 30 dias.` : "Nenhuma conversa registrada no período."}</p></div></div>
        {live?.sellers.some((seller) => seller.error) && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">Algumas contas Meta não puderam ser consultadas. Os demais vendedores continuam sendo consolidados.</div>}
      </CardContent></Card>
    </section>
    {showIdleSellers && idleSellers.length > 0 && (
      <section id="vendedores-sem-campanha" className="scroll-mt-24 overflow-hidden rounded-xl border-2 border-red-300 bg-card shadow-sm dark:border-red-900">
        <div className="flex flex-col gap-3 bg-red-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold">Vendedores sem campanha ativa agora</h2>
              <p className="text-sm text-white/85">
                {idleSellers.length} {idleSellers.length === 1 ? "vendedor" : "vendedores"} da {store?.name ?? "loja"} sem nenhum anúncio rodando.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-red-700">{idleSellers.length} sem anúncio</span>
            <button type="button" onClick={() => setShowIdleSellers(false)} className="rounded-full border border-white/60 px-3 py-1 text-sm font-medium text-white hover:bg-white/15">Fechar</button>
          </div>
        </div>
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {idleSellers.map((seller) => (
            <li key={seller.id} className="flex items-start justify-between gap-3 rounded-lg border border-red-200 px-4 py-3 dark:border-red-900/60">
              <div className="min-w-0">
                <p className="truncate font-medium">{seller.full_name || "Sem nome"}</p>
                <p className={`text-xs font-medium ${seller.info.tone === "critical" ? "text-red-600" : "text-amber-600"}`}>{seller.info.text}</p>
                {seller.email ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{seller.email}</p> : null}
              </div>
              <Badge variant="outline" className="shrink-0">Vendedor</Badge>
            </li>
          ))}
        </ul>
      </section>
    )}
    <Card><CardHeader><CardTitle>Campanhas da loja</CardTitle><p className="text-sm text-muted-foreground">Números de cada campanha desde a publicação (total da campanha, não só 30 dias).</p></CardHeader><CardContent>{recentCampaigns.length ? <div className="space-y-2">{recentCampaigns.map((campaign) => { const seller = sellers.find((item) => item.id === campaign.seller_id); const impressions = Number(campaign.impressions ?? 0); const clicks = Number(campaign.clicks ?? 0); const spend = Number(campaign.spent_amount ?? 0); return <div key={campaign.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{campaign.name}</p><Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : campaign.status === "error" ? "Erro" : campaign.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Vendedor: {seller?.full_name || "Não identificado"}</p></div><div className="grid grid-cols-3 gap-4 text-right text-xs sm:grid-cols-5"><div><p className="text-muted-foreground">Invest.</p><p className="font-medium">{money(spend)}</p></div><div><p className="text-muted-foreground">Impressões</p><p className="font-medium">{integer(impressions)}</p></div><div><p className="text-muted-foreground">Cliques</p><p className="font-medium">{integer(clicks)}</p></div><div><p className="text-muted-foreground">CTR</p><p className="font-medium">{impressions ? percent((clicks / impressions) * 100) : "—"}</p></div><div className="flex items-end justify-end">{campaign.status !== "active" && campaign.end_date && new Date(campaign.end_date).getTime() <= Date.now() ? <span className="text-right text-[11px] text-muted-foreground" title="A oferta venceu. Renove a validade da oferta e use Publicar alterações nos anúncios.">Oferta vencida</span> : <Button size="sm" variant="outline" disabled={campaign.status === "error"} onClick={() => toggleCampaign(campaign.id, campaign.status)}>{campaign.status === "active" ? <><Pause className="mr-1 h-3.5 w-3.5" />Pausar</> : <><Play className="mr-1 h-3.5 w-3.5" />Ativar</>}</Button>}</div></div></div>; })}</div> : <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada para esta loja.</p>}</CardContent></Card>
    <p className="text-right text-xs text-muted-foreground">{live?.fetched_at ? `Métricas da Meta atualizadas em ${new Date(live.fetched_at).toLocaleString("pt-BR")}. ` : ""}Período das métricas: últimos 30 dias.</p>
  </div>;
}

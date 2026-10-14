import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Link2Off,
  Loader2,
  MessageCircle,
  MousePointerClick,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  UserRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { loadStoreMetrics } from "@/lib/storeMetrics";
import { loadSellerReadiness, type SellerReadiness } from "@/lib/sellerReadiness";
import { formatDay, loadSales, rangeFor, type Sale } from "@/lib/sales";

type Seller = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  job_title: string | null;
  status: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  seller_id: string;
  archived_at: string | null;
};

type LiveSeller = {
  seller_id: string;
  connected: boolean;
  campaigns_mapped: number;
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    conversations: number;
    reach: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  error?: string;
};

type LiveInsights = {
  period: string;
  sellers: LiveSeller[];
  fetched_at: string;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const integer = (v: number) => v.toLocaleString("pt-BR");
const percent = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

function relativeSyncDate(value: string | null) {
  if (!value) return "Sem sincronização registrada";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Atualizado agora";
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours}h`;
  return `Atualizado há ${Math.floor(hours / 24)}d`;
}

export function ManagerSellers() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [storeName, setStoreName] = useState("Minha loja");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [live, setLive] = useState<LiveInsights | null>(null);
  const [readiness, setReadiness] = useState<SellerReadiness[] | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sessão não encontrada.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", auth.user.id)
      .single();

    if (profileError || !profile?.store_id) {
      setError(profileError?.message || "Gerente sem loja vinculada.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [storeResult, sellerRolesResult, campaignResult] = await Promise.all([
      supabase.from("stores").select("name").eq("id", profile.store_id).single(),
      supabase.from("user_roles").select("user_id").eq("role", "VENDEDOR"),
      supabase
        .from("seller_campaigns")
        .select("id,name,status,seller_id,archived_at")
        .eq("store_id", profile.store_id)
        .is("archived_at", null),
    ]);

    if (storeResult.error) setError(storeResult.error.message);
    if (campaignResult.error) setError(campaignResult.error.message);

    setStoreName(storeResult.data?.name || "Minha loja");
    setCampaigns(campaignResult.data ?? []);

    const sellerIds = (sellerRolesResult.data ?? []).map((row) => row.user_id);
    if (sellerIds.length) {
      const { data: sellerRows, error: sellerError } = await supabase
        .from("profiles")
        .select("id,full_name,email,whatsapp,job_title,status")
        .eq("store_id", profile.store_id)
        .in("id", sellerIds)
        .order("full_name");
      if (sellerError) setError(sellerError.message);
      setSellers(sellerRows ?? []);
    } else {
      setSellers([]);
    }

    // Resultados reais (últimos 30 dias) sincronizados da Meta, por vendedor, e vendas do mês.
    const [storeMetrics, readinessRows, salesResult] = await Promise.all([
      loadStoreMetrics(30, false),
      loadSellerReadiness(),
      loadSales(rangeFor("current_month")),
    ]);
    setSales((salesResult.data ?? []) as Sale[]);
    if (storeMetrics) setLive(storeMetrics);
    setReadiness(readinessRows);

    setLoading(false);
    setRefreshing(false);
    // Atualiza com a Meta em segundo plano, sem travar a tela.
    void loadStoreMetrics(30, true).then((fresh) => {
      if (fresh) setLive(fresh);
    });
  }

  useEffect(() => {
    void load();
  }, []);

  const sellerRows = useMemo(() => sellers.map((seller) => {
    const sellerCampaigns = campaigns.filter((campaign) => campaign.seller_id === seller.id);
    const activeCampaigns = sellerCampaigns.filter((campaign) => campaign.status === "active");
    const pausedCampaigns = sellerCampaigns.filter((campaign) => campaign.status === "paused");
    const errorCampaigns = sellerCampaigns.filter((campaign) => campaign.status === "error");
    const liveSeller = live?.sellers.find((row) => row.seller_id === seller.id);
    const metrics = liveSeller?.metrics ?? { spend: 0, impressions: 0, clicks: 0, conversations: 0, reach: 0, ctr: 0, cpc: 0, cpm: 0 };
    // Conexão real com a Meta (independe de já ter resultados).
    const connected = readiness?.find((row) => row.seller_id === seller.id)?.meta_connected ?? false;

    let state: "normal" | "attention" | "offline" = "normal";
    let stateLabel = "Operando normalmente";
    if (!connected) {
      state = "offline";
      stateLabel = "Sem conexão Meta";
    } else if (activeCampaigns.length === 0) {
      state = "attention";
      stateLabel = "Sem campanha ativa";
    } else if (errorCampaigns.length > 0) {
      state = "attention";
      stateLabel = "Campanha com erro";
    }

    const sellerSales = sales.filter((sale) => sale.seller_id === seller.id);
    return {
      seller,
      sellerSales,
      verifiedSales: sellerSales.filter((sale) => sale.verified_at).length,
      sellerCampaigns,
      activeCampaigns,
      pausedCampaigns,
      errorCampaigns,
      liveSeller,
      connected,
      state,
      stateLabel,
      metrics,
    };
  }).sort((a, b) => b.metrics.conversations - a.metrics.conversations || b.metrics.clicks - a.metrics.clicks || a.seller.full_name?.localeCompare(b.seller.full_name ?? "") || 0), [sellers, campaigns, live, readiness, sales]);

  const summary = useMemo(() => ({
    total: sellerRows.length,
    active: sellerRows.filter((row) => row.activeCampaigns.length > 0).length,
    withoutCampaign: sellerRows.filter((row) => row.activeCampaigns.length === 0).length,
    connected: sellerRows.filter((row) => row.connected).length,
    sales: sellerRows.reduce((sum, row) => sum + row.sellerSales.length, 0),
    verified: sellerRows.reduce((sum, row) => sum + row.verifiedSales, 0),
  }), [sellerRows]);

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando vendedores da loja...</div>;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Operação da loja</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Vendedores</h2>
          <p className="mt-1 text-sm text-muted-foreground">{storeName} · acompanhe a operação e a performance individual.</p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </section>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendedores</p><p className="mt-1 text-2xl font-semibold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com campanha ativa</p><p className="mt-1 text-2xl font-semibold">{summary.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem campanha ativa</p><p className="mt-1 text-2xl font-semibold">{summary.withoutCampaign}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Meta conectada</p><p className="mt-1 text-2xl font-semibold">{summary.connected}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendas no mês</p><p className="mt-1 text-2xl font-semibold">{summary.sales}</p><p className="text-xs text-muted-foreground">{summary.verified} conferida(s) · {summary.sales - summary.verified} aguardando</p></CardContent></Card>
      </section>
      <p className="-mt-3 text-xs text-muted-foreground">Desempenho dos anúncios: últimos 30 dias. Vendas: mês atual.</p>

      <section className="space-y-4">
        {sellerRows.map((row) => {
          const expanded = selectedSellerId === row.seller.id;
          const syncLabel = relativeSyncDate(live?.fetched_at ?? null);
          return (
            <Card key={row.seller.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{row.seller.full_name || "Sem nome"}</h3>
                          <Badge variant={row.state === "normal" ? "secondary" : "destructive"}>{row.stateLabel}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{row.seller.job_title || "Vendedor"} · {row.seller.email || "E-mail não informado"}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{syncLabel}</span>
                          <span className="inline-flex items-center gap-1">{row.connected ? <><CheckCircle2 className="h-3.5 w-3.5" />Meta conectada</> : <><Link2Off className="h-3.5 w-3.5" />Meta não conectada</>}</span>
                          {row.seller.whatsapp && <span>{row.seller.whatsapp}</span>}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" className="gap-2 self-start" onClick={() => setSelectedSellerId(expanded ? null : row.seller.id)}>
                      {expanded ? "Ocultar detalhes" : "Ver performance"}
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Investimento" value={money(row.metrics.spend)} icon={<Wallet className="h-4 w-4" />} />
                    <Metric label="Impressões" value={integer(row.metrics.impressions)} />
                    <Metric label="Cliques" value={integer(row.metrics.clicks)} icon={<MousePointerClick className="h-4 w-4" />} />
                    <Metric label="Conversas iniciadas" value={integer(row.metrics.conversations)} icon={<MessageCircle className="h-4 w-4" />} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className={`rounded-lg border p-3 ${row.sellerSales.length ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "bg-background"}`}>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BadgeCheck className="h-4 w-4" />Vendas no mês</p>
                      <p className="mt-1 font-semibold">{row.sellerSales.length}{row.sellerSales.length ? <span className="ml-1 text-xs font-normal text-muted-foreground">· {row.verifiedSales} conferida(s)</span> : null}</p>
                    </div>
                    <SmallMetric label="CTR" value={row.metrics.impressions ? percent(row.metrics.ctr) : "—"} />
                    <SmallMetric label="CPC" value={row.metrics.clicks ? money(row.metrics.cpc) : "—"} />
                    <SmallMetric label="CPM" value={row.metrics.impressions ? money(row.metrics.cpm) : "—"} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{row.activeCampaigns.length} ativa(s)</Badge>
                    <Badge variant="outline">{row.pausedCampaigns.length} pausada(s)</Badge>
                    {row.errorCampaigns.length > 0 && <Badge variant="destructive">{row.errorCampaigns.length} com erro</Badge>}
                    {row.liveSeller?.error && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{row.liveSeller.error}</span>}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t bg-muted/20 p-5">
                    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                      <div>
                        <h4 className="font-medium">Dados do vendedor</h4>
                        <div className="mt-3 space-y-2 text-sm">
                          <Info label="Nome" value={row.seller.full_name || "Não informado"} />
                          <Info label="E-mail" value={row.seller.email || "Não informado"} />
                          <Info label="WhatsApp" value={row.seller.whatsapp || "Não informado"} />
                          <Info label="Status" value={row.seller.status || "Não informado"} />
                        </div>
                      </div>
                      <div className="space-y-6">
                      <div>
                        <h4 className="font-medium">Vendas no mês</h4>
                        <div className="mt-3 space-y-2">
                          {row.sellerSales.length ? row.sellerSales.map((sale) => (
                            <div key={sale.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                              <div className="min-w-0"><p className="truncate text-sm font-medium">{sale.vehicle_model}</p><p className="text-xs text-muted-foreground">{formatDay(sale.sale_date)} · Proposta {sale.proposal_number}</p></div>
                              {sale.verified_at ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Conferida</Badge> : <Badge variant="outline">Aguardando conferência</Badge>}
                            </div>
                          )) : <p className="text-sm text-muted-foreground">Nenhuma venda registrada neste mês.</p>}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium">Campanhas do vendedor</h4>
                        <div className="mt-3 space-y-2">
                          {row.sellerCampaigns.length ? row.sellerCampaigns.map((campaign) => (
                            <div key={campaign.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                              <div className="min-w-0"><p className="truncate text-sm font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : campaign.status === "error" ? "Com erro" : campaign.status}</p></div>
                              {campaign.status === "active" ? <PlayCircle className="h-4 w-4 text-primary" /> : campaign.status === "paused" ? <PauseCircle className="h-4 w-4 text-muted-foreground" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                            </div>
                          )) : <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>}
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!sellerRows.length && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum vendedor vinculado a esta loja.</CardContent></Card>}
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-lg border bg-background p-3"><p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Period = "today" | "7" | "30" | "month" | "all";

type Metric = {
  seller_campaign_id: string;
  seller_id: string;
  store_id: string | null;
  metric_date: string;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  leads: number | null;
};

type Campaign = {
  id: string;
  name: string;
  seller_id: string;
  vehicle_id: string | null;
  store_id: string | null;
  company_id: string | null;
  brand_id: string | null;
  status: string;
  created_at: string;
  archived_at: string | null;
};

type NamedRecord = { id: string; name: string };
type SellerRecord = NamedRecord & { store_id: string | null };
type StoreRecord = NamedRecord & { brand_id: string | null };

type Aggregate = {
  spend: number;
  clicks: number;
  impressions: number;
  conversations: number;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function percent(value: number) {
  return `${value.toFixed(2).replace(".", ",")} %`;
}

function ctr(clicks: number, impressions: number) {
  return impressions > 0 ? percent((clicks / impressions) * 100) : "—";
}

function cpc(spend: number, clicks: number) {
  return clicks > 0 ? money(spend / clicks) : "—";
}

function costPerConversation(spend: number, conversations: number) {
  return conversations > 0 ? money(spend / conversations) : "—";
}

function cpm(spend: number, impressions: number) {
  return impressions > 0 ? money((spend / impressions) * 1000) : "—";
}

function aggregate(items: Metric[]): Aggregate {
  return items.reduce(
    (total, item) => ({
      spend: total.spend + Number(item.spend || 0),
      clicks: total.clicks + Number(item.clicks || 0),
      impressions: total.impressions + Number(item.impressions || 0),
      conversations: total.conversations + Number(item.leads || 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, conversations: 0 },
  );
}

function startDate(period: Period) {
  if (period === "all") return null;

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  if (period === "7") date.setDate(date.getDate() - 6);
  if (period === "30") date.setDate(date.getDate() - 29);
  if (period === "month") date.setDate(1);

  return date.toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  if (status === "active") return "Ativa";
  if (status === "paused") return "Pausada";
  return status;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "secondary" : "outline"}>
      {statusLabel(status)}
    </Badge>
  );
}

function MetricGrid({ data }: { data: Aggregate }) {
  const items = [
    ["Conversas", number(data.conversations)],
    ["Custo/conversa", costPerConversation(data.spend, data.conversations)],
    ["Invest.", money(data.spend)],
    ["Impress.", number(data.impressions)],
    ["Cliques", number(data.clicks)],
    ["CTR", ctr(data.clicks, data.impressions)],
    ["CPC", cpc(data.spend, data.clicks)],
    ["CPM", cpm(data.spend, data.impressions)],
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="min-w-0 rounded-lg bg-muted/40 px-2.5 py-2" key={label}>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold leading-tight">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CampaignCard({
  campaign,
  metrics,
  vehicleName,
  storeName,
  sellerName,
  brandName,
}: {
  campaign: Campaign;
  metrics: Metric[];
  vehicleName: string;
  storeName: string;
  sellerName: string;
  brandName: string;
}) {
  const data = aggregate(metrics);

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold leading-tight">
            {vehicleName}
          </p>
          <p className="mt-1 break-words text-sm font-medium text-foreground">
            {storeName}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Campanha: {campaign.name}</span>
            <span>Vendedor: {sellerName}</span>
            <span>Marca: {brandName}</span>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      <MetricGrid data={data} />
    </div>
  );
}

function PerformanceCard({
  title,
  subtitle,
  data,
  meta,
  alert,
}: {
  title: string;
  subtitle?: string;
  data: Aggregate;
  meta?: ReactNode;
  alert?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="break-words font-semibold">{title}</p>
          {subtitle ? (
            <p className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {meta}
      </div>
      {alert ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-destructive">⚠ {alert}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">O vendedor está sem campanha ativa no momento.</p>
        </div>
      ) : null}
      <MetricGrid data={data} />
    </div>
  );
}

export function CampaignPerformance() {
  const [period, setPeriod] = useState<Period>("30");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<SellerRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [vehicles, setVehicles] = useState<NamedRecord[]>([]);
  const [brands, setBrands] = useState<NamedRecord[]>([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Busca os resultados diários na Meta e grava em campaign_metrics; depois recarrega o painel.
  async function syncWithMeta() {
    setSyncing(true);
    setSyncMessage("");
    const { data, error } = await supabase.functions.invoke("meta-sync-campaign-metrics-v1", { body: {} });
    setSyncing(false);
    if (error || data?.error) {
      setSyncMessage("Não foi possível atualizar com a Meta agora. Exibindo os últimos dados salvos.");
    } else {
      const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setSyncMessage(
        data?.failed
          ? `Atualizado com a Meta às ${time}. ${data.failed} campanha(s) não puderam ser consultadas.`
          : `Atualizado com a Meta às ${time}.`,
      );
    }
    setReloadKey((current) => current + 1);
  }

  useEffect(() => {
    void syncWithMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPerformance() {
      setLoading(true);
      const from = startDate(period);

      const metricsQuery = supabase
        .from("campaign_metrics")
        .select(
          "seller_campaign_id, seller_id, store_id, metric_date, spend, clicks, impressions, leads",
        );

      const campaignsQuery = supabase
        .from("seller_campaigns")
        .select(
          "id, name, seller_id, vehicle_id, store_id, company_id, brand_id, status, created_at, archived_at",
        );

      if (from) metricsQuery.gte("metric_date", from);

      const [metricsResult, campaignsResult, profilesResult, storesResult, vehiclesResult, brandsResult] =
        await Promise.all([
          metricsQuery,
          campaignsQuery,
          supabase.from("profiles").select("id, full_name, store_id"),
          supabase.from("stores").select("id, name, brand_id"),
          supabase.from("vehicles").select("id, brand, model"),
          supabase.from("brands").select("id, name").eq("active", true).order("name"),
        ]);

      if (!mounted) return;

      setMetrics((metricsResult.data ?? []) as Metric[]);
      setCampaigns((campaignsResult.data ?? []) as Campaign[]);
      setProfiles(
        (profilesResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.full_name ?? "Sem nome",
          store_id: item.store_id ?? null,
        })),
      );
      setStores((storesResult.data ?? []) as StoreRecord[]);
      setVehicles(
        (vehiclesResult.data ?? []).map((item) => ({
          id: item.id,
          name: `${item.brand} ${item.model}`.trim(),
        })),
      );
      setBrands((brandsResult.data ?? []) as NamedRecord[]);
      setLoading(false);
    }

    loadPerformance().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [period, reloadKey]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    [...profiles, ...stores, ...vehicles, ...brands].forEach((item) =>
      map.set(item.id, item.name),
    );
    return map;
  }, [profiles, stores, vehicles, brands]);

  const currentCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          !campaign.archived_at &&
          (campaign.status === "active" || campaign.status === "paused"),
      ),
    [campaigns],
  );

  const archivedCampaigns = useMemo(
    () => campaigns.filter((campaign) => Boolean(campaign.archived_at)),
    [campaigns],
  );

  const visibleCampaigns = useMemo(() => {
    const source = showArchived ? archivedCampaigns : currentCampaigns;

    return source.filter((campaign) => {
      if (brandFilter !== "all" && campaign.brand_id !== brandFilter) return false;
      if (storeFilter !== "all" && campaign.store_id !== storeFilter) return false;
      if (sellerFilter !== "all" && campaign.seller_id !== sellerFilter) return false;
      return true;
    });
  }, [showArchived, archivedCampaigns, currentCampaigns, brandFilter, storeFilter, sellerFilter]);

  const metricByCampaign = useMemo(() => {
    const map = new Map<string, Metric[]>();
    metrics.forEach((metric) => {
      const list = map.get(metric.seller_campaign_id) ?? [];
      list.push(metric);
      map.set(metric.seller_campaign_id, list);
    });
    return map;
  }, [metrics]);

  // Resultados do período contam TODAS as campanhas que rodaram, inclusive as já arquivadas
  // (o gasto e as conversas aconteceram). O "Ver arquivadas" muda só a lista de campanhas.
  // Assim os números batem com o Dashboard, o painel do gerente e o do vendedor.
  const matchesFilters = (campaign: Campaign) => {
    if (brandFilter !== "all" && campaign.brand_id !== brandFilter) return false;
    if (storeFilter !== "all" && campaign.store_id !== storeFilter) return false;
    if (sellerFilter !== "all" && campaign.seller_id !== sellerFilter) return false;
    return true;
  };
  const resultCampaigns = campaigns.filter(
    (campaign) => metricByCampaign.has(campaign.id) || currentCampaigns.includes(campaign),
  );

  const filteredMetrics = useMemo(() => {
    const ids = new Set(
      campaigns
        .filter((campaign) => {
          if (brandFilter !== "all" && campaign.brand_id !== brandFilter) return false;
          if (storeFilter !== "all" && campaign.store_id !== storeFilter) return false;
          if (sellerFilter !== "all" && campaign.seller_id !== sellerFilter) return false;
          return true;
        })
        .map((campaign) => campaign.id),
    );
    return metrics.filter((metric) => ids.has(metric.seller_campaign_id));
  }, [metrics, campaigns, brandFilter, storeFilter, sellerFilter]);

  const total = useMemo(() => aggregate(filteredMetrics), [filteredMetrics]);
  const activeCampaignCount = currentCampaigns.filter((campaign) => {
    if (brandFilter !== "all" && campaign.brand_id !== brandFilter) return false;
    if (storeFilter !== "all" && campaign.store_id !== storeFilter) return false;
    if (sellerFilter !== "all" && campaign.seller_id !== sellerFilter) return false;
    return campaign.status === "active";
  }).length;

  const activeSellerCount = new Set(
    currentCampaigns
      .filter((campaign) => {
        if (brandFilter !== "all" && campaign.brand_id !== brandFilter) return false;
        if (storeFilter !== "all" && campaign.store_id !== storeFilter) return false;
        if (sellerFilter !== "all" && campaign.seller_id !== sellerFilter) return false;
        return campaign.status === "active";
      })
      .map((campaign) => campaign.seller_id),
  ).size;

  const availableStores = stores.filter(
    (store) => brandFilter === "all" || store.brand_id === brandFilter,
  );

  const availableSellers = profiles.filter((profile) => {
    if (!profile.store_id) return false;

    if (storeFilter !== "all" && profile.store_id !== storeFilter) return false;

    if (brandFilter !== "all") {
      const profileStore = stores.find((store) => store.id === profile.store_id);
      const profileBrandId = profileStore?.brand_id;
      const hasMatchingCampaign = currentCampaigns.some(
        (campaign) =>
          campaign.seller_id === profile.id &&
          campaign.brand_id === brandFilter,
      );
      if (profileBrandId !== brandFilter && !hasMatchingCampaign) return false;
    }

    return true;
  });

  const brandName = (campaign: Campaign) => {
    if (campaign.brand_id) return names.get(campaign.brand_id) ?? "—";
    const store = stores.find((item) => item.id === campaign.store_id);
    return store?.brand_id ? names.get(store.brand_id) ?? "—" : "—";
  };

  const storeName = (campaign: Campaign) =>
    names.get(campaign.store_id ?? "") ?? "Loja não informada";

  const sellerName = (campaign: Campaign) =>
    names.get(campaign.seller_id) ?? "Vendedor não informado";

  const vehicleName = (campaign: Campaign) =>
    names.get(campaign.vehicle_id ?? "") ?? campaign.name;

  const setFilter = (type: "brand" | "store" | "seller", value: string) => {
    if (type === "brand") {
      setBrandFilter(value);
      setStoreFilter("all");
      setSellerFilter("all");
      return;
    }
    if (type === "store") {
      setStoreFilter(value);
      setSellerFilter("all");
      return;
    }
    setSellerFilter(value);
  };

  const storePerformance = availableStores
    .map((store) => {
      const inStore = (campaign: Campaign) => campaign.store_id === store.id && matchesFilters(campaign);
      const storeCampaigns = currentCampaigns.filter(inStore);
      const data = aggregate(
        resultCampaigns.filter(inStore).flatMap((campaign) => metricByCampaign.get(campaign.id) ?? []),
      );
      return { store, campaigns: storeCampaigns, data, hasResults: resultCampaigns.some(inStore) };
    })
    .filter(({ campaigns, hasResults }) => campaigns.length > 0 || hasResults);

  const sellerPerformance = availableSellers.map((seller) => {
    const ofSeller = (campaign: Campaign) => campaign.seller_id === seller.id && matchesFilters(campaign);
    const sellerCampaigns = currentCampaigns.filter(ofSeller);
    const data = aggregate(
      resultCampaigns.filter(ofSeller).flatMap((campaign) => metricByCampaign.get(campaign.id) ?? []),
    );
    const firstCampaign = sellerCampaigns[0];
    const sellerStore = stores.find((store) => store.id === seller.store_id);
    const hasActiveCampaign = sellerCampaigns.some((campaign) => campaign.status === "active");
    return {
      seller,
      campaigns: sellerCampaigns,
      data,
      firstCampaign,
      sellerStore,
      hasActiveCampaign,
    };
  });

  const vehiclePerformance = vehicles
    .map((vehicle) => {
      const vehicleCampaigns = resultCampaigns.filter(
        (campaign) => campaign.vehicle_id === vehicle.id && matchesFilters(campaign),
      );
      return {
        vehicle,
        data: aggregate(
          vehicleCampaigns.flatMap((campaign) => metricByCampaign.get(campaign.id) ?? []),
        ),
      };
    })
    .filter(({ vehicle }) => vehicle.name);

  if (loading) {
    return (
      <section className="space-y-6">
        <p className="text-sm text-muted-foreground">Carregando performance...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Indicadores reais</p>
          <h2 className="mt-1 text-2xl font-semibold">Performance das Campanhas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {syncing ? "Atualizando com a Meta..." : syncMessage || "Dados da Meta atualizados a cada 30 minutos."}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
        <Button variant="outline" onClick={() => void syncWithMeta()} disabled={syncing}>
          {syncing ? "Atualizando..." : "Atualizar"}
        </Button>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {!showArchived ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Vendedores com campanhas ativas", activeSellerCount],
            ["Campanhas ativas", activeCampaignCount],
            ["Conversas iniciadas", number(total.conversations)],
            ["Custo por conversa", costPerConversation(total.spend, total.conversations)],
            ["Investimento", money(total.spend)],
            ["Impressões", number(total.impressions)],
            ["Cliques no anúncio", number(total.clicks)],
            ["CTR", ctr(total.clicks, total.impressions)],
            ["CPC", cpc(total.spend, total.clicks)],
            ["CPM", cpm(total.spend, total.impressions)],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <p className="mb-1 text-sm font-medium">Marca</p>
            <Select value={brandFilter} onValueChange={(value) => setFilter("brand", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Loja</p>
            <Select value={storeFilter} onValueChange={(value) => setFilter("store", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Vendedor</p>
            <Select value={sellerFilter} onValueChange={(value) => setFilter("seller", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableSellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!showArchived ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Performance por Loja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {storePerformance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum dado no período selecionado.
                </p>
              ) : (
                storePerformance.map(({ store, campaigns: storeCampaigns, data }) => (
                  <PerformanceCard
                    key={store.id}
                    title={store.name}
                    subtitle={brands.find((brand) => brand.id === store.brand_id)?.name}
                    data={data}
                    meta={<Badge variant="outline">{storeCampaigns.length} campanhas atuais</Badge>}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Performance por Vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sellerPerformance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum dado no período selecionado.
                </p>
              ) : (
                sellerPerformance.map(({ seller, campaigns: sellerCampaigns, data, firstCampaign, sellerStore, hasActiveCampaign }) => (
                  <PerformanceCard
                    key={seller.id}
                    title={seller.name}
                    subtitle={`Loja: ${sellerStore?.name ?? (firstCampaign ? storeName(firstCampaign) : "Loja não informada")}`}
                    data={data}
                    meta={<Badge variant="outline">{sellerStore?.brand_id ? names.get(sellerStore.brand_id) ?? "—" : firstCampaign ? brandName(firstCampaign) : "—"}</Badge>}
                    alert={!hasActiveCampaign ? "Nenhuma campanha ativa" : undefined}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Performance por Veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vehiclePerformance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum dado no período selecionado.
                </p>
              ) : (
                vehiclePerformance.map(({ vehicle, data }) => (
                  <PerformanceCard key={vehicle.id} title={vehicle.name} data={data} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Detalhes das Campanhas</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Campanhas ativas e pausadas.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowArchived(true)}
              >
                Ver campanhas arquivadas
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleCampaigns.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma campanha ativa ou pausada encontrada.
                </p>
              ) : (
                visibleCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    metrics={metricByCampaign.get(campaign.id) ?? []}
                    vehicleName={vehicleName(campaign)}
                    storeName={storeName(campaign)}
                    sellerName={sellerName(campaign)}
                    brandName={brandName(campaign)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Campanhas arquivadas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Histórico separado das campanhas excluídas/arquivadas.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowArchived(false)}
            >
              Voltar às campanhas
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleCampaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma campanha arquivada encontrada.
              </p>
            ) : (
              visibleCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  metrics={metricByCampaign.get(campaign.id) ?? []}
                  vehicleName={vehicleName(campaign)}
                  storeName={storeName(campaign)}
                  sellerName={sellerName(campaign)}
                  brandName={brandName(campaign)}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

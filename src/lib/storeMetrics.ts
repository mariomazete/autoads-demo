import { supabase } from "@/integrations/supabase/client";

export type MetricTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversations: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type StoreMetrics = {
  period: string;
  store: MetricTotals;
  sellers: Array<{
    seller_id: string;
    seller_name: string;
    connected: boolean;
    campaigns_mapped: number;
    metrics: MetricTotals;
    error?: string;
  }>;
  /** One entry per day of the period (oldest first), including days without results. */
  daily: Array<{ date: string; conversations: number; spend: number }>;
  fetched_at: string;
};

// Local calendar day (the Meta account reports in Brasília time), as YYYY-MM-DD.
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const emptyTotals = (): MetricTotals => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversations: 0,
  reach: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
});

const finalize = (totals: MetricTotals): MetricTotals => ({
  ...totals,
  ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
  cpc: totals.clicks ? totals.spend / totals.clicks : 0,
  cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0,
});

/**
 * Real campaign results for the manager's store (last `days` days).
 * Pulls the latest daily results from Meta into campaign_metrics, then sums them
 * for the store and per seller. RLS limits the rows to the manager's store.
 */
export async function loadStoreMetrics(days = 30, sync = true): Promise<StoreMetrics | null> {
  if (sync) await supabase.functions.invoke("meta-sync-campaign-metrics-v1", { body: {} }).catch(() => null);
  const since = localDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const { data: rows, error } = await supabase
    .from("campaign_metrics")
    .select("seller_id, metric_date, spend, impressions, clicks, leads")
    .gte("metric_date", since);
  if (error) return null;

  const store = emptyTotals();
  const byDay = new Map<string, { conversations: number; spend: number }>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = localDay(new Date(Date.now() - offset * 24 * 60 * 60 * 1000));
    byDay.set(day, { conversations: 0, spend: 0 });
  }
  const bySeller = new Map<string, MetricTotals>();
  for (const row of rows ?? []) {
    const seller = bySeller.get(row.seller_id) ?? emptyTotals();
    for (const target of [store, seller]) {
      target.spend += Number(row.spend ?? 0);
      target.impressions += Number(row.impressions ?? 0);
      target.clicks += Number(row.clicks ?? 0);
      target.conversations += Number(row.leads ?? 0);
    }
    bySeller.set(row.seller_id, seller);
    const day = byDay.get(String(row.metric_date));
    if (day) {
      day.conversations += Number(row.leads ?? 0);
      day.spend += Number(row.spend ?? 0);
    }
  }

  return {
    period: `last_${days}d`,
    store: finalize(store),
    sellers: Array.from(bySeller.entries()).map(([seller_id, metrics]) => ({
      seller_id,
      seller_name: "",
      connected: true,
      campaigns_mapped: 0,
      metrics: finalize(metrics),
    })),
    daily: Array.from(byDay.entries()).map(([date, values]) => ({ date, ...values })),
    fetched_at: new Date().toISOString(),
  };
}

/** Período único usado em todos os indicadores de desempenho dos painéis. */
export const METRICS_DAYS = 30;
export const METRICS_PERIOD_LABEL = "Últimos 30 dias";

/**
 * Resultados do vendedor logado nos últimos `days` dias: totais e série diária.
 * Mesma fonte (campaign_metrics) e mesmo período do gráfico, do ranking e dos painéis
 * do gerente e do master, para os números sempre baterem. Inclui campanhas já arquivadas,
 * porque o investimento e as conversas delas aconteceram no período.
 */
export async function loadMyMetrics(
  days = METRICS_DAYS,
  sync = true,
): Promise<{ totals: MetricTotals; daily: StoreMetrics["daily"] } | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  if (sync) await supabase.functions.invoke("meta-sync-campaign-metrics-v1", { body: {} }).catch(() => null);
  const since = localDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const { data: rows, error } = await supabase
    .from("campaign_metrics")
    .select("metric_date, spend, impressions, clicks, leads")
    .eq("seller_id", auth.user.id)
    .gte("metric_date", since);
  if (error) return null;
  const totals = emptyTotals();
  const byDay = new Map<string, { conversations: number; spend: number }>();
  for (let offset = days - 1; offset >= 0; offset--) {
    byDay.set(localDay(new Date(Date.now() - offset * 24 * 60 * 60 * 1000)), { conversations: 0, spend: 0 });
  }
  for (const row of rows ?? []) {
    totals.spend += Number(row.spend ?? 0);
    totals.impressions += Number(row.impressions ?? 0);
    totals.clicks += Number(row.clicks ?? 0);
    totals.conversations += Number(row.leads ?? 0);
    const day = byDay.get(String(row.metric_date));
    if (!day) continue;
    day.conversations += Number(row.leads ?? 0);
    day.spend += Number(row.spend ?? 0);
  }
  return {
    totals: finalize(totals),
    daily: Array.from(byDay.entries()).map(([date, values]) => ({ date, ...values })),
  };
}

/** Daily conversations and spend of the logged-in seller's own campaigns (RLS: own rows only). */
export async function loadMyDailyMetrics(days = 30, sync = true): Promise<StoreMetrics["daily"] | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  // Puxa da Meta os resultados mais recentes das campanhas do próprio vendedor.
  if (sync) await supabase.functions.invoke("meta-sync-campaign-metrics-v1", { body: {} }).catch(() => null);
  const since = localDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const { data: rows, error } = await supabase
    .from("campaign_metrics")
    .select("metric_date, spend, leads")
    .eq("seller_id", auth.user.id)
    .gte("metric_date", since);
  if (error) return null;
  const byDay = new Map<string, { conversations: number; spend: number }>();
  for (let offset = days - 1; offset >= 0; offset--) {
    byDay.set(localDay(new Date(Date.now() - offset * 24 * 60 * 60 * 1000)), { conversations: 0, spend: 0 });
  }
  for (const row of rows ?? []) {
    const day = byDay.get(String(row.metric_date));
    if (!day) continue;
    day.conversations += Number(row.leads ?? 0);
    day.spend += Number(row.spend ?? 0);
  }
  return Array.from(byDay.entries()).map(([date, values]) => ({ date, ...values }));
}

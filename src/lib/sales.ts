import { supabase } from "@/integrations/supabase/client";

/** Venda registrada manualmente pelo vendedor (sem dados do cliente). */
export type Sale = {
  id: string;
  seller_id: string;
  store_id: string;
  seller_campaign_id: string;
  proposal_number: string;
  vehicle_model: string;
  sale_date: string;
  created_at: string;
  /** Quando o gerente/master conferiu a proposta (null = aguardando conferência). */
  verified_at: string | null;
};

export type SalePeriod = "current_month" | "previous_month" | "custom";

export type DateRange = { from: string; to: string };

// Dia local (Brasília) no formato YYYY-MM-DD.
export const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const todayLocal = () => localDay(new Date());

export function rangeFor(period: SalePeriod, custom?: DateRange): DateRange {
  const now = new Date();
  if (period === "previous_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: localDay(first), to: localDay(last) };
  }
  if (period === "custom" && custom?.from && custom?.to) {
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }
  return { from: localDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDay(now) };
}

export const PERIOD_LABELS: Record<SalePeriod, string> = {
  current_month: "Mês atual",
  previous_month: "Mês anterior",
  custom: "Personalizado",
};

/** "2026-10-04" → "04/10/2026" sem conversão de fuso. */
export const formatDay = (day: string) => {
  const [y, m, d] = day.split("-");
  return d && m && y ? `${d}/${m}/${y}` : day;
};

/** Vendas visíveis para o usuário logado no período (o banco já limita por papel). */
export async function loadSales(range: DateRange) {
  return supabase
    .from("sales")
    .select(
      "id, seller_id, store_id, seller_campaign_id, proposal_number, vehicle_model, sale_date, created_at, verified_at",
    )
    .gte("sale_date", range.from)
    .lte("sale_date", range.to)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });
}

/** Mensagem amigável para os erros que o banco devolve ao salvar uma venda. */
export function saleErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return "";
  if (error.code === "23505") return "Essa proposta já foi registrada nesta loja.";
  const known = [
    "A campanha escolhida não pertence a este vendedor.",
    "A data da venda não pode ser no futuro.",
    "Apenas vendedores podem registrar vendas.",
    "Seu usuário não está vinculado a uma loja.",
    "Sessão não encontrada.",
  ];
  const match = known.find((text) => error.message?.includes(text));
  if (match) return match;
  if (error.code === "42501") return "Você não tem permissão para alterar esta venda.";
  return error.message || "Não foi possível salvar a venda.";
}

/** Avisa as outras telas abertas que uma venda foi registrada, corrigida ou excluída. */
export const SALES_CHANGED_EVENT = "autoads:sales-changed";
export const notifySalesChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SALES_CHANGED_EVENT));
};

/** Resumo do período para cards: vendas, conferidas, conversas e investimento dos anúncios. */
export async function loadSalesSummary(range: DateRange) {
  const [salesResult, metricsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, verified_at")
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),
    supabase
      .from("campaign_metrics")
      .select("leads, spend")
      .gte("metric_date", range.from)
      .lte("metric_date", range.to),
  ]);
  const rows = salesResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  return {
    error: salesResult.error?.message ?? null,
    sales: rows.length,
    verified: rows.filter((row) => row.verified_at).length,
    conversations: metrics.reduce((sum, row) => sum + Number(row.leads ?? 0), 0),
    spend: metrics.reduce((sum, row) => sum + Number(row.spend ?? 0), 0),
  };
}

/** Janela do lembrete de registrar venda. */
export const SALES_REMINDER_DAYS = 7;

/**
 * Conversas dos anúncios e vendas registradas nos últimos `days` dias, por vendedor.
 * Serve para lembrar quem conversou com clientes mas não registrou nenhuma venda.
 * O banco já limita as linhas ao que o usuário pode ver (vendedor: só ele; gerente: a loja).
 */
export async function loadSalesGap(days = SALES_REMINDER_DAYS) {
  const since = localDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const [metricsResult, salesResult] = await Promise.all([
    supabase.from("campaign_metrics").select("seller_id, leads").gte("metric_date", since),
    supabase.from("sales").select("seller_id").gte("sale_date", since),
  ]);
  const bySeller = new Map<string, { conversations: number; sales: number }>();
  const entry = (id: string) => {
    const current = bySeller.get(id) ?? { conversations: 0, sales: 0 };
    bySeller.set(id, current);
    return current;
  };
  for (const row of metricsResult.data ?? [])
    entry(row.seller_id).conversations += Number(row.leads ?? 0);
  for (const row of salesResult.data ?? []) entry(row.seller_id).sales += 1;
  return {
    ok: !metricsResult.error && !salesResult.error,
    bySeller,
    /** Vendedores com conversas no período e nenhuma venda registrada. */
    withoutSales: Array.from(bySeller.entries())
      .filter(([, value]) => value.conversations > 0 && value.sales === 0)
      .map(([sellerId, value]) => ({ sellerId, conversations: value.conversations })),
  };
}

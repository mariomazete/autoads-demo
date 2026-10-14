import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Pencil,
  Percent,
  Search,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  PERIOD_LABELS,
  formatDay,
  loadSales,
  notifySalesChanged,
  rangeFor,
  saleErrorMessage,
  todayLocal,
  type DateRange,
  type Sale,
  type SalePeriod,
} from "@/lib/sales";

type Scope = "store" | "all";
type Named = { id: string; name: string };
type SellerRow = { id: string; name: string; store_id: string | null };
type MetricRow = {
  seller_campaign_id: string;
  seller_id: string;
  store_id: string | null;
  leads: number;
  spend: number;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const integer = (v: number) => v.toLocaleString("pt-BR");
const rate = (sales: number, conversations: number) =>
  conversations > 0 ? `${((sales / conversations) * 100).toFixed(1).replace(".", ",")}%` : "—";

/**
 * Vendas registradas pelos vendedores.
 * scope="store": gerente, só a loja dele. scope="all": master, todas as lojas.
 * O banco (RLS) garante o recorte; o filtro de loja aqui é só visual.
 */
export function SalesReport({ scope }: { scope: Scope }) {
  const [period, setPeriod] = useState<SalePeriod>("current_month");
  const [custom, setCustom] = useState<DateRange>({
    from: rangeFor("current_month").from,
    to: todayLocal(),
  });
  const [storeFilter, setStoreFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [stores, setStores] = useState<Named[]>([]);
  const [campaignNames, setCampaignNames] = useState<Map<string, string>>(new Map());
  const [editing, setEditing] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "pending" | "verified">("all");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const range = useMemo(() => rangeFor(period, custom), [period, custom]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sessão não encontrada.");
      setLoading(false);
      return;
    }

    let myStore: string | null = null;
    if (scope === "store") {
      const { data: me } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      myStore = me?.store_id ?? null;
      if (!myStore) {
        setError("Gerente sem loja vinculada.");
        setLoading(false);
        return;
      }
    }

    const [salesResult, metricsResult, rolesResult, storesResult] = await Promise.all([
      loadSales(range),
      supabase
        .from("campaign_metrics")
        .select("seller_campaign_id, seller_id, store_id, leads, spend")
        .gte("metric_date", range.from)
        .lte("metric_date", range.to),
      supabase.from("user_roles").select("user_id").eq("role", "VENDEDOR"),
      scope === "all"
        ? supabase.from("stores").select("id, name").order("name")
        : supabase.from("stores").select("id, name").eq("id", myStore!),
    ]);
    const firstError = salesResult.error || metricsResult.error || storesResult.error;
    if (firstError) setError(firstError.message);

    const saleRows = (salesResult.data ?? []) as Sale[];
    const metricRows = (metricsResult.data ?? []).map((row) => ({
      seller_campaign_id: row.seller_campaign_id,
      seller_id: row.seller_id,
      store_id: row.store_id,
      leads: Number(row.leads ?? 0),
      spend: Number(row.spend ?? 0),
    }));

    // Vendedores: todos os da loja (gerente) ou todos (master), mais quem aparecer nos dados.
    const sellerIds = new Set<string>((rolesResult.data ?? []).map((row) => row.user_id));
    saleRows.forEach((sale) => sellerIds.add(sale.seller_id));
    metricRows.forEach((row) => sellerIds.add(row.seller_id));
    let sellerRows: SellerRow[] = [];
    if (sellerIds.size) {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, store_id")
        .in("id", Array.from(sellerIds));
      if (myStore) query = query.eq("store_id", myStore);
      const { data } = await query;
      sellerRows = (data ?? []).map((row) => ({
        id: row.id,
        name: row.full_name || row.email || "Sem nome",
        store_id: row.store_id,
      }));
    }

    const campaignIds = new Set<string>();
    saleRows.forEach((sale) => campaignIds.add(sale.seller_campaign_id));
    metricRows.forEach((row) => campaignIds.add(row.seller_campaign_id));
    const names = new Map<string, string>();
    if (campaignIds.size) {
      const { data } = await supabase
        .from("seller_campaigns")
        .select("id, name")
        .in("id", Array.from(campaignIds));
      for (const row of data ?? []) names.set(row.id, row.name);
    }

    setSales(saleRows);
    setMetrics(metricRows);
    setSellers(sellerRows);
    setStores((storesResult.data ?? []) as Named[]);
    setCampaignNames(names);
    setLoading(false);
  }, [range, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const inStore = useCallback(
    (storeId: string | null) =>
      scope === "store" || storeFilter === "all" || storeId === storeFilter,
    [scope, storeFilter],
  );
  const visibleSales = useMemo(
    () => sales.filter((sale) => inStore(sale.store_id)),
    [sales, inStore],
  );
  const visibleMetrics = useMemo(
    () => metrics.filter((row) => inStore(row.store_id)),
    [metrics, inStore],
  );
  const sellerName = (id: string) => sellers.find((seller) => seller.id === id)?.name ?? "Vendedor";
  const storeName = (id: string | null) => stores.find((store) => store.id === id)?.name ?? "Loja";
  const campaignName = (id: string) => campaignNames.get(id) ?? "Campanha";

  const totals = useMemo(() => {
    const conversations = visibleMetrics.reduce((sum, row) => sum + row.leads, 0);
    const spend = visibleMetrics.reduce((sum, row) => sum + row.spend, 0);
    const verified = visibleSales.filter((sale) => sale.verified_at).length;
    return { sales: visibleSales.length, verified, conversations, spend };
  }, [visibleSales, visibleMetrics]);

  // Lista com busca pelo número da proposta e filtro de conferência.
  const listedSales = useMemo(() => {
    const term = search.trim().toUpperCase();
    return visibleSales.filter(
      (sale) =>
        (listFilter === "all" ||
          (listFilter === "pending" ? !sale.verified_at : Boolean(sale.verified_at))) &&
        (!term || sale.proposal_number.toUpperCase().includes(term)),
    );
  }, [visibleSales, search, listFilter]);

  async function toggleVerified(sale: Sale) {
    setVerifyingId(sale.id);
    setError("");
    setNotice("");
    // O banco registra quem conferiu e quando; aqui só marcamos ou desmarcamos.
    const { data, error: updateError } = await supabase
      .from("sales")
      .update({ verified_at: sale.verified_at ? null : new Date().toISOString() })
      .eq("id", sale.id)
      .select("verified_at");
    setVerifyingId(null);
    if (updateError || !data?.length) {
      setError(
        updateError
          ? saleErrorMessage(updateError)
          : "Você não tem permissão para conferir esta venda.",
      );
      return;
    }
    const verifiedAt = data[0].verified_at;
    setSales((current) =>
      current.map((row) => (row.id === sale.id ? { ...row, verified_at: verifiedAt } : row)),
    );
    setNotice(
      verifiedAt
        ? `Proposta ${sale.proposal_number} conferida.`
        : `Conferência da proposta ${sale.proposal_number} desfeita.`,
    );
    notifySalesChanged();
  }

  const bySeller = useMemo(() => {
    const rows = new Map<
      string,
      {
        id: string;
        name: string;
        store_id: string | null;
        sales: number;
        conversations: number;
        spend: number;
      }
    >();
    for (const seller of sellers) {
      if (inStore(seller.store_id))
        rows.set(seller.id, { ...seller, sales: 0, conversations: 0, spend: 0 });
    }
    const ensure = (id: string, storeId: string | null) => {
      const current = rows.get(id) ?? {
        id,
        name: sellerName(id),
        store_id: storeId,
        sales: 0,
        conversations: 0,
        spend: 0,
      };
      rows.set(id, current);
      return current;
    };
    visibleSales.forEach((sale) => (ensure(sale.seller_id, sale.store_id).sales += 1));
    visibleMetrics.forEach((row) => {
      const target = ensure(row.seller_id, row.store_id);
      target.conversations += row.leads;
      target.spend += row.spend;
    });
    return Array.from(rows.values()).sort(
      (a, b) =>
        b.sales - a.sales ||
        b.conversations - a.conversations ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellers, visibleSales, visibleMetrics, inStore]);

  const byCampaign = useMemo(() => {
    const rows = new Map<
      string,
      { id: string; seller_id: string; sales: number; conversations: number; spend: number }
    >();
    const ensure = (id: string, sellerId: string) => {
      const current = rows.get(id) ?? {
        id,
        seller_id: sellerId,
        sales: 0,
        conversations: 0,
        spend: 0,
      };
      rows.set(id, current);
      return current;
    };
    visibleSales.forEach((sale) => (ensure(sale.seller_campaign_id, sale.seller_id).sales += 1));
    visibleMetrics.forEach((row) => {
      const target = ensure(row.seller_campaign_id, row.seller_id);
      target.conversations += row.leads;
      target.spend += row.spend;
    });
    return Array.from(rows.values())
      .filter((row) => row.sales > 0 || row.conversations > 0)
      .sort((a, b) => b.sales - a.sales || b.conversations - a.conversations);
  }, [visibleSales, visibleMetrics]);

  const byStore = useMemo(() => {
    if (scope !== "all") return [];
    return stores
      .map((store) => {
        const storeSales = sales.filter((sale) => sale.store_id === store.id).length;
        const storeMetrics = metrics.filter((row) => row.store_id === store.id);
        return {
          ...store,
          sales: storeSales,
          conversations: storeMetrics.reduce((sum, row) => sum + row.leads, 0),
          spend: storeMetrics.reduce((sum, row) => sum + row.spend, 0),
        };
      })
      .filter((store) => store.sales > 0 || store.conversations > 0)
      .sort((a, b) => b.sales - a.sales || b.conversations - a.conversations);
  }, [scope, stores, sales, metrics]);

  async function confirmDelete() {
    if (!deleting) return;
    const { data, error: deleteError } = await supabase
      .from("sales")
      .delete()
      .eq("id", deleting.id)
      .select("id");
    setDeleting(null);
    if (deleteError || !data?.length) {
      setError(deleteError ? saleErrorMessage(deleteError) : "Não foi possível excluir a venda.");
      return;
    }
    setNotice("Venda excluída.");
    notifySalesChanged();
    void load();
  }

  const periodText =
    period === "custom"
      ? `${formatDay(range.from)} a ${formatDay(range.to)}`
      : PERIOD_LABELS[period].toLowerCase();

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {scope === "all" ? "Todas as lojas" : "Minha loja"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Vendas registradas</h2>
          <p className="text-sm text-muted-foreground">
            Vendas que os vendedores informaram como vindas dos anúncios.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {scope === "all" && stores.length > 1 ? (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={period} onValueChange={(value) => setPeriod(value as SalePeriod)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as SalePeriod[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PERIOD_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === "custom" ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="De"
                className="w-[150px]"
                value={custom.from}
                max={todayLocal()}
                onChange={(event) =>
                  setCustom((current) => ({ ...current, from: event.target.value }))
                }
              />
              <span className="text-sm text-muted-foreground">a</span>
              <Input
                type="date"
                aria-label="Até"
                className="w-[150px]"
                value={custom.to}
                max={todayLocal()}
                onChange={(event) =>
                  setCustom((current) => ({ ...current, to: event.target.value }))
                }
              />
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <p className="text-sm font-medium text-primary" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando vendas...
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={BadgeCheck}
              label="Vendas"
              value={integer(totals.sales)}
              hint={`${periodText} · ${totals.verified} conferida(s), ${totals.sales - totals.verified} aguardando`}
            />
            <Kpi
              icon={MessageCircle}
              label="Conversas iniciadas"
              value={integer(totals.conversations)}
              hint="Dos anúncios, no período"
            />
            <Kpi
              icon={Percent}
              label="Conversão"
              value={rate(totals.sales, totals.conversations)}
              hint="Vendas ÷ conversas"
            />
            <Kpi
              icon={Wallet}
              label="Custo por venda"
              value={totals.sales ? money(totals.spend / totals.sales) : "—"}
              hint={`Investimento de ${money(totals.spend)}`}
            />
          </section>

          {scope === "all" && storeFilter === "all" ? (
            <Card>
              <CardHeader>
                <CardTitle>Por loja</CardTitle>
                <CardDescription>Resultado de cada loja no período.</CardDescription>
              </CardHeader>
              <CardContent>
                {byStore.length ? (
                  <ResultTable
                    head={["Loja", "Vendas", "Conversas", "Conversão", "Custo por venda"]}
                    rows={byStore.map((store) => [
                      <span key="n" className="font-medium">
                        {store.name}
                      </span>,
                      <span key="s" className="font-semibold">
                        {integer(store.sales)}
                      </span>,
                      integer(store.conversations),
                      rate(store.sales, store.conversations),
                      store.sales ? money(store.spend / store.sales) : "—",
                    ])}
                  />
                ) : (
                  <Empty text="Nenhuma loja com vendas ou conversas no período." />
                )}
              </CardContent>
            </Card>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por vendedor</CardTitle>
                <CardDescription>
                  Cada vendedor vê só as próprias vendas. Aqui aparecem todos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bySeller.length ? (
                  <ResultTable
                    head={["Vendedor", "Vendas", "Conversas", "Conversão"]}
                    rows={bySeller.map((seller) => [
                      <div key="n">
                        <p className="font-medium">{seller.name}</p>
                        {scope === "all" ? (
                          <p className="text-xs text-muted-foreground">
                            {storeName(seller.store_id)}
                          </p>
                        ) : null}
                      </div>,
                      <span key="s" className="font-semibold">
                        {integer(seller.sales)}
                      </span>,
                      integer(seller.conversations),
                      rate(seller.sales, seller.conversations),
                    ])}
                  />
                ) : (
                  <Empty text="Nenhum vendedor encontrado." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por campanha</CardTitle>
                <CardDescription>Quais anúncios viram venda, não só conversa.</CardDescription>
              </CardHeader>
              <CardContent>
                {byCampaign.length ? (
                  <ResultTable
                    head={["Campanha", "Vendas", "Conversas", "Conversão"]}
                    rows={byCampaign.map((campaign) => [
                      <div key="n">
                        <p className="font-medium">{campaignName(campaign.id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {sellerName(campaign.seller_id)}
                        </p>
                      </div>,
                      <span key="s" className="font-semibold">
                        {integer(campaign.sales)}
                      </span>,
                      integer(campaign.conversations),
                      rate(campaign.sales, campaign.conversations),
                    ])}
                  />
                ) : (
                  <Empty text="Nenhuma campanha com vendas ou conversas no período." />
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Conferência das propostas</CardTitle>
              <CardDescription>
                Procure o número da proposta no sistema da concessionária e marque como conferida.
                Se algo estiver errado, corrija ou exclua o registro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar pelo número da proposta"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Select
                  value={listFilter}
                  onValueChange={(value) => setListFilter(value as typeof listFilter)}
                >
                  <SelectTrigger className="sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Aguardando conferência</SelectItem>
                    <SelectItem value="verified">Conferidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {listedSales.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-3 pr-4">Data</th>
                        <th className="pb-3 pr-4">Vendedor</th>
                        {scope === "all" ? <th className="pb-3 pr-4">Loja</th> : null}
                        <th className="pb-3 pr-4">Campanha</th>
                        <th className="pb-3 pr-4">Proposta</th>
                        <th className="pb-3 pr-4">Carro</th>
                        <th className="pb-3 pr-4">Conferência</th>
                        <th className="pb-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {listedSales.map((sale) => (
                        <tr key={sale.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            {formatDay(sale.sale_date)}
                          </td>
                          <td className="py-2.5 pr-4">{sellerName(sale.seller_id)}</td>
                          {scope === "all" ? (
                            <td className="py-2.5 pr-4">{storeName(sale.store_id)}</td>
                          ) : null}
                          <td className="py-2.5 pr-4">{campaignName(sale.seller_campaign_id)}</td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="outline">{sale.proposal_number}</Badge>
                          </td>
                          <td className="py-2.5 pr-4">{sale.vehicle_model}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            {sale.verified_at ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1.5 px-2 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                                disabled={verifyingId === sale.id}
                                onClick={() => void toggleVerified(sale)}
                                title="Desfazer conferência"
                              >
                                {verifyingId === sale.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Conferida
                                <Undo2 className="h-3.5 w-3.5 opacity-60" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={verifyingId === sale.id}
                                onClick={() => void toggleVerified(sale)}
                              >
                                {verifyingId === sale.id ? (
                                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : null}
                                Marcar conferida
                              </Button>
                            )}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Corrigir venda"
                              onClick={() => {
                                setNotice("");
                                setEditing(sale);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Excluir venda"
                              onClick={() => setDeleting(sale)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  text={
                    visibleSales.length
                      ? "Nenhuma venda encontrada com esse filtro."
                      : "Nenhuma venda registrada no período."
                  }
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <SaleFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        sale={editing}
        lockedCampaignName={
          editing
            ? `${campaignName(editing.seller_campaign_id)} · ${sellerName(editing.seller_id)}`
            : undefined
        }
        onSaved={() => {
          setNotice("Venda corrigida.");
          notifySalesChanged();
          void load();
        }}
      />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Proposta {deleting?.proposal_number} de{" "}
              {deleting ? sellerName(deleting.seller_id) : ""}. Ela deixa de contar nos resultados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BadgeCheck;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ResultTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((label, index) => (
              <th key={label} className={`pb-3 ${index ? "pr-2 text-right" : "pr-4"}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {cells.map((cell, index) => (
                <td key={index} className={`py-2.5 ${index ? "pr-2 text-right" : "pr-4"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

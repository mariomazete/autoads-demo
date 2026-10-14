import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Clock, Percent, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SALES_CHANGED_EVENT, loadSalesSummary, rangeFor } from "@/lib/sales";

type Summary = Awaited<ReturnType<typeof loadSalesSummary>>;

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Resumo das vendas do mês. Serve para vendedor, gerente e master:
 * o banco devolve só as vendas que cada um pode ver.
 */
export function SalesSummaryCard({
  title = "Vendas do mês",
  description,
  onOpen,
  openLabel = "Ver vendas",
}: {
  title?: string;
  description?: string;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setSummary(await loadSalesSummary(rangeFor("current_month")));
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SALES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh);
  }, [load]);

  const loading = summary === null;
  const pending = summary ? summary.sales - summary.verified : 0;
  const conversion =
    summary && summary.conversations > 0
      ? `${((summary.sales / summary.conversations) * 100).toFixed(1).replace(".", ",")}%`
      : "—";
  const costPerSale = summary && summary.sales > 0 ? money(summary.spend / summary.sales) : "—";

  const items = [
    {
      icon: BadgeCheck,
      label: "Vendas",
      value: summary ? String(summary.sales) : "…",
      hint: "Registradas no mês",
    },
    {
      icon: Clock,
      label: "Aguardando conferência",
      value: loading ? "…" : String(pending),
      hint: summary ? `${summary.verified} conferida(s)` : "",
      alert: pending > 0,
    },
    {
      icon: Percent,
      label: "Conversão",
      value: loading ? "…" : conversion,
      hint: "Vendas ÷ conversas",
    },
    {
      icon: Wallet,
      label: "Custo por venda",
      value: loading ? "…" : costPerSale,
      hint: "Investimento ÷ vendas",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {onOpen ? (
          <Button variant="outline" size="sm" onClick={onOpen} className="w-full sm:w-auto">
            {openLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {summary?.error ? <p className="mb-3 text-sm text-destructive">{summary.error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map(({ icon: Icon, label, value, hint, alert }) => (
            <div
              key={label}
              className={`rounded-lg border p-4 ${alert ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : ""}`}
            >
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
              {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

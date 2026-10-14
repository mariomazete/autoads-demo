import { Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RankedSeller = {
  id: string;
  full_name: string | null;
  conversations: number;
  investment: number;
  store_name?: string | null;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PLACE_STYLES = [
  "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800",
  "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700",
  "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800",
];

/** Top sellers of the store by WhatsApp conversations (last 30 days). */
export function SellerRanking({
  sellers,
  loading,
  description = "Vendedores que mais geraram conversas, últimos 30 dias.",
}: {
  sellers: RankedSeller[];
  loading: boolean;
  description?: string;
}) {
  const ranked = sellers
    .filter((seller) => seller.conversations > 0)
    .sort((a, b) => b.conversations - a.conversations || a.investment - b.investment)
    .slice(0, 5);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Ranking de conversas</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : ranked.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
            <p className="text-sm font-medium">Ranking vazio por enquanto</p>
            <p className="text-xs text-muted-foreground">Aparece assim que algum vendedor gerar conversas.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {ranked.map((seller, index) => (
              <li key={seller.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${
                    PLACE_STYLES[index] ?? "bg-muted text-muted-foreground ring-border"
                  }`}
                  aria-label={`${index + 1}º lugar`}
                >
                  {index + 1}º
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{seller.full_name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {seller.store_name ? `${seller.store_name} · ` : ""}
                    {seller.conversations > 0 ? `${money(seller.investment / seller.conversations)} por conversa` : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-none">{seller.conversations}</p>
                  <p className="text-[11px] text-muted-foreground">{seller.conversations === 1 ? "conversa" : "conversas"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

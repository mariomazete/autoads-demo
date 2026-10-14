import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/** Meta rejects ad sets under ~R$ 13/day on these accounts; we keep a small margin. */
export const MIN_DAILY_BUDGET = 15;

const LEVELS = [
  { key: "min", label: "Mínimo", perDay: MIN_DAILY_BUDGET, hint: "Roda, mas entrega pouco" },
  { key: "rec", label: "Recomendado", perDay: 30, hint: "Bom equilíbrio" },
  { key: "max", label: "Mais alcance", perDay: 50, hint: "Mais conversas" },
] as const;

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Budget reference for the seller: Meta's daily minimum, three quick picks for the chosen
 * duration and, when the seller has history, an estimate of conversations.
 */
export function BudgetGuide({
  mode = "period",
  budget,
  duration,
  offerEnd,
  onPick,
}: {
  /** period: budget is the total for `duration` days. continuous: budget is per day, no end date. */
  mode?: "period" | "continuous";
  budget: string;
  duration: number;
  /** Offer validity (YYYY-MM-DD); a continuous campaign stops there. */
  offerEnd?: string | null;
  onPick: (value: string) => void;
}) {
  const [costPerConversation, setCostPerConversation] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("campaign_metrics").select("spend, leads").eq("seller_id", auth.user.id);
      const spend = (data ?? []).reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
      const conversations = (data ?? []).reduce((sum, row) => sum + Number(row.leads ?? 0), 0);
      if (active && conversations > 0 && spend > 0) setCostPerConversation(spend / conversations);
    })();
    return () => {
      active = false;
    };
  }, []);

  const continuous = mode === "continuous";
  const days = continuous ? 1 : Math.max(1, duration || 1);
  const total = Number(budget.replace(",", "."));
  const hasValue = Number.isFinite(total) && total > 0;
  const perDay = hasValue ? total / days : 0;
  const belowMin = hasValue && perDay < MIN_DAILY_BUDGET;
  const estimate = hasValue && costPerConversation ? Math.floor(total / costPerConversation) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p>
          A Meta só veicula anúncios a partir de <strong className="text-foreground">{money(MIN_DAILY_BUDGET)} por dia</strong>.
          Abaixo disso a campanha é recusada.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((level) => {
          const value = level.perDay * days;
          const active = hasValue && Math.abs(total - value) < 0.01;
          return (
            <button
              key={level.key}
              type="button"
              onClick={() => onPick(String(value))}
              className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                active ? "border-primary bg-primary/10" : "hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <p className="text-[11px] font-medium text-muted-foreground">{level.label}</p>
              <p className="text-sm font-bold">
                {money(value)}
                {continuous ? <span className="text-[11px] font-medium text-muted-foreground">/dia</span> : null}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {continuous ? level.hint : `${money(level.perDay)}/dia · ${level.hint}`}
              </p>
            </button>
          );
        })}
      </div>

      {hasValue ? (
        belowMin ? (
          <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {continuous
              ? `${money(perDay)} por dia está abaixo do mínimo. Coloque pelo menos ${money(MIN_DAILY_BUDGET)} por dia.`
              : `${money(perDay)} por dia está abaixo do mínimo. Para ${days} dias, coloque pelo menos ${money(MIN_DAILY_BUDGET * days)}.`}
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {continuous ? `${money(perDay)} por dia, até você pausar ou acabar o saldo.` : `${money(perDay)} por dia durante ${days} dias.`}
              {estimate != null && costPerConversation
                ? ` Estimativa: cerca de ${estimate} ${estimate === 1 ? "conversa" : "conversas"}${continuous ? " por dia" : ""} (seu custo médio tem sido ${money(costPerConversation)} por conversa).`
                : ""}
            </span>
          </p>
        )
      ) : null}

      {continuous ? (
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            A campanha roda todos os dias até você pausar ou acabar o saldo da sua conta Meta. Exemplo: com{" "}
            {money(60)} de saldo e {money(hasValue && !belowMin ? perDay : 30)} por dia, ela roda cerca de{" "}
            {Math.max(1, Math.floor(60 / (hasValue && !belowMin ? perDay : 30)))} dia(s).
          </p>
          {offerEnd ? (
            <p>Ela também para sozinha quando a oferta vencer ({new Date(`${offerEnd}T12:00:00`).toLocaleDateString("pt-BR")}).</p>
          ) : null}
          <p className="font-medium text-foreground/80">
            Se sua conta Meta paga com cartão de crédito, não existe saldo para acabar: a campanha só para quando você pausar.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          O valor é cobrado pela Meta conforme o anúncio roda. Sua conta de anúncios precisa ter saldo para cobrir o orçamento.
        </p>
      )}
    </div>
  );
}

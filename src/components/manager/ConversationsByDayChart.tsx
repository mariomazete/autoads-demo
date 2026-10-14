import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MessageCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Day = { date: string; conversations: number; spend: number };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = (value: string) => {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
};
const longDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

function DayTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Day }> }) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium capitalize">{longDate(day.date)}</p>
      <p className="mt-1 text-foreground">
        <span className="font-semibold">{day.conversations}</span> {day.conversations === 1 ? "conversa" : "conversas"}
      </p>
      <p className="text-muted-foreground">Investimento: {money(day.spend)}</p>
    </div>
  );
}

/** Daily WhatsApp conversations started by the store's ads (single series). */
export function ConversationsByDayChart({
  daily,
  loading,
  description = "Conversas iniciadas no WhatsApp pelos anúncios da loja, últimos 30 dias.",
}: {
  daily: Day[];
  loading: boolean;
  description?: string;
}) {
  const total = daily.reduce((sum, day) => sum + day.conversations, 0);
  const best = daily.reduce<Day | null>((top, day) => (!top || day.conversations > top.conversations ? day : top), null);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />Conversas por dia</CardTitle>
          {!loading && total > 0 ? (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {total} {total === 1 ? "conversa" : "conversas"}
              {best && best.conversations > 0 ? ` · melhor dia ${shortDate(best.date)}` : ""}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Carregando resultados da Meta...</div>
        ) : total === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
            <p className="text-sm font-medium">Nenhuma conversa nos últimos 30 dias</p>
            <p className="text-xs text-muted-foreground">Quando os anúncios gerarem conversas, elas aparecem aqui por dia.</p>
          </div>
        ) : (
          <div className="h-56" role="img" aria-label={`Conversas por dia: ${total} no total nos últimos 30 dias`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip content={<DayTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                <Bar dataKey="conversations" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

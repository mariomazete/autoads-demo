import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  MessageCircle,
  MousePointerClick,
  Radio,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SALES_CHANGED_EVENT } from "@/lib/sales";

type Running = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  daily_budget: number | null;
  meta_delivery_status: string | null;
  totals: { spend: number; impressions: number; clicks: number; conversations: number };
  sales: number;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const integer = (v: number) => v.toLocaleString("pt-BR");
const shortDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

const DELIVERY: Record<
  string,
  { label: string; tone: "default" | "secondary" | "outline" | "destructive" }
> = {
  delivering: { label: "Veiculando", tone: "default" },
  in_review: { label: "Em análise", tone: "outline" },
  approved: { label: "Aprovado", tone: "secondary" },
  scheduled: { label: "Agendado", tone: "secondary" },
  rejected: { label: "Reprovado pela Meta", tone: "destructive" },
  with_issues: { label: "Com problemas", tone: "destructive" },
  billing: { label: "Pagamento pendente", tone: "destructive" },
};

/**
 * Resultados só da(s) campanha(s) no ar, desde a publicação de cada uma.
 * Uma campanha nova começa zerada aqui; o total de todas fica no painel geral.
 * Mesma fonte (campaign_metrics) dos demais painéis.
 */
export function CurrentCampaignPanel({ refreshKey }: { refreshKey?: string }) {
  const [running, setRunning] = useState<Running[] | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: campaigns } = await supabase
      .from("seller_campaigns")
      .select("id, name, start_date, end_date, daily_budget, meta_delivery_status")
      .eq("seller_id", auth.user.id)
      .eq("status", "active")
      .is("archived_at", null)
      .not("meta_campaign_id", "is", null)
      .order("published_at", { ascending: false });
    const now = Date.now();
    const live = (campaigns ?? []).filter(
      (c) => !c.end_date || new Date(c.end_date).getTime() > now,
    );
    if (!live.length) {
      setRunning([]);
      return;
    }
    const ids = live.map((c) => c.id);
    const [metricsResult, salesResult] = await Promise.all([
      supabase
        .from("campaign_metrics")
        .select("seller_campaign_id, spend, impressions, clicks, leads")
        .in("seller_campaign_id", ids),
      supabase.from("sales").select("seller_campaign_id").in("seller_campaign_id", ids),
    ]);
    setRunning(
      live.map((c) => {
        const rows = (metricsResult.data ?? []).filter((m) => m.seller_campaign_id === c.id);
        return {
          ...c,
          daily_budget: c.daily_budget != null ? Number(c.daily_budget) : null,
          totals: {
            spend: rows.reduce((sum, m) => sum + Number(m.spend ?? 0), 0),
            impressions: rows.reduce((sum, m) => sum + Number(m.impressions ?? 0), 0),
            clicks: rows.reduce((sum, m) => sum + Number(m.clicks ?? 0), 0),
            conversations: rows.reduce((sum, m) => sum + Number(m.leads ?? 0), 0),
          },
          sales: (salesResult.data ?? []).filter((s) => s.seller_campaign_id === c.id).length,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SALES_CHANGED_EVENT, refresh);
    window.addEventListener("autoads:campaign-created", refresh);
    return () => {
      window.removeEventListener(SALES_CHANGED_EVENT, refresh);
      window.removeEventListener("autoads:campaign-created", refresh);
    };
  }, [load, refreshKey]);

  if (running === null) return null;

  if (!running.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-5">
          <Radio className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma campanha no ar agora</p>
            <p className="text-sm text-muted-foreground">
              Quando você publicar uma campanha, os resultados dela aparecem aqui, começando do
              zero.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {running.map((campaign) => {
        const { spend, impressions, clicks, conversations } = campaign.totals;
        const delivery = campaign.meta_delivery_status
          ? DELIVERY[campaign.meta_delivery_status]
          : null;
        const days = campaign.start_date
          ? Math.max(
              1,
              Math.ceil((Date.now() - new Date(campaign.start_date).getTime()) / 86_400_000),
            )
          : null;
        const items = [
          { icon: Wallet, label: "Investimento", value: money(spend) },
          { icon: Eye, label: "Impressões", value: integer(impressions) },
          { icon: MousePointerClick, label: "Cliques", value: integer(clicks) },
          { icon: MessageCircle, label: "Conversas", value: integer(conversations) },
          {
            icon: Wallet,
            label: "Custo por conversa",
            value: conversations ? money(spend / conversations) : "—",
          },
          { icon: BadgeCheck, label: "Vendas", value: integer(campaign.sales) },
        ];
        return (
          <Card key={campaign.id} className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Radio className="h-3.5 w-3.5" />
                    Campanha no ar
                  </p>
                  <CardTitle className="mt-1 text-lg">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Desde {shortDate(campaign.start_date)}
                      {campaign.end_date ? ` · até ${shortDate(campaign.end_date)}` : ""}
                      {days ? ` · ${days} ${days === 1 ? "dia" : "dias"}` : ""}
                    </span>
                    {campaign.daily_budget ? <span>{money(campaign.daily_budget)}/dia</span> : null}
                  </CardDescription>
                </div>
                {delivery ? <Badge variant={delivery.tone}>{delivery.label}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {items.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-lg border bg-background p-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Só desta campanha, desde a publicação. O total de todas as campanhas fica no resumo
                geral abaixo.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

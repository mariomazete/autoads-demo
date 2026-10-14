import { AlertTriangle, ArrowRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";

type AlertCampaign = {
  id: string;
  name: string;
  status: string;
  end_date: string | null;
  duration_days: number | null;
  total_budget: number;
  budget_amount: number;
  spent_amount: number;
  spend: number;
};

const DAY = 24 * 60 * 60 * 1000;

const endOf = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59`) : new Date(value);

/**
 * In-app notices about campaigns that are about to stop or just stopped,
 * so the seller can publish the next one without anyone having to chase them.
 */
export function SellerCampaignAlerts({
  campaigns,
  onChooseOffer,
}: {
  campaigns: AlertCampaign[];
  onChooseOffer: () => void;
}) {
  const now = Date.now();
  const alerts: Array<{ id: string; tone: "warn" | "ended"; title: string; detail: string }> = [];

  for (const campaign of campaigns) {
    if (!["active", "finished", "paused"].includes(campaign.status) || !campaign.end_date) continue;
    const end = endOf(campaign.end_date).getTime();
    if (Number.isNaN(end)) continue;
    const left = end - now;
    const budget = campaign.total_budget || campaign.budget_amount;
    const spent = campaign.spent_amount || campaign.spend;
    // Campanha contínua não tem orçamento total: ela para quando acaba o saldo da conta Meta.
    const budgetGone = campaign.duration_days != null && budget > 0 && spent >= budget * 0.98;

    if (campaign.status === "active" && left > 0 && left <= DAY && !budgetGone) {
      const hours = Math.max(1, Math.round(left / (60 * 60 * 1000)));
      alerts.push({
        id: campaign.id,
        tone: "warn",
        title: `"${campaign.name}" termina em ${hours} ${hours === 1 ? "hora" : "horas"}`,
        detail: "Já deixe a próxima oferta escolhida para não ficar sem anúncio no ar.",
      });
    } else if ((left <= 0 && now - end <= 3 * DAY) || (campaign.status === "active" && budgetGone)) {
      alerts.push({
        id: campaign.id,
        tone: "ended",
        title: `"${campaign.name}" ${budgetGone && left > 0 ? "usou todo o orçamento" : "terminou"}`,
        detail: "Seus anúncios pararam de gerar conversas. Escolha uma oferta para publicar de novo.",
      });
    }
  }

  // Se já existe outra campanha ativa e com prazo, o aviso de "terminou" perde o sentido.
  const hasRunning = campaigns.some((campaign) => {
    if (campaign.status !== "active") return false;
    if (!campaign.end_date) return campaign.duration_days == null;
    const left = endOf(campaign.end_date).getTime() - now;
    return left > DAY;
  });
  const visible = hasRunning ? alerts.filter((alert) => alert.tone === "warn") : alerts;
  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            alert.tone === "warn"
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            {alert.tone === "warn" ? <Clock className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="text-sm font-semibold">{alert.title}</p>
              <p className="text-xs opacity-80">{alert.detail}</p>
            </div>
          </div>
          <Button size="sm" variant={alert.tone === "warn" ? "outline" : "default"} className="shrink-0 rounded-full" onClick={onChooseOffer}>
            Escolher oferta <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

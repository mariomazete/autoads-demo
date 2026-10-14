import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { saleErrorMessage, todayLocal, type Sale } from "@/lib/sales";

export type SaleCampaignOption = { id: string; name: string; model: string | null; status: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Campanhas que podem ser escolhidas. Sem lista, a campanha da venda não pode ser trocada. */
  campaigns?: SaleCampaignOption[];
  /** Venda sendo corrigida. Sem ela, o formulário registra uma venda nova. */
  sale?: Sale | null;
  /** Nome da campanha quando ela não pode ser trocada (correção pelo gerente/master). */
  lockedCampaignName?: string;
  onSaved: () => void;
};

const STATUS_HINT: Record<string, string> = {
  active: "ativa",
  paused: "pausada",
  finished: "encerrada",
  error: "com erro",
  pending: "em publicação",
  draft: "rascunho",
};

export function SaleFormDialog({
  open,
  onOpenChange,
  campaigns,
  sale,
  lockedCampaignName,
  onSaved,
}: Props) {
  const [campaignId, setCampaignId] = useState("");
  const [proposal, setProposal] = useState("");
  const [model, setModel] = useState("");
  const [modelTouched, setModelTouched] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    setCampaignId(sale?.seller_campaign_id ?? "");
    setProposal(sale?.proposal_number ?? "");
    setModel(sale?.vehicle_model ?? "");
    setModelTouched(Boolean(sale));
    setDate(sale?.sale_date ?? todayLocal());
  }, [open, sale]);

  function chooseCampaign(id: string) {
    setCampaignId(id);
    // Sugere o modelo da campanha enquanto o vendedor não tiver digitado outro.
    const suggested = campaigns?.find((campaign) => campaign.id === id)?.model;
    if (suggested && (!modelTouched || !model.trim())) setModel(suggested);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!campaignId) return setError("Escolha a campanha de onde veio o cliente.");
    if (!proposal.trim()) return setError("Informe o número da proposta.");
    if (!model.trim()) return setError("Informe o carro vendido.");
    if (!date) return setError("Informe a data da venda.");
    if (date > todayLocal()) return setError("A data da venda não pode ser no futuro.");

    setSaving(true);
    const values = {
      seller_campaign_id: campaignId,
      proposal_number: proposal.trim(),
      vehicle_model: model.trim(),
      sale_date: date,
    };
    let result;
    if (sale) {
      result = await supabase.from("sales").update(values).eq("id", sale.id).select("id");
    } else {
      // Vendedor, loja e grupo são preenchidos pelo banco a partir do perfil de quem está logado.
      result = await supabase.from("sales").insert(values).select("id");
    }
    setSaving(false);
    if (result.error) return setError(saleErrorMessage(result.error));
    if (!result.data?.length) return setError("Você não tem permissão para alterar esta venda.");
    onOpenChange(false);
    onSaved();
  }

  const canPickCampaign = Boolean(campaigns);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sale ? "Corrigir venda" : "Registrar venda"}</DialogTitle>
          <DialogDescription>
            {sale
              ? "Ajuste os dados da venda."
              : "Informe a venda de um cliente que veio de um anúncio do AutoAds."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Campanha</Label>
            {canPickCampaign ? (
              campaigns!.length ? (
                <Select value={campaignId} onValueChange={chooseCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="De qual anúncio veio o cliente?" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns!.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                        {STATUS_HINT[campaign.status] ? ` · ${STATUS_HINT[campaign.status]}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Você ainda não publicou nenhuma campanha. Publique um anúncio para poder registrar
                  vendas.
                </p>
              )
            ) : (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {lockedCampaignName || "Campanha da venda"}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-proposal">Número da proposta</Label>
            <Input
              id="sale-proposal"
              value={proposal}
              onChange={(event) => setProposal(event.target.value)}
              placeholder="Ex.: 48213"
              autoComplete="off"
              maxLength={40}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-model">Carro vendido</Label>
            <Input
              id="sale-model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setModelTouched(true);
              }}
              placeholder="Ex.: Compass Longitude"
              autoComplete="off"
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-date">Data da venda</Label>
            <Input
              id="sale-date"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {sale?.verified_at && canPickCampaign ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Esta venda já foi conferida pelo gerente. Se você alterar algum dado, ela volta para
              "aguardando conferência".
            </p>
          ) : null}
          {error ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || (canPickCampaign && !campaigns!.length)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sale ? "Salvar correção" : "Registrar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SaleFormDialog, type SaleCampaignOption } from "@/components/sales/SaleFormDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  SALES_CHANGED_EVENT,
  SALES_REMINDER_DAYS,
  formatDay,
  loadSales,
  loadSalesGap,
  notifySalesChanged,
  rangeFor,
  saleErrorMessage,
  type Sale,
} from "@/lib/sales";

const DAY_MS = 24 * 60 * 60 * 1000;
const reminderKey = (userId: string) => `autoads:lembrete-venda:${userId}`;

// "Não vendi" esconde o lembrete por 7 dias, só neste aparelho. Sem acesso ao armazenamento,
// o lembrete simplesmente continua aparecendo.
function reminderDismissed(userId: string) {
  try {
    const at = Number(window.localStorage.getItem(reminderKey(userId)) ?? 0);
    return at > 0 && Date.now() - at < SALES_REMINDER_DAYS * DAY_MS;
  } catch {
    return false;
  }
}
function dismissReminder(userId: string) {
  try {
    window.localStorage.setItem(reminderKey(userId), String(Date.now()));
  } catch {
    /* sem armazenamento: o lembrete volta na próxima visita */
  }
}

/**
 * Vendas do próprio vendedor. No modo compacto (Início) mostra só o botão e o total do mês;
 * no modo completo (aba Vendas) mostra também a lista com correção e exclusão.
 */
export function SellerSales({ compact = false }: { compact?: boolean }) {
  const [campaigns, setCampaigns] = useState<SaleCampaignOption[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  // Lembrete: conversas nos últimos 7 dias sem nenhuma venda registrada.
  const [reminder, setReminder] = useState<{ conversations: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoading(false);
      return;
    }
    // Lista das vendas: os últimos 12 meses bastam para a tela do vendedor.
    const now = new Date();
    const from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const range = { from: rangeFor("current_month").from, to: rangeFor("current_month").to };
    const listRange = {
      from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
      to: range.to,
    };

    setUserId(auth.user.id);
    const [campaignResult, salesResult, gap] = await Promise.all([
      supabase
        .from("seller_campaigns")
        .select("id, name, status, template_id, published_at, created_at")
        .eq("seller_id", auth.user.id)
        .not("published_at", "is", null)
        .order("created_at", { ascending: false }),
      loadSales(listRange),
      loadSalesGap(),
    ]);
    const mine = gap.bySeller.get(auth.user.id);
    setReminder(
      gap.ok &&
        mine &&
        mine.conversations > 0 &&
        mine.sales === 0 &&
        !reminderDismissed(auth.user.id)
        ? { conversations: mine.conversations }
        : null,
    );
    if (campaignResult.error) setError(campaignResult.error.message);
    if (salesResult.error) setError(salesResult.error.message);

    const rows = campaignResult.data ?? [];
    const templateIds = Array.from(
      new Set(rows.map((row) => row.template_id).filter(Boolean)),
    ) as string[];
    const models = new Map<string, string | null>();
    if (templateIds.length) {
      const { data: templates } = await supabase
        .from("campaign_templates")
        .select("id, model")
        .in("id", templateIds);
      for (const template of templates ?? []) models.set(template.id, template.model);
    }
    setCampaigns(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        model: row.template_id ? (models.get(row.template_id) ?? null) : null,
      })),
    );
    setSales((salesResult.data ?? []) as Sale[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Mantém Início, Vendas e Resultados iguais quando uma venda muda em outra parte da tela.
    const refresh = () => void load();
    window.addEventListener(SALES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh);
  }, [load]);

  const month = rangeFor("current_month");
  const monthCount = useMemo(
    () => sales.filter((sale) => sale.sale_date >= month.from && sale.sale_date <= month.to).length,
    [sales, month.from, month.to],
  );
  // Campanhas antigas (já sem publicação) continuam aparecendo na lista das vendas.
  const campaignName = (id: string) =>
    campaigns.find((campaign) => campaign.id === id)?.name ?? "Campanha";

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
  }

  function openNew() {
    setEditing(null);
    setNotice("");
    setFormOpen(true);
  }

  const dialogs = (
    <>
      <SaleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        campaigns={campaigns}
        sale={editing}
        onSaved={() => {
          setNotice(editing ? "Venda corrigida." : "Venda registrada. Parabéns!");
          notifySalesChanged();
        }}
      />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Proposta {deleting?.proposal_number} · {deleting?.vehicle_model}. Ela deixa de contar
              nos resultados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const reminderCard = reminder ? (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">
            Você teve {reminder.conversations}{" "}
            {reminder.conversations === 1 ? "conversa" : "conversas"} nos últimos{" "}
            {SALES_REMINDER_DAYS} dias e nenhuma venda registrada.
          </p>
          <p className="text-sm opacity-80">
            Algum desses clientes comprou? Registre para contar nos resultados.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={openNew}>
          Registrar venda
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (userId) dismissReminder(userId);
            setReminder(null);
          }}
        >
          Não vendi
        </Button>
      </div>
    </div>
  ) : null;

  if (compact) {
    return (
      <div className="space-y-3">
        {reminderCard}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Minhas vendas no mês</p>
                <p className="text-2xl font-semibold leading-tight">{loading ? "…" : monthCount}</p>
                {notice ? <p className="text-xs font-medium text-primary">{notice}</p> : null}
              </div>
            </div>
            <Button size="lg" className="w-full sm:w-auto" onClick={openNew} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar venda
            </Button>
          </CardContent>
          {dialogs}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reminderCard}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Vendas no mês</p>
            <p className="text-3xl font-semibold">{loading ? "…" : monthCount}</p>
          </div>
          <Button size="lg" className="w-full sm:w-auto" onClick={openNew} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar venda
          </Button>
        </CardContent>
      </Card>
      {notice ? (
        <p className="text-sm font-medium text-primary" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Minhas vendas</CardTitle>
          <CardDescription>
            Só você, o gerente da loja e o master veem estas vendas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando vendas...
            </div>
          ) : sales.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma venda registrada ainda. Quando um cliente do anúncio comprar, toque em
              "Registrar venda".
            </p>
          ) : (
            <ul className="divide-y">
              {sales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{sale.vehicle_model}</p>
                      {sale.verified_at ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Conferida</Badge>
                      ) : (
                        <Badge variant="outline">Aguardando conferência</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDay(sale.sale_date)} · Proposta {sale.proposal_number} ·{" "}
                      {campaignName(sale.seller_campaign_id)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Corrigir venda"
                      onClick={() => {
                        setEditing(sale);
                        setNotice("");
                        setFormOpen(true);
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {dialogs}
    </div>
  );
}

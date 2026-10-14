import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

type AdRow = { id: string; seller_id: string; status: string; sellerName: string };
type Result = { ok: boolean; message: string };

/**
 * Depois de editar uma oferta: atualiza os anúncios já publicados que usam essa oferta
 * (fotos, texto e validade) na mesma campanha da Meta, sem mudar o público.
 * O banco limita a lista ao que o usuário pode ver (master: todos; gerente: a loja).
 */
export function OfferAdsUpdater({
  templateId,
  onClose,
}: {
  templateId: string;
  onClose?: () => void;
}) {
  const [rows, setRows] = useState<AdRow[] | null>(null);
  const [activate, setActivate] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("seller_campaigns")
      .select("id, seller_id, status")
      .eq("template_id", templateId)
      .is("archived_at", null)
      .not("meta_ad_id", "is", null)
      .in("status", ["active", "paused", "finished"]);
    const list = data ?? [];
    const ids = Array.from(new Set(list.map((row) => row.seller_id)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const person of people ?? []) names.set(person.id, person.full_name || "Vendedor");
    }
    setRows(list.map((row) => ({ ...row, sellerName: names.get(row.seller_id) ?? "Vendedor" })));
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run() {
    if (!rows?.length) return;
    setRunning(true);
    setResults({});
    for (const row of rows) {
      const { data, error } = await supabase.functions.invoke("meta-update-seller-campaign-v1", {
        body: { campaign_id: row.id, activate },
      });
      const ok = !error && Boolean(data?.success);
      const message = ok
        ? activate
          ? "Atualizado e reativado. A Meta vai revisar o anúncio."
          : "Atualizado. A Meta vai revisar o anúncio."
        : data?.error || error?.message || "Não foi possível atualizar.";
      setResults((current) => ({ ...current, [row.id]: { ok, message } }));
    }
    setRunning(false);
  }

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Procurando anúncios que usam esta oferta...
      </div>
    );
  }

  if (!rows.length) return null;

  const done = Object.keys(results).length === rows.length && !running;
  const failures = Object.values(results).filter((result) => !result.ok).length;

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <p className="font-medium">
          {rows.length} {rows.length === 1 ? "anúncio usa" : "anúncios usam"} esta oferta
        </p>
        <p className="text-sm text-muted-foreground">
          Publicar as alterações troca a foto e o texto desses anúncios na Meta e estende a data de
          fim até a validade da oferta. O anúncio usa a primeira foto da oferta. O orçamento de cada
          vendedor continua o mesmo, e o público é o fixo de sempre: raio da loja, idade e
          interesses da campanha. A Meta revisa o anúncio de novo, o que costuma levar de minutos a
          algumas horas.
        </p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const result = results[row.id];
          return (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.sellerName}</p>
                <p
                  className={`text-xs ${result ? (result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive") : "text-muted-foreground"}`}
                >
                  {result
                    ? result.message
                    : row.status === "active"
                      ? "No ar"
                      : "Pausado / encerrado"}
                </p>
              </div>
              {result ? (
                result.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )
              ) : running ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </li>
          );
        })}
      </ul>
      {!done ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={activate}
              onCheckedChange={(value) => setActivate(value === true)}
              disabled={running}
            />
            Reativar os anúncios pausados ou encerrados
          </label>
          <div className="flex gap-2">
            {onClose ? (
              <Button type="button" variant="outline" onClick={onClose} disabled={running}>
                Agora não
              </Button>
            ) : null}
            <Button type="button" onClick={() => void run()} disabled={running}>
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Publicar alterações nos anúncios
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {failures
              ? `${rows.length - failures} atualizado(s), ${failures} com erro.`
              : "Todos os anúncios foram atualizados."}
          </p>
          {onClose ? (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isReady, loadMySellerReadiness, readinessChecks, type SellerReadiness } from "@/lib/sellerReadiness";

const HINTS: Record<string, string> = {
  whatsapp: "É para onde vão as conversas dos anúncios. Peça ao seu gerente para cadastrar.",
  meta: "Conecte sua conta do Facebook na aba Meta Ads.",
  account: "Sua conta Meta precisa ter uma conta de anúncios ativa.",
  page: "Você precisa de uma Página do Facebook com o seu WhatsApp vinculado.",
};

/**
 * What the seller still has to do before publishing, step by step.
 * Shows a full checklist while something is missing and a small "all set" line when ready.
 */
export function SellerReadinessChecklist({
  refreshKey,
  onGoToMeta,
  hideWhenReady = false,
}: {
  /** Hide the green "all set" line (used outside the Meta Ads tab). */
  hideWhenReady?: boolean;
  /** Changes when the Meta connection changes, to reload the checklist. */
  refreshKey: string;
  /** Omit when already on the Meta Ads tab. */
  onGoToMeta?: () => void;
}) {
  const [readiness, setReadiness] = useState<SellerReadiness | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadMySellerReadiness().then((data) => {
      if (!active) return;
      setReadiness(data);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!loaded || !readiness) return null;

  const checks = readinessChecks(readiness);
  const done = checks.filter((check) => check.ok).length;
  const nextStep = checks.find((check) => !check.ok);

  if (isReady(readiness)) {
    if (hideWhenReady) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>Tudo pronto para publicar.</strong> WhatsApp, Meta, conta de anúncios e página
          {readiness.page_name ? ` (${readiness.page_name})` : ""} conectados.
        </span>
      </div>
    );
  }

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-amber-600" />
            Falta pouco para você publicar
          </CardTitle>
          <span className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold ring-1 ring-amber-300 dark:ring-amber-800">
            {done} de {checks.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-900/50">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(done / checks.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map((check, index) => {
            const isNext = check.key === nextStep?.key;
            return (
              <li
                key={check.key}
                className={`flex items-start gap-2.5 rounded-lg border bg-background px-3 py-2.5 ${isNext ? "border-amber-400 ring-1 ring-amber-300 dark:ring-amber-800" : ""}`}
              >
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${isNext ? "text-amber-600" : "text-muted-foreground"}`} />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${check.ok ? "text-muted-foreground line-through" : ""}`}>
                    {index + 1}. {check.label}
                  </p>
                  {!check.ok ? <p className="mt-0.5 text-xs text-muted-foreground">{HINTS[check.key]}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
        {nextStep && nextStep.key !== "whatsapp" && onGoToMeta ? (
          <Button size="sm" className="rounded-full" onClick={onGoToMeta}>
            Resolver agora <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : readiness.meta_error ? (
          <p className="text-xs text-destructive">{readiness.meta_error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

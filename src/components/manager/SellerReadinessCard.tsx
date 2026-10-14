import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, Rocket, Search, Store } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isReady, readinessChecks, type SellerReadiness } from "@/lib/sellerReadiness";

type StatusFilter = "all" | "pending" | "ready";

const STEPS = [
  { key: "whatsapp", label: "WhatsApp", next: "cadastrar o WhatsApp do vendedor" },
  { key: "meta", label: "Meta conectada", next: "o vendedor conectar a Meta no AutoAds" },
  { key: "account", label: "Conta de anúncios", next: "ter uma conta de anúncios ativa na Meta" },
  { key: "page", label: "Página do Facebook", next: "ter uma Página do Facebook com o WhatsApp vinculado" },
] as const;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** First missing step of a seller (the step they are stuck on), or null when ready. */
const stuckOn = (seller: SellerReadiness) => readinessChecks(seller).find((check) => !check.ok)?.key ?? null;

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function SellerRow({ seller, showStore }: { seller: SellerReadiness; showStore: boolean }) {
  const checks = readinessChecks(seller);
  const ready = checks.every((check) => check.ok);
  const next = STEPS.find((step) => step.key === stuckOn(seller));
  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1.6fr)] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{seller.full_name || "Sem nome"}</p>
        {showStore && seller.store_name ? <p className="truncate text-xs text-muted-foreground">{seller.store_name}</p> : null}
      </div>
      <ul className="flex items-center gap-1.5" aria-label="Etapas">
        {checks.map((check) => (
          <li
            key={check.key}
            title={`${check.label}: ${check.ok ? "ok" : "pendente"}`}
            className={`flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${
              check.ok
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"
            }`}
          >
            {check.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">{STEPS.find((step) => step.key === check.key)?.label}</span>
          </li>
        ))}
      </ul>
      <p className={`text-xs ${ready ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
        {ready ? (seller.page_name ? `Pronto · Página ${seller.page_name}` : "Pronto para publicar") : `Próximo passo: ${next?.next}.`}
      </p>
    </li>
  );
}

/**
 * Who can already publish on Meta and what is missing for the rest.
 * Scales to large teams: step funnel (click to filter who is stuck there),
 * search, status filter and collapsible groups per store.
 */
export function SellerReadinessCard({
  sellers,
  loading,
  description = "O que cada vendedor precisa para publicar campanhas na Meta.",
}: {
  sellers: SellerReadiness[] | null;
  loading: boolean;
  description?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [stepFilter, setStepFilter] = useState<string | null>(null);
  const [openStores, setOpenStores] = useState<Record<string, boolean>>({});

  const list = sellers ?? [];
  const readyCount = list.filter(isReady).length;
  const percent = list.length ? Math.round((readyCount / list.length) * 100) : 0;
  const multiStore = new Set(list.map((seller) => seller.store_id ?? "")).size > 1;

  // How many sellers already cleared each step (cumulative funnel) and how many are stuck on it.
  const funnel = STEPS.map((step, index) => ({
    ...step,
    done: list.filter((seller) => readinessChecks(seller).slice(0, index + 1).every((check) => check.ok)).length,
    stuck: list.filter((seller) => stuckOn(seller) === step.key).length,
  }));

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return list.filter((seller) => {
      if (stepFilter) return stuckOn(seller) === stepFilter && (!term || normalize(`${seller.full_name ?? ""} ${seller.store_name ?? ""}`).includes(term));
      if (status === "pending" && isReady(seller)) return false;
      if (status === "ready" && !isReady(seller)) return false;
      if (term && !normalize(`${seller.full_name ?? ""} ${seller.store_name ?? ""}`).includes(term)) return false;
      return true;
    });
  }, [list, query, status, stepFilter]);

  const groups = useMemo(() => {
    const byStore = new Map<string, { id: string; name: string; all: SellerReadiness[]; shown: SellerReadiness[] }>();
    for (const seller of list) {
      const id = seller.store_id ?? "sem-loja";
      const group = byStore.get(id) ?? { id, name: seller.store_name ?? "Sem loja vinculada", all: [], shown: [] };
      group.all.push(seller);
      byStore.set(id, group);
    }
    for (const seller of filtered) byStore.get(seller.store_id ?? "sem-loja")?.shown.push(seller);
    return Array.from(byStore.values())
      .filter((group) => group.shown.length > 0)
      .map((group) => ({ ...group, ready: group.all.filter(isReady).length }))
      .sort((a, b) => a.ready / a.all.length - b.ready / b.all.length || a.name.localeCompare(b.name, "pt-BR"));
  }, [list, filtered]);

  const searching = query.trim().length > 0 || stepFilter !== null;
  const isOpen = (id: string) => openStores[id] ?? (searching || groups.length === 1);
  const sortRows = (rows: SellerReadiness[]) =>
    [...rows].sort(
      (a, b) => Number(isReady(a)) - Number(isReady(b)) || (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"),
    );

  const statusButton = (value: StatusFilter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => {
        setStatus(value);
        setStepFilter(null);
      }}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        status === value && !stepFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" />Prontos para publicar</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {!loading && list.length ? (
            <div className="min-w-48">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{readyCount} de {list.length} prontos</span>
                <span className="text-xs text-muted-foreground">{percent}%</span>
              </div>
              <div className="mt-1.5"><ProgressBar value={percent} /></div>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Verificando conexões...</p>
        ) : sellers === null ? (
          <p className="py-4 text-sm text-destructive">Não foi possível verificar as conexões agora.</p>
        ) : !list.length ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum vendedor ativo.</p>
        ) : (
          <>
            {/* Funil: quantos já passaram de cada etapa; clique para ver quem está travado nela. */}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {funnel.map((step, index) => {
                const active = stepFilter === step.key;
                const stepPercent = Math.round((step.done / list.length) * 100);
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setStepFilter(active ? null : step.key)}
                    aria-pressed={active}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40" : "hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{index + 1}. {step.label}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {step.done}<span className="text-sm font-normal text-muted-foreground"> / {list.length}</span>
                    </p>
                    <div className="mt-1.5"><ProgressBar value={stepPercent} /></div>
                    <p className={`mt-1.5 text-xs ${step.stuck ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                      {step.stuck ? `${step.stuck} ${step.stuck === 1 ? "travado" : "travados"} aqui${active ? " · filtrando" : ""}` : "Ninguém travado"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {statusButton("pending", "Pendentes", list.length - readyCount)}
                {statusButton("ready", "Prontos", readyCount)}
                {statusButton("all", "Todos", list.length)}
              </div>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={multiStore ? "Buscar vendedor ou loja" : "Buscar vendedor"}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            {stepFilter ? (
              <p className="text-xs text-muted-foreground">
                Mostrando quem está travado em <strong>{STEPS.find((step) => step.key === stepFilter)?.label}</strong>.{" "}
                <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setStepFilter(null)}>
                  Limpar filtro
                </button>
              </p>
            ) : null}

            {!filtered.length ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                {status === "pending" && !searching ? "Todos os vendedores estão prontos para publicar." : "Nenhum vendedor encontrado com esses filtros."}
              </p>
            ) : multiStore ? (
              <div className="space-y-2">
                {groups.map((group) => {
                  const open = isOpen(group.id);
                  const groupPercent = Math.round((group.ready / group.all.length) * 100);
                  return (
                    <div key={group.id} className="overflow-hidden rounded-lg border">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenStores((current) => ({ ...current, [group.id]: !open }))}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{group.name}</span>
                          {group.all.length - group.ready > 0 ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                              {group.all.length - group.ready} {group.all.length - group.ready === 1 ? "pendente" : "pendentes"}
                            </span>
                          ) : null}
                        </span>
                        <span className="hidden items-center gap-2 sm:flex">
                          <span className="flex-1"><ProgressBar value={groupPercent} /></span>
                          <span className="w-12 text-right text-xs text-muted-foreground">{group.ready}/{group.all.length}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                      {open ? (
                        <ul className="divide-y">
                          {sortRows(group.shown).map((seller) => <SellerRow key={seller.seller_id} seller={seller} showStore={false} />)}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {sortRows(filtered).map((seller) => <SellerRow key={seller.seller_id} seller={seller} showStore={false} />)}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

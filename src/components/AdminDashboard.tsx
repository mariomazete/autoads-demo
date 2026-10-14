import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Eye,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  Settings,
  ShieldCheck,
  Store,
  Target,
  Users,
  UserRoundCheck,
  UserRoundX,
  Menu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { METRICS_PERIOD_LABEL, loadStoreMetrics, type StoreMetrics } from "@/lib/storeMetrics";
import { loadMasterSellerReadiness, type SellerReadiness } from "@/lib/sellerReadiness";
import { ConversationsByDayChart } from "@/components/manager/ConversationsByDayChart";
import { SellerRanking } from "@/components/manager/SellerRanking";
import { SellerReadinessCard } from "@/components/manager/SellerReadinessCard";
import { CampaignLibrary } from "@/components/CampaignLibrary";
import { CampaignPerformance } from "@/components/CampaignPerformance";
import { AdminOperations } from "@/components/AdminOperations";
import { AccessCreator } from "@/components/AccessCreator";
import { MetaAdsConnection } from "@/components/MetaAdsConnection";
import { SalesReport } from "@/components/sales/SalesReport";
import { SalesSummaryCard } from "@/components/sales/SalesSummaryCard";

type AdminStats = {
  users: number;
  sellers: number;
  managers: number;
  stores: number;
  vehicles: number;
  campaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  errorCampaigns: number;
  leads: number;
  leadsLast30Days: number;
  spend: number;
  impressions: number;
  clicks: number;
  metaConnected: number;
};

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  seller_id: string;
  store_id: string;
  spend: number | string | null;
  spent_amount: number | string | null;
  clicks: number | null;
  impressions: number | null;
  leads_count: number | null;
  updated_at: string;
  archived_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  store_id: string | null;
  status: string;
};

type StoreRow = {
  id: string;
  name: string;
  status: string;
};

type RoleRow = {
  user_id: string;
  role: "ADMIN_MASTER" | "ADMIN_LOJA" | "VENDEDOR";
};

type AdminView =
  | "dashboard"
  | "vendas"
  | "empresas"
  | "usuarios"
  | "ofertas"
  | "campanhas"
  | "meta"
  | "configuracoes";

const navigation: {
  label: string;
  value: AdminView;
  icon: typeof LayoutDashboard;
  group?: string;
}[] = [
  { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
  { label: "Vendas", value: "vendas", icon: BadgeCheck, group: "Operação" },
  { label: "Empresa/Lojas", value: "empresas", icon: Building2, group: "Operação" },
  { label: "Usuários", value: "usuarios", icon: Users, group: "Operação" },
  { label: "Criar / Editar Campanha", value: "ofertas", icon: Megaphone, group: "Campanhas" },
  { label: "Campanhas/Performance", value: "campanhas", icon: BarChart3, group: "Campanhas" },
  { label: "Meta Ads", value: "meta", icon: BarChart3, group: "Integrações" },
  { label: "Configurações", value: "configuracoes", icon: Settings },
];

function StatCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  detail?: string;
}) {
  return (
    <Card className="shadow-none transition-colors hover:border-primary/40">
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<AdminView>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [usersListVersion, setUsersListVersion] = useState(0);
  const [stats, setStats] = useState<AdminStats>({
    users: 0,
    sellers: 0,
    managers: 0,
    stores: 0,
    vehicles: 0,
    campaigns: 0,
    activeCampaigns: 0,
    pausedCampaigns: 0,
    errorCampaigns: 0,
    leads: 0,
    leadsLast30Days: 0,
    spend: 0,
    impressions: 0,
    clicks: 0,
    metaConnected: 0,
  });
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [campaignUserIds, setCampaignUserIds] = useState<string[]>([]);
  const [showIdlePeople, setShowIdlePeople] = useState(false);
  const [operationMetrics, setOperationMetrics] = useState<StoreMetrics | null>(null);
  const [operationLoading, setOperationLoading] = useState(true);
  const [readiness, setReadiness] = useState<SellerReadiness[] | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [showIdleStores, setShowIdleStores] = useState(false);
  const [userRoles, setUserRoles] = useState<Record<string, RoleRow["role"]>>({});
  const [stores, setStores] = useState<StoreRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadAdminDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      const { data: isMaster } = await supabase.rpc("has_role", {
        _role: "ADMIN_MASTER",
        _user_id: user.id,
      });

      if (!isMaster) {
        if (mounted) setLoading(false);
        return;
      }

      const [
        profilesResult,
        rolesResult,
        storesResult,
        vehiclesResult,
        campaignsResult,
        metricsResult,
        metaResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, store_id, status"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("stores").select("id, name, status"),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase
          .from("seller_campaigns")
          .select(
            "id, name, status, seller_id, store_id, spend, spent_amount, clicks, impressions, leads_count, updated_at, archived_at",
          ),
        supabase
          .from("campaign_metrics")
          .select("leads, metric_date")
          .gte("metric_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from("meta_connections_v2").select("id, status"),
      ]);

      if (!mounted) return;

      const roleRows = (rolesResult.data ?? []) as RoleRow[];
      const campaignRows = (campaignsResult.data ?? []) as CampaignRow[];
      const profileRows = (profilesResult.data ?? []) as ProfileRow[];
      const storeRows = (storesResult.data ?? []) as StoreRow[];
      const activeIds = new Set(profileRows.filter((row) => row.status === "active").map((row) => row.id));

      const activeCampaigns = campaignRows.filter((campaign) => campaign.status === "active");
      const pausedCampaigns = campaignRows.filter((campaign) => campaign.status === "paused");
      const errorCampaigns = campaignRows.filter((campaign) => campaign.status === "error");
      const spend = campaignRows.reduce((total, campaign) => {
        const actualSpend = Number(campaign.spent_amount ?? 0) || Number(campaign.spend ?? 0);
        return total + actualSpend;
      }, 0);
      const impressions = campaignRows.reduce(
        (total, campaign) => total + Number(campaign.impressions ?? 0),
        0,
      );
      const clicks = campaignRows.reduce(
        (total, campaign) => total + Number(campaign.clicks ?? 0),
        0,
      );
      const leadsCount = campaignRows.reduce(
        (total, campaign) => total + Number(campaign.leads_count ?? 0),
        0,
      );
      // Conversas iniciadas no WhatsApp nos últimos 30 dias (resultados diários sincronizados da Meta).
      const leadsLast30Days = (metricsResult.data ?? []).reduce(
        (total, row) => total + Number(row.leads ?? 0),
        0,
      );

      setAuthorized(true);
      setProfiles(profileRows);
      setCampaignUserIds(roleRows.filter((row) => row.role !== "ADMIN_MASTER").map((row) => row.user_id));
      setUserRoles(Object.fromEntries(roleRows.map((row) => [row.user_id, row.role])));
      setStores(storeRows);
      setCampaigns(campaignRows);
      setStats({
        // Só usuários ativos: cadastros desativados (ex.: testes) não entram nas contagens.
        users: profileRows.filter((row) => row.status === "active").length,
        sellers: roleRows.filter((row) => row.role === "VENDEDOR" && activeIds.has(row.user_id)).length,
        managers: roleRows.filter((row) => row.role === "ADMIN_LOJA" && activeIds.has(row.user_id)).length,
        stores: storeRows.length,
        vehicles: vehiclesResult.count ?? 0,
        campaigns: campaignRows.length,
        activeCampaigns: activeCampaigns.length,
        pausedCampaigns: pausedCampaigns.length,
        errorCampaigns: errorCampaigns.length,
        leads: leadsCount,
        leadsLast30Days,
        spend,
        impressions,
        clicks,
        metaConnected: (metaResult.data ?? []).filter((connection) => connection.status === "connected").length,
      });
      setLoading(false);
    }

    loadAdminDashboard().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Resultados de todas as lojas (últimos 30 dias) e prontidão de todos os vendedores para publicar.
  useEffect(() => {
    if (!authorized) return;
    let mounted = true;
    // Mostra na hora o que já está guardado e depois atualiza com a Meta.
    void loadStoreMetrics(30, false).then((stored) => {
      if (!mounted || !stored) return;
      setOperationMetrics((current) => current ?? stored);
      setOperationLoading(false);
    });
    void loadStoreMetrics(30, true).then((result) => {
      if (!mounted) return;
      setOperationMetrics(result);
      setOperationLoading(false);
    });
    void loadMasterSellerReadiness().then((result) => {
      if (!mounted) return;
      setReadiness(result);
      setReadinessLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [authorized]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  const campaignHealth = useMemo(() => {
    const activeWithNoMetrics = campaigns.filter(
      (campaign) =>
        campaign.status === "active" &&
        Number(campaign.impressions ?? 0) === 0 &&
        Number(campaign.clicks ?? 0) === 0 &&
        Number(campaign.leads_count ?? 0) === 0,
    ).length;

    const activeSellerIds = new Set(
      campaigns.filter((campaign) => campaign.status === "active").map((campaign) => campaign.seller_id),
    );
    const activeStoreIds = new Set(
      campaigns.filter((campaign) => campaign.status === "active").map((campaign) => campaign.store_id),
    );

    const sellersWithoutCampaign = profiles.filter((profile) => {
      const isCampaignUser = profile.status === "active" && campaignUserIds.includes(profile.id);
      return isCampaignUser && !activeSellerIds.has(profile.id);
    }).length;

    const storesWithoutCampaign = stores.filter(
      (store) => store.status === "active" && !activeStoreIds.has(store.id),
    ).length;

    return {
      activeWithNoMetrics,
      sellersWithoutCampaign,
      storesWithoutCampaign,
    };
  }, [campaigns, profiles, campaignUserIds, stores]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando área administrativa...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <ShieldCheck className="h-8 w-8 text-destructive" />
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              Esta área está disponível somente para o usuário master da plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const currentPage = navigation.find((item) => item.value === view);
  // Desempenho: mesma fonte e período (últimos 30 dias) do gráfico, do ranking e dos painéis do gerente e do vendedor.
  const perf = operationMetrics?.store ?? null;
  const perfValue = (value: string) => (perf ? value : operationLoading ? "…" : "—");
  // Campanhas atuais (não arquivadas). As arquivadas continuam contando nos resultados do período.
  const currentCampaigns = campaigns.filter((campaign) => campaign.status !== "error" && !campaign.archived_at);
  const archivedCount = campaigns.filter((campaign) => campaign.status !== "error" && campaign.archived_at).length;
  const activeNow = currentCampaigns.filter((campaign) => campaign.status === "active").length;
  const pausedNow = currentCampaigns.filter((campaign) => campaign.status === "paused").length;
  const sellersWithoutCampaignList = profiles.filter((profile) => {
    const isCampaignUser = profile.status === "active" && campaignUserIds.includes(profile.id);
    const hasActiveCampaign = campaigns.some(
      (campaign) => campaign.status === "active" && campaign.seller_id === profile.id,
    );
    return isCampaignUser && !hasActiveCampaign;
  });

  // Agrupa quem está sem campanha ativa por loja, com a situação da última campanha.
  const lastCampaignBySeller = new Map<string, CampaignRow>();
  campaigns.forEach((campaign) => {
    const current = lastCampaignBySeller.get(campaign.seller_id);
    if (!current || new Date(campaign.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      lastCampaignBySeller.set(campaign.seller_id, campaign);
    }
  });
  const daysSince = (value: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  const inactivityLabel = (profileId: string) => {
    const last = lastCampaignBySeller.get(profileId);
    if (!last) return { text: "Nunca publicou campanha", tone: "critical" as const };
    const days = daysSince(last.updated_at);
    const when = days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
    if (last.status === "paused") return { text: `Campanha pausada ${when}`, tone: "warning" as const };
    if (last.status === "error") return { text: `Última tentativa com erro ${when}`, tone: "critical" as const };
    return { text: `Última campanha encerrada ${when}`, tone: "warning" as const };
  };
  const idleGroups = [
    ...stores
      .map((store) => ({
        id: store.id,
        name: store.name,
        people: sellersWithoutCampaignList.filter((profile) => profile.store_id === store.id),
      })),
    {
      id: "sem-loja",
      name: "Sem loja vinculada",
      people: sellersWithoutCampaignList.filter(
        (profile) => !profile.store_id || !stores.some((store) => store.id === profile.store_id),
      ),
    },
  ]
    .filter((group) => group.people.length > 0)
    .map((group) => ({
      ...group,
      people: [...group.people].sort((a, b) => {
        const roleA = userRoles[a.id] === "VENDEDOR" ? 0 : 1;
        const roleB = userRoles[b.id] === "VENDEDOR" ? 0 : 1;
        return roleA - roleB || (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR");
      }),
    }))
    .sort((a, b) => b.people.length - a.people.length);

  // Lojas ativas sem nenhuma campanha rodando, com equipe e a situação da última campanha da loja.
  const idleStores = stores
    .filter(
      (store) =>
        store.status === "active" &&
        !campaigns.some((campaign) => campaign.status === "active" && campaign.store_id === store.id),
    )
    .map((store) => {
      const team = profiles.filter(
        (profile) =>
          profile.status === "active" && profile.store_id === store.id && campaignUserIds.includes(profile.id),
      );
      const last = campaigns
        .filter((campaign) => campaign.store_id === store.id)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
      let info: { text: string; tone: "critical" | "warning" };
      if (!last) info = { text: "Nenhuma campanha publicada ainda", tone: "critical" };
      else {
        const days = daysSince(last.updated_at);
        const when = days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
        info =
          last.status === "paused"
            ? { text: `Última campanha pausada ${when}`, tone: "warning" }
            : last.status === "error"
              ? { text: `Última tentativa com erro ${when}`, tone: "critical" }
              : { text: `Última campanha encerrada ${when}`, tone: "warning" };
      }
      return {
        id: store.id,
        name: store.name,
        sellers: team.filter((profile) => userRoles[profile.id] === "VENDEDOR").length,
        managers: team.filter((profile) => userRoles[profile.id] === "ADMIN_LOJA").length,
        info,
      };
    })
    .sort((a, b) => (a.info.tone === b.info.tone ? a.name.localeCompare(b.name, "pt-BR") : a.info.tone === "critical" ? -1 : 1));

  const openAlertSection = (id: string, open: (value: boolean) => void, isOpen: boolean) => {
    open(!isOpen);
    if (!isOpen) {
      // Espera a seção renderizar antes de rolar até ela.
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));
  const rankingSellers = (operationMetrics?.sellers ?? []).map((row) => {
    const profile = profiles.find((item) => item.id === row.seller_id);
    return {
      id: row.seller_id,
      full_name: profile?.full_name ?? null,
      conversations: row.metrics.conversations,
      investment: row.metrics.spend,
      store_name: profile?.store_id ? storeNameById.get(profile.store_id) ?? null : null,
    };
  });

  function renderDashboard() {
    return (
      <div className="space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Usuários" value={stats.users} icon={Users} detail={`${stats.managers} gerentes · ${stats.sellers} vendedores`} />
          <StatCard label="Lojas" value={stats.stores} icon={Store} detail={`${stats.stores - Math.min(stats.stores, 0)} cadastradas`} />
          <StatCard label="Veículos" value={stats.vehicles} icon={Car} detail="Base de veículos" />
          <StatCard label="Campanhas" value={currentCampaigns.length} icon={Megaphone} detail={`${activeNow} ativas · ${pausedNow} pausadas${archivedCount ? ` · ${archivedCount} arquivada(s)` : ""}`} />
          <StatCard label="Conversas iniciadas" value={perfValue(formatInteger(perf?.conversations ?? 0))} icon={Target} detail={METRICS_PERIOD_LABEL} />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Investimento" value={perfValue(formatCurrency(perf?.spend ?? 0))} icon={CircleDollarSign} detail={METRICS_PERIOD_LABEL} />
          <StatCard label="Impressões" value={perfValue(formatInteger(perf?.impressions ?? 0))} icon={Eye} detail={METRICS_PERIOD_LABEL} />
          <StatCard label="Cliques" value={perfValue(formatInteger(perf?.clicks ?? 0))} icon={MousePointerClick} detail={METRICS_PERIOD_LABEL} />
          <StatCard label="CTR" value={perf && perf.impressions > 0 ? formatPercent(perf.ctr) : perfValue("—")} icon={BarChart3} detail="Cliques ÷ impressões" />
          <StatCard label="Custo por conversa" value={perf && perf.conversations > 0 ? formatCurrency(perf.spend / perf.conversations) : perfValue("—")} icon={CircleDollarSign} detail="Investimento ÷ conversas" />
        </section>

        <SalesSummaryCard
          title="Vendas do mês · todas as lojas"
          description="Vendas registradas pelos vendedores. Confira o número da proposta na aba Vendas."
          onOpen={() => setView("vendas")}
          openLabel="Ver e conferir vendas"
        />

        <section className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
          <ConversationsByDayChart
            daily={operationMetrics?.daily ?? []}
            loading={operationLoading}
            description="Conversas iniciadas no WhatsApp pelos anúncios de todas as lojas, últimos 30 dias."
          />
          </div>
          <div className="xl:col-span-2">
          <SellerRanking
            sellers={rankingSellers}
            loading={operationLoading}
            description="Top 5 da operação, últimos 30 dias."
          />
          </div>
        </section>
        <SellerReadinessCard
          sellers={readiness}
          loading={readinessLoading}
          description="O que cada vendedor da operação precisa para publicar campanhas na Meta."
        />

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Resumo da operação</CardTitle>
              <CardDescription>Visão rápida do que precisa de atenção no AutoAds.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {([
                ["Empresas/Lojas", "Gerencie a estrutura e as unidades.", "empresas", Building2],
                ["Usuários", "Controle masters, gerentes e vendedores.", "usuarios", Users],
                ["Campanhas/Performance", "Acompanhe campanhas e métricas.", "campanhas", BarChart3],
                ["Integrações", "Conexão Meta Ads.", "meta", Store],
              ] as const).map(([label, description, target, ItemIcon]) => {
                return (
                  <Button
                    key={String(target)}
                    variant="outline"
                    className="h-auto justify-between p-3 text-left"
                    onClick={() => setView(target as AdminView)}
                  >
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        <ItemIcon className="h-4 w-4" />
                        {label}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saúde das campanhas</CardTitle>
              <CardDescription>Indicadores operacionais para o Master agir rapidamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />Campanhas ativas</span>
                <span className="font-semibold">{activeNow}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm"><PauseCircle className="h-4 w-4" />Campanhas pausadas</span>
                <span className="font-semibold">{pausedNow}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-destructive" />Campanhas sem métrica</span>
                <span className="font-semibold">{campaignHealth.activeWithNoMetrics}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas e pontos de atenção</CardTitle>
              <CardDescription>Indicadores operacionais para o Master agir rapidamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-left text-red-900 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                aria-expanded={showIdlePeople}
                onClick={() => openAlertSection("sem-campanha-ativa", setShowIdlePeople, showIdlePeople)}
              >
                <span className="flex items-center gap-2">
                  <UserRoundX className="h-4 w-4 text-red-600" />
                  <span>
                    <span className="block font-medium">Sem campanha ativa</span>
                    <span className="block text-xs text-red-800/80 dark:text-red-200/80">
                      {showIdlePeople ? "Clique para fechar a lista." : "Clique para ver quem está parado, por loja."}
                    </span>
                  </span>
                </span>
                <span className="text-xl font-bold text-red-600">{campaignHealth.sellersWithoutCampaign}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-left text-red-900 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                aria-expanded={showIdleStores}
                onClick={() => openAlertSection("lojas-sem-campanha", setShowIdleStores, showIdleStores)}
              >
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-red-600" />
                  <span>
                    <span className="block font-medium">Lojas sem campanha ativa</span>
                    <span className="block text-xs text-red-800/80 dark:text-red-200/80">
                      {showIdleStores ? "Clique para fechar a lista." : "Clique para ver quais lojas estão paradas."}
                    </span>
                  </span>
                </span>
                <span className="text-xl font-bold text-red-600">{campaignHealth.storesWithoutCampaign}</span>
              </button>
            </CardContent>
          </Card>
        </section>

        {showIdlePeople && idleGroups.length > 0 && (
          <section
            id="sem-campanha-ativa"
            className="scroll-mt-24 overflow-hidden rounded-xl border-2 border-red-300 bg-card shadow-sm dark:border-red-900"
          >
            <div className="flex flex-col gap-3 bg-red-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold">Sem campanha ativa agora</h2>
                  <p className="text-sm text-white/85">
                    {sellersWithoutCampaignList.length}{" "}
                    {sellersWithoutCampaignList.length === 1 ? "pessoa" : "pessoas"} em {idleGroups.length}{" "}
                    {idleGroups.length === 1 ? "loja" : "lojas"} sem nenhum anúncio rodando.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-red-700">
                  {sellersWithoutCampaignList.length} sem anúncio
                </span>
                <button
                  type="button"
                  className="rounded-full border border-white/60 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
                  onClick={() => setShowIdlePeople(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {idleGroups.map((group) => (
                <div key={group.id} className="rounded-lg border border-red-200 dark:border-red-900/60">
                  <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/60 dark:bg-red-950/40">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-red-900 dark:text-red-100">
                      <Store className="h-4 w-4 shrink-0 text-red-600" />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      {group.people.length}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {group.people.map((profile) => {
                      const info = inactivityLabel(profile.id);
                      const isManager = userRoles[profile.id] === "ADMIN_LOJA";
                      return (
                        <li key={profile.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{profile.full_name || "Sem nome"}</p>
                            <p
                              className={`text-xs font-medium ${
                                info.tone === "critical" ? "text-red-600" : "text-amber-600"
                              }`}
                            >
                              {info.text}
                            </p>
                          </div>
                          <Badge variant={isManager ? "secondary" : "outline"} className="shrink-0">
                            {isManager ? "Gerente" : "Vendedor"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {showIdleStores && idleStores.length > 0 && (
          <section
            id="lojas-sem-campanha"
            className="scroll-mt-24 overflow-hidden rounded-xl border-2 border-red-300 bg-card shadow-sm dark:border-red-900"
          >
            <div className="flex flex-col gap-3 bg-red-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Store className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold">Lojas sem campanha ativa agora</h2>
                  <p className="text-sm text-white/85">
                    {idleStores.length} {idleStores.length === 1 ? "loja" : "lojas"} sem nenhum anúncio rodando.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-red-700">
                  {idleStores.length} {idleStores.length === 1 ? "loja parada" : "lojas paradas"}
                </span>
                <button
                  type="button"
                  className="rounded-full border border-white/60 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
                  onClick={() => setShowIdleStores(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {idleStores.map((store) => (
                <div key={store.id} className="rounded-lg border border-red-200 dark:border-red-900/60">
                  <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
                    <Store className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="truncate">{store.name}</span>
                  </div>
                  <div className="space-y-1 px-4 py-3">
                    <p className={`text-sm font-medium ${store.info.tone === "critical" ? "text-red-600" : "text-amber-600"}`}>
                      {store.info.text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {store.sellers} {store.sellers === 1 ? "vendedor" : "vendedores"} · {store.managers}{" "}
                      {store.managers === 1 ? "gerente" : "gerentes"}
                      {store.sellers + store.managers === 0 ? " · nenhuma equipe cadastrada" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  function renderView() {
    switch (view) {
      case "dashboard":
        return renderDashboard();
      case "vendas":
        return <SalesReport scope="all" />;
      case "empresas":
        return <AdminOperations section="empresas" />;
      case "usuarios":
        return (
          <div className="space-y-6">
            <AccessCreator onCreated={() => setUsersListVersion((current) => current + 1)} />
            {/* Lista de usuários por marca/loja com editar, senha, status e exclusão. */}
            <AdminOperations key={usersListVersion} section="usuarios" />
          </div>
        );
      case "ofertas":
        return <CampaignLibrary />;
      case "campanhas":
        return <CampaignPerformance />;
      case "meta":
        return <MetaAdsConnection />;
      case "configuracoes":
        return <AdminOperations section="configuracoes" />;
      default:
        return null;
    }
  }

  // Configurações fica fixo no rodapé do menu, junto de Sair.
  const mainNavigation = navigation.filter((item) => item.value !== "configuracoes");

  const sidebarContent = (
    <>
      <div className="flex h-20 shrink-0 flex-col justify-center border-b border-border px-6">
        <p className="text-lg font-semibold">AutoAds</p>
        <p className="text-xs text-muted-foreground">Administração</p>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {Array.from(new Set(mainNavigation.map((item) => item.group ?? "Geral"))).map((group) => (
          <div key={group}>
            {group !== "Geral" && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>}
            <div className="space-y-1">
              {mainNavigation.filter((item) => (item.group ?? "Geral") === group).map((item) => {
                const Icon = item.icon;
                const active = view === item.value;
                return (
                  <Button
                    key={item.value}
                    variant={active ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setView(item.value);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-border p-4">
        <Button
          variant={view === "configuracoes" ? "secondary" : "ghost"}
          className="w-full justify-start gap-3"
          onClick={() => {
            setView("configuracoes");
            setMobileMenuOpen(false);
          }}
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-muted/30" data-section={view === "ofertas" ? "campaign-editor" : view}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          {sidebarContent}
        </aside>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
            <SheetTitle className="sr-only">Menu administrativo</SheetTitle>
            <SheetDescription className="sr-only">Navegue entre as áreas do painel master.</SheetDescription>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 h-20 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">Painel Master</p>
                  <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{currentPage?.label ?? "Dashboard"}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">Área administrativa</Badge>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {view !== "dashboard" && <div><p className="text-sm text-muted-foreground">Gerencie {currentPage?.label.toLowerCase()} sem sair do painel.</p></div>}
            {renderView()}
          </div>
        </div>
      </div>
    </main>
  );
}

import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  CircleDollarSign,
  Eye,
  Facebook,
  LayoutDashboard,
  Menu,
  Settings,
  Target,
  CalendarDays,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Megaphone,
  Pause,
  Play,
  Trash2,
  Unplug,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { CampaignLibrary } from "@/components/CampaignLibrary";
import { ConversationsByDayChart } from "@/components/manager/ConversationsByDayChart";
import { SellerCampaignAlerts } from "@/components/seller/SellerCampaignAlerts";
import { SellerReadinessChecklist } from "@/components/seller/SellerReadinessChecklist";
import { SellerSales } from "@/components/seller/SellerSales";
import { CurrentCampaignPanel } from "@/components/seller/CurrentCampaignPanel";
import { SalesSummaryCard } from "@/components/sales/SalesSummaryCard";
import { METRICS_PERIOD_LABEL, loadMyMetrics, type MetricTotals } from "@/lib/storeMetrics";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  full_name: string | null;
  job_title: string | null;
  whatsapp: string | null;
  group_id: string | null;
  company_id: string | null;
  store_id: string | null;
};
type SellerContext = Profile & { store_name: string | null };
type Campaign = {
  id: string;
  name: string;
  status: string;
  error_message?: string | null;
  meta_campaign_id?: string | null;
  budget_amount: number;
  total_budget: number;
  daily_budget: number;
  spent_amount: number;
  /** null = contínua: orçamento diário até o vendedor pausar ou acabar o saldo. */
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  clicks: number;
  impressions: number;
  leads_count: number;
  spend: number;
  vehicle_id: string | null;
  meta_delivery_status: string | null;
  meta_delivery_detail: string | null;
  meta_delivery_checked_at: string | null;
};
type MetaAccountBalance = {
  id: string;
  name: string;
  currency: string;
  account_status: number | null;
  is_prepay_account: boolean;
  balance: number | null;
  amount_spent: number | null;
  spend_cap: number | null;
  /** "unavailable": a Meta não informa os fundos desta conta pela API. */
  balance_source?: string;
  fetched_at: string;
};
type MetaInsight = {
  campaign_id: string | null;
  campaign_name: string;
  objective: string | null;
  impressions: number;
  clicks: number;
  unique_clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  inline_link_clicks: number;
  inline_post_engagement: number;
  link_clicks: number;
  leads: number;
  landing_page_views: number;
  purchases: number;
  add_to_cart: number;
  initiate_checkout: number;
  messaging_conversations: number;
  conversions: number;
  conversion_values: number;
  video_plays: number;
  thruplays: number;
  video_25: number;
  video_50: number;
  video_75: number;
  video_95: number;
  video_100: number;
  video_30s: number;
  social_spend: number;
};
type MetaInsights = {
  period: string;
  insights: MetaInsight;
  campaigns: MetaInsight[];
  fetched_at: string;
  account_id: string;
  account_name: string;
};

const VIEW_DESCRIPTIONS: Record<SellerView, string> = {
  inicio: "",
  campanhas: "Escolha uma oferta e acompanhe os seus anúncios.",
  resultados: "Acompanhe o desempenho dos seus anúncios.",
  vendas: "Registre as vendas dos clientes que vieram dos seus anúncios.",
  meta: "Conexão, saldo e desempenho da sua conta Meta.",
  configuracoes: "Seus dados de acesso e a loja à qual você está vinculado.",
};

const META_OAUTH_RESULT_KEY = "autoads-meta-oauth-result";
type SellerView = "inicio" | "campanhas" | "resultados" | "vendas" | "meta" | "configuracoes";

const META_ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
}

function formatCampaignDate(value: string | null | undefined) {
  if (!value) return "Não definida";
  // Datas puras (AAAA-MM-DD) são tratadas como horário local; timestamps completos são lidos como vieram.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Não definida" : date.toLocaleDateString("pt-BR");
}
function formatMetaCurrency(value: number | null | undefined, currency = "BRL") {
  if (value == null || Number.isNaN(value)) return "—";
  const divisor = META_ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value / divisor);
}
function formatInsightCurrency(value: number | null | undefined, currency = "BRL") {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}
function formatMetaNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value ?? 0);
}
function formatMetaPercent(value: number | null | undefined) {
  return `${(value ?? 0).toFixed(2).replace(".", ",")}%`;
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    pending: "Aguardando publicação",
    active: "Ativa",
    paused: "Pausada",
    finished: "Finalizada",
    error: "Erro",
  };
  return labels[status] ?? status;
}
function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "error") return "destructive" as const;
  return "secondary" as const;
}

type DeliveryBadge = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  hint: string | null;
};

// Status espelhado da Meta (atualizado pela função meta-campaign-delivery-v1).
const DELIVERY_BADGES: Record<string, DeliveryBadge> = {
  in_review: {
    label: "Em análise",
    variant: "outline",
    hint: "A Meta está revisando o anúncio. Isso costuma levar de minutos a algumas horas.",
  },
  approved: {
    label: "Aprovado",
    variant: "secondary",
    hint: "Anúncio aprovado pela Meta, aguardando início da veiculação.",
  },
  scheduled: {
    label: "Agendado",
    variant: "secondary",
    hint: "Aprovado. A veiculação começa na data de início.",
  },
  delivering: { label: "Veiculando", variant: "default", hint: null },
  rejected: {
    label: "Reprovado pela Meta",
    variant: "destructive",
    hint: "A Meta reprovou o anúncio.",
  },
  with_issues: {
    label: "Com problemas",
    variant: "destructive",
    hint: "A Meta encontrou um problema na veiculação.",
  },
  billing: { label: "Pagamento pendente", variant: "destructive", hint: null },
  paused: { label: "Pausado", variant: "secondary", hint: null },
  completed: {
    label: "Concluído",
    variant: "secondary",
    hint: "O período de veiculação terminou.",
  },
  deleted: {
    label: "Removido na Meta",
    variant: "secondary",
    hint: "O anúncio não existe mais na conta de anúncios.",
  },
};

const DELIVERY_PENDING = new Set(["in_review", "approved", "scheduled", "unknown"]);

function deliveryBadge(campaign: { status: string; meta_delivery_status: string | null }) {
  if (campaign.status === "error" || campaign.status === "draft" || campaign.status === "pending")
    return null;
  if (!campaign.meta_delivery_status) return null;
  return DELIVERY_BADGES[campaign.meta_delivery_status] ?? null;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Não foi possível entrar. Confira seu e-mail e senha.");
      return;
    }
    onLoggedIn();
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-3xl">Bem-vindo</CardTitle>
            <CardDescription className="mt-2">
              Entre para gerenciar seus anúncios de veículos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <div className="mt-5 border-t border-border pt-5 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Administrador da plataforma?</p>
            <Button asChild className="w-full" variant="outline">
              <Link to="/admin">Acessar área administrativa</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-1 break-words text-xl font-semibold sm:mt-2 sm:text-2xl">{value}</p>
        </div>
        <div className="hidden shrink-0 rounded-xl bg-primary/10 p-3 text-primary sm:block">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SellerDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [activeView, setActiveView] = useState<SellerView>("inicio");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storeName, setStoreName] = useState("Não informada");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [message, setMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [metaStatus, setMetaStatus] = useState<"loading" | "connected" | "disconnected" | "error">(
    "loading",
  );
  const [metaAccountName, setMetaAccountName] = useState("");
  const [metaMessage, setMetaMessage] = useState("");
  const [metaBalance, setMetaBalance] = useState<MetaAccountBalance | null>(null);
  const [metaBalanceLoading, setMetaBalanceLoading] = useState(false);
  const [metaBalanceError, setMetaBalanceError] = useState("");
  const [metaInsights, setMetaInsights] = useState<MetaInsights | null>(null);
  const [metaInsightsLoading, setMetaInsightsLoading] = useState(false);
  const [metaInsightsError, setMetaInsightsError] = useState("");
  const [changingCampaignId, setChangingCampaignId] = useState<string | null>(null);
  const [campaignMessage, setCampaignMessage] = useState("");
  const metaChannelRef = useRef<BroadcastChannel | null>(null);
  const loadedUserRef = useRef<string | null>(null);
  const metaConnectedRef = useRef(false);
  const activeViewRef = useRef<SellerView>("inicio");
  const insightsLoadedRef = useRef(false);
  useEffect(() => {
    activeViewRef.current = activeView;
    // O desempenho da Meta só é usado na aba Meta Ads: busca ao abrir a aba (uma vez por visita).
    if (activeView === "meta" && metaConnectedRef.current && !insightsLoadedRef.current) {
      insightsLoadedRef.current = true;
      void refreshMetaInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, metaStatus]);
  const [myDaily, setMyDaily] = useState<
    Array<{ date: string; conversations: number; spend: number }>
  >([]);
  const [myDailyLoading, setMyDailyLoading] = useState(true);
  // Totais dos últimos 30 dias: mesma fonte e período do gráfico e dos painéis do gerente/master.
  const [myTotals, setMyTotals] = useState<MetricTotals | null>(null);
  const [activeCampaignCount, setActiveCampaignCount] = useState<number | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    // Primeiro mostra o que já está guardado; depois atualiza com a Meta em segundo plano.
    void (async () => {
      const stored = await loadMyMetrics(undefined, false);
      if (!active) return;
      setMyDaily(stored?.daily ?? []);
      setMyTotals(stored?.totals ?? null);
      setMyDailyLoading(false);
      const fresh = await loadMyMetrics(undefined, true);
      if (active && fresh) {
        setMyDaily(fresh.daily);
        setMyTotals(fresh.totals);
      }
    })();
    return () => {
      active = false;
    };
  }, [authenticated]);

  // Campanha que terminou junto com a oferta (ou o período) e não está ativa: sai de "Minhas campanhas".
  // Os resultados continuam no histórico; se a oferta for renovada e publicada, a data de fim é
  // estendida e a campanha volta a aparecer.
  const isEndedCampaign = (campaign: Campaign) =>
    campaign.status !== "active" &&
    Boolean(campaign.meta_campaign_id) &&
    Boolean(campaign.end_date) &&
    new Date(campaign.end_date as string).getTime() <= Date.now();

  async function refreshCampaigns(userId?: string) {
    const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!id) return;
    const { data } = await supabase
      .from("seller_campaigns")
      .select(
        "id, name, status, error_message, meta_campaign_id, budget_amount, total_budget, daily_budget, spent_amount, duration_days, start_date, end_date, clicks, impressions, leads_count, spend, vehicle_id, meta_delivery_status, meta_delivery_detail, meta_delivery_checked_at",
      )
      .eq("seller_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(15);
    setCampaigns((data ?? []) as Campaign[]);
    // A lista mostra só as 5 mais recentes; a contagem de ativas considera todas.
    const { count } = await supabase
      .from("seller_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", id)
      .is("archived_at", null)
      .eq("status", "active");
    setActiveCampaignCount(count ?? null);
  }

  async function syncMetaDelivery() {
    // Sem sessão ativa (logout ou sessão expirada) não há o que consultar.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const { data, error } = await supabase.functions.invoke("meta-campaign-delivery-v1", {
      body: {},
    });
    if (error || !Array.isArray(data?.statuses)) return;
    type DeliveryMetrics = {
      spend: number;
      impressions: number;
      clicks: number;
      conversations: number;
    };
    type DeliveryItem = {
      campaign_id: string;
      status: string;
      detail: string | null;
      checked_at: string;
      metrics: DeliveryMetrics | null;
    };
    const byId = new Map<string, DeliveryItem>(
      (data.statuses as DeliveryItem[]).map((item) => [item.campaign_id, item]),
    );
    setCampaigns((current) =>
      current.map((campaign) => {
        const delivery = byId.get(campaign.id);
        return delivery
          ? {
              ...campaign,
              meta_delivery_status: delivery.status,
              meta_delivery_detail: delivery.detail,
              meta_delivery_checked_at: delivery.checked_at,
              ...(delivery.metrics
                ? {
                    spend: delivery.metrics.spend,
                    spent_amount: delivery.metrics.spend,
                    impressions: delivery.metrics.impressions,
                    clicks: delivery.metrics.clicks,
                    leads_count: delivery.metrics.conversations,
                  }
                : {}),
            }
          : campaign;
      }),
    );
  }

  // Último valor da Meta guardado no navegador: a tela mostra na hora e atualiza em segundo plano.
  const cacheKey = (name: string) => `autoads-cache:${loadedUserRef.current ?? "anon"}:${name}`;
  function readCache<T>(name: string): T | null {
    try {
      const raw = window.sessionStorage.getItem(cacheKey(name));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  function writeCache(name: string, value: unknown) {
    try {
      window.sessionStorage.setItem(cacheKey(name), JSON.stringify(value));
    } catch {
      /* ignore storage restrictions */
    }
  }

  async function refreshMetaInsights() {
    const cached = readCache<MetaInsights>("insights");
    if (cached) setMetaInsights((current) => current ?? cached);
    setMetaInsightsLoading(true);
    setMetaInsightsError("");
    const { data, error } = await supabase.functions.invoke("meta-ad-insights-v1");
    setMetaInsightsLoading(false);
    if (error || !data?.insights) {
      setMetaInsightsError(
        error?.message || data?.error || "Não foi possível consultar os indicadores reais da Meta.",
      );
      return false;
    }
    setMetaInsights(data as MetaInsights);
    writeCache("insights", data);
    return true;
  }

  async function refreshMetaBalance() {
    const cached = readCache<MetaAccountBalance>("balance");
    if (cached) setMetaBalance((current) => current ?? cached);
    setMetaBalanceLoading(true);
    setMetaBalanceError("");
    const { data, error } = await supabase.functions.invoke("meta-ad-account-balance-v1");
    setMetaBalanceLoading(false);
    if (error || !data?.account) {
      setMetaBalanceError(
        error?.message || data?.error || "Não foi possível consultar o saldo real da Meta.",
      );
      return false;
    }
    setMetaBalance(data.account as MetaAccountBalance);
    writeCache("balance", data.account);
    return true;
  }

  function openMetaBilling() {
    if (!metaBalance?.id) {
      setMetaBalanceError("Não foi possível identificar a conta de anúncios da Meta.");
      return;
    }
    const adAccountId = metaBalance.id.replace(/^act_/, "");
    const confirmed = window.confirm(
      "O pagamento será feito diretamente na Meta. O AutoAds não recebe, guarda ou intermedeia seu dinheiro.\n\nVocê será levado diretamente para a área de pagamentos da sua conta de anúncios na Meta.",
    );
    if (!confirmed) return;
    const billingUrl = `https://adsmanager.facebook.com/adsmanager/billing_hub/payment_settings/?asset_id=${encodeURIComponent(adAccountId)}&payment_account_id=${encodeURIComponent(adAccountId)}`;
    const newTab = window.open(billingUrl, "_blank");
    if (!newTab) {
      setMetaBalanceError(
        "O navegador bloqueou a abertura da Meta. Permita novas abas/janelas para adicionar saldo.",
      );
      return;
    }
    newTab.focus();
  }

  async function refreshMetaAfterFunding() {
    await refreshMetaBalance();
    await refreshMetaInsights();
  }

  async function refreshMetaConnection(userId: string) {
    const [connectionResult, accountResult] = await Promise.all([
      supabase
        .from("meta_connections_v2")
        .select("status")
        .eq("seller_id", userId)
        .eq("provider", "meta")
        .maybeSingle(),
      supabase
        .from("meta_ad_accounts_v2")
        .select("name, external_account_id, status")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const connectionStatus = connectionResult.data?.status;
    if (connectionStatus === "connected") {
      setMetaStatus("connected");
      setMetaAccountName(accountResult.data?.name ?? "");
      setMetaMessage("");
      void refreshMetaBalance();
      metaConnectedRef.current = true;
      if (activeViewRef.current === "meta") void refreshMetaInsights();
      return true;
    }

    if (connectionStatus === "error") {
      setMetaStatus("error");
      setMetaBalance(null);
      return false;
    }

    setMetaStatus("disconnected");
    setMetaAccountName("");
    setMetaBalance(null);
    setMetaBalanceError("");
    return false;
  }

  async function loadSellerData(userId: string) {
    const [contextResult, profileResult] = await Promise.all([
      supabase.rpc("get_current_seller_context").maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name,job_title,whatsapp,group_id,company_id,store_id")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    let context = contextResult.data as SellerContext | null;
    if (!context && profileResult.data) {
      const baseProfile = profileResult.data as Profile;
      let store_name: string | null = null;
      if (baseProfile.store_id) {
        const { data: store } = await supabase
          .from("stores")
          .select("name")
          .eq("id", baseProfile.store_id)
          .maybeSingle();
        store_name = store?.name ?? null;
      }
      context = { ...baseProfile, store_name };
    }

    setProfile(context);
    setWhatsapp(context?.whatsapp ?? "");
    setStoreName(context?.store_name ?? "Não informada");

    const campaignsResult = await supabase
      .from("seller_campaigns")
      .select(
        "id, name, status, error_message, meta_campaign_id, budget_amount, total_budget, daily_budget, spent_amount, duration_days, start_date, end_date, clicks, impressions, leads_count, spend, vehicle_id, meta_delivery_status, meta_delivery_detail, meta_delivery_checked_at",
      )
      .eq("seller_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(15);
    setCampaigns((campaignsResult.data ?? []) as Campaign[]);
    await refreshMetaConnection(userId);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaResult = params.get("meta");
    if (!window.opener || (metaResult !== "connected" && metaResult !== "error")) return;

    const payload = { source: "autoads-meta-oauth", status: metaResult, timestamp: Date.now() };
    try {
      window.localStorage.setItem(META_OAUTH_RESULT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore storage restrictions */
    }
    try {
      window.opener.postMessage(payload, window.location.origin);
    } catch {
      /* ignore closed opener */
    }
    try {
      const channel = new BroadcastChannel("autoads-meta-oauth");
      channel.postMessage(payload);
      channel.close();
    } catch {
      /* BroadcastChannel may be unavailable */
    }
    window.close();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        setAuthenticated(false);
        setProfile(null);
        setStoreName("Não informada");
        return;
      }
      setAuthenticated(true);
      loadedUserRef.current = session.user.id;
      await loadSellerData(session.user.id);
    }

    void loadDashboard().catch(() => {
      if (mounted) setAuthenticated(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // Troca de conta no mesmo navegador: recarrega para não mostrar dados do usuário anterior.
      if (event === "SIGNED_OUT" && loadedUserRef.current) {
        window.location.reload();
        return;
      }
      if (
        event === "SIGNED_IN" &&
        loadedUserRef.current &&
        session?.user &&
        session.user.id !== loadedUserRef.current
      ) {
        window.location.reload();
        return;
      }
      const alreadyLoaded = Boolean(session?.user && loadedUserRef.current === session.user.id);
      if (session?.user) loadedUserRef.current = session.user.id;
      if (!session?.user) {
        setAuthenticated(false);
        setProfile(null);
        setStoreName("Não informada");
        return;
      }
      // Renovar o login (TOKEN_REFRESHED) não muda os dados: só recarrega num login novo.
      if ((event === "SIGNED_IN" && !alreadyLoaded) || event === "USER_UPDATED") {
        setAuthenticated(true);
        void loadSellerData(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const publishedCampaignKey = campaigns
    .filter(
      (campaign) =>
        campaign.status === "active" ||
        campaign.status === "paused" ||
        campaign.status === "finished",
    )
    .map((campaign) => campaign.id)
    .join(",");
  const deliveryIsPending = campaigns.some(
    (campaign) =>
      (campaign.status === "active" || campaign.status === "paused") &&
      (!campaign.meta_delivery_status || DELIVERY_PENDING.has(campaign.meta_delivery_status)),
  );

  const deliveryIsRunning = campaigns.some(
    (campaign) => campaign.meta_delivery_status === "delivering",
  );

  useEffect(() => {
    if (!publishedCampaignKey) return;
    void syncMetaDelivery();
    // Em análise: consulta a cada minuto. Veiculando: atualiza status e resultados a cada 5 minutos.
    const interval = deliveryIsPending ? 60_000 : deliveryIsRunning ? 300_000 : 0;
    if (!interval) return;
    const timer = window.setInterval(() => void syncMetaDelivery(), interval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedCampaignKey, deliveryIsPending, deliveryIsRunning]);

  useEffect(() => {
    const handleCreated = async (event: Event) => {
      void refreshCampaigns();
      setCampaignMessage("Publicando a campanha na Meta...");
      const campaignId =
        (event as CustomEvent<{ campaignId?: string | null }>).detail?.campaignId ?? null;
      const { data, error } = await supabase.functions.invoke("meta-create-seller-campaign-v1", {
        body: campaignId ? { campaign_id: campaignId } : {},
      });
      if (error || !data?.success) {
        // Em respostas 4xx/5xx o corpo com o erro detalhado da Meta fica em error.context.
        let detail: string | undefined = data?.error;
        const context = (error as { context?: Response } | null)?.context;
        if (!detail && context && typeof context.json === "function") {
          try {
            detail = (await context.clone().json())?.error;
          } catch {
            /* sem corpo JSON */
          }
        }
        setCampaignMessage(
          `A Meta não publicou a campanha. ${detail || error?.message || "Erro desconhecido."}`,
        );
        void refreshCampaigns();
        return;
      }
      setCampaignMessage("Campanha publicada na Meta com sucesso.");
      void refreshCampaigns();
      void refreshMetaInsights();
    };
    window.addEventListener("autoads:campaign-created", handleCreated);
    return () => window.removeEventListener("autoads:campaign-created", handleCreated);
  }, []);

  useEffect(() => {
    const handleOAuthStatus = async (status: string) => {
      if (status !== "connected" && status !== "error") return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (status === "error") {
        setMetaStatus("error");
        setMetaMessage("A Meta não conseguiu concluir a conexão. Tente novamente.");
        return;
      }
      setMetaStatus("connected");
      setMetaMessage("");
      await refreshMetaConnection(user.id);
      await loadSellerData(user.id);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "autoads-meta-oauth") return;
      void handleOAuthStatus(event.data.status);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== META_OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        void handleOAuthStatus(payload.status);
      } catch {
        /* ignore malformed payload */
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    try {
      metaChannelRef.current = new BroadcastChannel("autoads-meta-oauth");
      metaChannelRef.current.addEventListener(
        "message",
        (event) => void handleOAuthStatus(event.data?.status),
      );
    } catch {
      metaChannelRef.current = null;
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      metaChannelRef.current?.close();
      metaChannelRef.current = null;
    };
  }, []);

  async function disconnectMeta() {
    const confirmed = window.confirm(
      "Desconectar sua conta Meta? O AutoAds encerrará a conexão deste vendedor e não poderá mais consultar ou publicar anúncios usando essa autorização até que você conecte novamente.",
    );
    if (!confirmed) return;

    setMetaMessage("");
    setMetaStatus("loading");
    const { data, error } = await supabase.functions.invoke("meta-oauth-disconnect-v1", {
      body: {},
    });

    if (error || !data?.success) {
      setMetaStatus("connected");
      setMetaMessage(error?.message || data?.error || "Não foi possível desconectar a conta Meta.");
      return;
    }

    setMetaStatus("disconnected");
    setMetaAccountName("");
    setMetaBalance(null);
    setMetaInsights(null);
    setMetaBalanceError("");
    setMetaInsightsError("");
    setMetaMessage(
      data?.warning
        ? `Conta Meta desconectada. ${data.warning}`
        : "Conta Meta desconectada com sucesso.",
    );
  }

  async function connectMeta() {
    setMetaMessage("");
    setMetaStatus("loading");
    try {
      window.localStorage.removeItem(META_OAUTH_RESULT_KEY);
    } catch {
      /* ignore storage restrictions */
    }

    const { data, error } = await supabase.functions.invoke("meta-oauth-callback-v1", {
      body: { return_to: window.location.href },
    });
    if (error || !data?.url) {
      setMetaStatus("error");
      setMetaMessage(error?.message || data?.error || "Não foi possível iniciar a conexão Meta.");
      return;
    }

    const popup = window.open(
      data.url,
      "autoads-meta-oauth",
      "popup,width=600,height=760,resizable=yes,scrollbars=yes",
    );
    if (!popup) {
      setMetaStatus("disconnected");
      setMetaMessage("O navegador bloqueou a janela da Meta. Permita pop-ups para continuar.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    let finished = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let popupClosedAt: number | null = null;
    const POPUP_CLOSE_GRACE_MS = 20_000;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    const finishFromStatus = async (status: string) => {
      if (finished) return;
      if (status === "connected") {
        setMetaStatus("connected");
        setMetaMessage("");
        cleanup();
        if (userId) await loadSellerData(userId);
        return;
      }
      if (status === "error") {
        cleanup();
        setMetaStatus("error");
        setMetaMessage("A Meta não conseguiu concluir a conexão. Tente novamente.");
      }
    };

    const pollConnection = async () => {
      if (finished || !userId) return false;
      const connected = await refreshMetaConnection(userId);
      if (connected) {
        await finishFromStatus("connected");
        return true;
      }
      return false;
    };

    pollTimer = setInterval(async () => {
      if (finished) return;
      const connected = await pollConnection();
      if (connected || finished) return;
      if (popup.closed) {
        if (popupClosedAt === null) popupClosedAt = Date.now();
        const finalConnected = await pollConnection();
        if (finalConnected || finished) return;

        // Meta can close the OAuth popup immediately after redirecting while the
        // callback is still exchanging the code and persisting the connection.
        // Keep polling briefly instead of declaring a failure on the first close.
        if (Date.now() - popupClosedAt >= POPUP_CLOSE_GRACE_MS) {
          cleanup();
          setMetaStatus("disconnected");
          setMetaMessage("A janela da Meta foi fechada antes de concluir a conexão.");
        }
      } else {
        popupClosedAt = null;
      }
    }, 1500);

    timeoutTimer = setTimeout(
      async () => {
        if (finished) return;
        const connected = await pollConnection();
        if (connected || finished) return;
        cleanup();
        setMetaStatus("disconnected");
        setMetaMessage("A conexão demorou mais que o esperado. Você pode tentar novamente.");
      },
      5 * 60 * 1000,
    );
  }

  async function saveWhatsapp() {
    setSavingWhatsapp(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingWhatsapp(false);
      return;
    }
    const { error } = await supabase.from("profiles").update({ whatsapp }).eq("id", user.id);
    setSavingWhatsapp(false);
    setMessage(error ? "Não foi possível salvar o WhatsApp." : "WhatsApp salvo com sucesso.");
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordMessage("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMessage("Não foi possível alterar a senha. Tente novamente.");
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Senha alterada com sucesso.");
  }
  async function toggleSellerCampaign(campaign: Campaign) {
    const nextStatus = campaign.status === "active" ? "paused" : "active";
    setChangingCampaignId(campaign.id);
    setCampaignMessage("");
    const { data, error } = await supabase.functions.invoke("meta-set-campaign-status-v1", {
      body: { campaign_id: campaign.id, status: nextStatus },
    });
    setChangingCampaignId(null);
    if (error || !data?.success) {
      // Em respostas 4xx/5xx a mensagem detalhada fica no corpo (error.context).
      let detail: string | undefined = data?.error;
      const context = (error as { context?: Response } | null)?.context;
      if (!detail && context && typeof context.json === "function") {
        try {
          detail = (await context.clone().json())?.error;
        } catch {
          /* sem corpo JSON */
        }
      }
      setCampaignMessage(
        `Não foi possível ${nextStatus === "paused" ? "pausar" : "reativar"} o anúncio: ${detail || error?.message || "erro desconhecido."}`,
      );
      return;
    }
    setCampaigns((current) =>
      current.map((item) =>
        item.id === campaign.id
          ? {
              ...item,
              status: nextStatus,
              ...(nextStatus === "paused"
                ? { meta_delivery_status: "paused", meta_delivery_detail: null }
                : {}),
            }
          : item,
      ),
    );
    setCampaignMessage(
      nextStatus === "paused"
        ? "Seu anúncio foi pausado na Meta."
        : "Seu anúncio foi reativado na Meta.",
    );
    if (nextStatus === "active") void syncMetaDelivery();
    window.dispatchEvent(new Event("autoads:campaigns-changed"));
  }
  async function archiveSellerCampaign(campaign: Campaign) {
    if (campaign.status === "pending") {
      setCampaignMessage("A campanha ainda está sendo publicada. Aguarde alguns segundos.");
      return;
    }
    if (campaign.status === "active" && campaign.meta_campaign_id) {
      setCampaignMessage("Pause o anúncio antes de arquivar a campanha.");
      return;
    }
    const confirmed = window.confirm(
      "Arquivar esta campanha? Ela sai desta lista e não poderá ser reativada. Os resultados e as vendas continuam contando no histórico.",
    );
    if (!confirmed) return;
    setChangingCampaignId(campaign.id);
    setCampaignMessage("");
    const { error } = await (supabase as any).rpc("archive_seller_campaign", {
      p_campaign_id: campaign.id,
    });
    setChangingCampaignId(null);
    if (error) {
      setCampaignMessage(`Não foi possível arquivar a campanha: ${error.message}`);
      return;
    }
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    setCampaignMessage("Campanha arquivada. Os resultados continuam no histórico.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Recarrega para limpar resultados, saldo e campanhas do usuário que saiu.
    window.location.reload();
  }
  if (authenticated === null)
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  if (!authenticated) return <LoginScreen onLoggedIn={() => setAuthenticated(true)} />;
  const totalSpend = myTotals?.spend ?? 0;
  const totalClicks = myTotals?.clicks ?? 0;
  const totalImpressions = myTotals?.impressions ?? 0;
  const totalLeads = myTotals?.conversations ?? 0;
  const totalsReady = myTotals !== null;
  const showTotal = (value: string) => (totalsReady ? value : myDailyLoading ? "…" : "—");
  const meta = metaInsights?.insights;
  const metaFrequency = meta && meta.reach > 0 ? meta.impressions / meta.reach : 0;
  const navigation: { id: SellerView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "inicio", label: "Início", icon: LayoutDashboard },
    { id: "campanhas", label: "Campanhas", icon: Megaphone },
    { id: "resultados", label: "Resultados", icon: BarChart3 },
    { id: "vendas", label: "Vendas", icon: BadgeCheck },
    { id: "meta", label: "Meta Ads", icon: Target },
    { id: "configuracoes", label: "Configurações", icon: Settings },
  ];
  const show = (views: SellerView[]) => views.includes(activeView);
  const navigateTo = (view: SellerView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };
  const goToOffers = () => {
    navigateTo("campanhas");
    window.setTimeout(
      () =>
        document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  return (
    <main className="min-h-screen bg-muted/30">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Megaphone className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">AutoAds</p>
            <p className="text-xs text-muted-foreground">Área do vendedor</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeView === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              key={id}
              onClick={() => navigateTo(id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(profile?.full_name || "V").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile?.full_name || "Vendedor"}</p>
              <p className="truncate text-xs text-muted-foreground">{storeName}</p>
            </div>
          </div>
          <Button className="w-full justify-start" variant="ghost" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
            {/* No computador a marca já está no menu lateral; aqui ela só aparece no celular. */}
            <div className="flex items-center gap-3 lg:invisible">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">AutoAds</p>
                <p className="text-xs text-muted-foreground">Anúncios simples para vendedores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="lg:hidden"
                variant="ghost"
                size="icon"
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPasswordForm((current) => !current);
                  setPasswordMessage("");
                }}
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                Trocar senha
              </Button>
              <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      </div>
      <div className="lg:pl-64">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          {activeView === "inicio" ? (
            <section>
              <p className="text-sm font-medium text-primary">Início</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Olá, {profile?.full_name || "vendedor"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Vendedor · <span className="font-medium text-foreground">{storeName}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha uma oferta e ative seu próximo anúncio.
              </p>
            </section>
          ) : (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight">
                {navigation.find((item) => item.id === activeView)?.label}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{VIEW_DESCRIPTIONS[activeView]}</p>
            </section>
          )}
          {show(["vendas"]) ? <SellerSales /> : null}
          {show(["inicio", "campanhas"]) ? (
            <div className="space-y-3">
              <SellerCampaignAlerts campaigns={campaigns} onChooseOffer={goToOffers} />
              <SellerReadinessChecklist
                hideWhenReady
                refreshKey={`${metaStatus}-${metaAccountName}`}
                onGoToMeta={() => navigateTo("meta")}
              />
            </div>
          ) : null}
          <Card className={show(["inicio", "configuracoes"]) ? "" : "hidden"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" /> Meu perfil
              </CardTitle>
              <CardDescription>Seus dados e a loja à qual você está vinculado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{profile?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Perfil</p>
                  <p className="font-medium">Vendedor</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{whatsapp || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loja</p>
                  <p className="font-semibold text-primary">{storeName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {showPasswordForm && show(["configuracoes"]) ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" /> Trocar senha
                </CardTitle>
                <CardDescription>Atualize sua senha de acesso ao AutoAds.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="max-w-xl space-y-4" onSubmit={changePassword}>
                  <div className="space-y-2">
                    <Label htmlFor="seller-new-password">Nova senha</Label>
                    <PasswordInput
                      id="seller-new-password"
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seller-confirm-password">Confirmar nova senha</Label>
                    <PasswordInput
                      id="seller-confirm-password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Digite a senha novamente"
                      required
                    />
                  </div>
                  <Button disabled={changingPassword} type="submit">
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    {changingPassword ? "Alterando..." : "Alterar senha"}
                  </Button>
                  {passwordMessage ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      {passwordMessage}
                    </p>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          ) : null}
          <section
            className={show(["inicio", "campanhas"]) ? "scroll-mt-24" : "hidden"}
            id="ofertas"
          >
            <div className="mb-3">
              <p className="text-sm font-medium text-primary">Campanhas disponíveis</p>
              <p className="text-sm text-muted-foreground">
                Escolha uma oferta para criar seu próximo anúncio.
              </p>
            </div>
            <CampaignLibrary sellerOnly />
          </section>
          {show(["inicio", "resultados"]) ? (
            <CurrentCampaignPanel
              refreshKey={myTotals ? `${myTotals.spend}-${myTotals.conversations}` : ""}
            />
          ) : null}
          <section className={show(["inicio"]) ? "" : "hidden"}>
            <div className="mb-3">
              <p className="text-sm font-medium text-primary">Resumo geral</p>
              <p className="text-sm text-muted-foreground">
                Todas as suas campanhas somadas · {METRICS_PERIOD_LABEL.toLowerCase()}.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <MetricCard
                label="Campanhas ativas"
                value={`${activeCampaignCount ?? campaigns.filter((campaign) => campaign.status === "active").length}`}
                icon={Megaphone}
              />
              <MetricCard
                label="Investimento"
                value={showTotal(formatCurrency(totalSpend))}
                icon={CircleDollarSign}
              />
              <MetricCard
                label="Impressões"
                value={showTotal(formatMetaNumber(totalImpressions))}
                icon={Eye}
              />
              <MetricCard
                label="Cliques"
                value={showTotal(formatMetaNumber(totalClicks))}
                icon={BarChart3}
              />
              <MetricCard
                label="Conversas iniciadas"
                value={showTotal(formatMetaNumber(totalLeads))}
                icon={MessageCircle}
              />
              <MetricCard
                label="Saldo disponível"
                value={
                  metaBalance
                    ? formatMetaCurrency(metaBalance.balance, metaBalance.currency)
                    : metaBalanceLoading
                      ? "Consultando..."
                      : "—"
                }
                icon={CircleDollarSign}
              />
            </div>
          </section>
          <section className={show(["resultados"]) ? "" : "hidden"}>
            <p className="mb-1 text-sm font-medium text-primary">Geral · todas as campanhas</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {METRICS_PERIOD_LABEL} · mesmos dados do gráfico e dos painéis do gerente.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Investimento"
                value={showTotal(formatCurrency(totalSpend))}
                icon={CircleDollarSign}
              />
              <MetricCard
                label="Impressões"
                value={showTotal(formatMetaNumber(totalImpressions))}
                icon={Eye}
              />
              <MetricCard
                label="Cliques"
                value={showTotal(formatMetaNumber(totalClicks))}
                icon={BarChart3}
              />
              <MetricCard
                label="Conversas iniciadas"
                value={showTotal(formatMetaNumber(totalLeads))}
                icon={MessageCircle}
              />
              <MetricCard
                label="Custo por conversa"
                value={totalLeads > 0 ? formatCurrency(totalSpend / totalLeads) : "—"}
                icon={Users}
              />
            </div>
          </section>
          {show(["inicio"]) ? <SellerSales compact /> : null}
          {show(["resultados"]) ? (
            <SalesSummaryCard
              title="Minhas vendas do mês"
              description="Vendas que você registrou. O gerente confere o número da proposta."
              onOpen={() => navigateTo("vendas")}
              openLabel="Registrar ou ver vendas"
            />
          ) : null}
          <section className={show(["inicio", "resultados"]) ? "" : "hidden"}>
            <ConversationsByDayChart
              daily={myDaily}
              loading={myDailyLoading}
              description="Conversas que os seus anúncios geraram no WhatsApp, últimos 30 dias."
            />
          </section>

          <section className={show(["meta"]) ? "" : "hidden"}>
            {show(["meta"]) ? (
              <div className="mb-4">
                <SellerReadinessChecklist refreshKey={`${metaStatus}-${metaAccountName}`} />
              </div>
            ) : null}
            <section className="grid gap-6 lg:grid-cols-1">
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle>Conexões</CardTitle>
                  <CardDescription>Configure os destinos e canais do seu anúncio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 px-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-muted p-2">
                        <Facebook className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">Meta Ads</p>
                        <p className="break-words text-xs text-muted-foreground">
                          {metaStatus === "connected"
                            ? metaAccountName || "Conta de anúncios conectada"
                            : "Conexão individual do vendedor"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={
                        metaStatus === "connected"
                          ? "border-green-200 bg-green-100 text-green-700 hover:bg-green-100"
                          : ""
                      }
                      variant={
                        metaStatus === "connected"
                          ? "secondary"
                          : metaStatus === "error"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {metaStatus === "connected"
                        ? "Conectado"
                        : metaStatus === "loading"
                          ? "Verificando..."
                          : "Não conectado"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={connectMeta}
                      disabled={metaStatus === "loading" || metaStatus === "connected"}
                    >
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      {metaStatus === "connected"
                        ? "Conta Meta conectada"
                        : "Conectar minha conta Meta"}
                    </Button>
                    {metaStatus === "connected" ? (
                      <Button
                        className="flex-1"
                        variant="destructive"
                        onClick={() => void disconnectMeta()}
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        Desconectar Meta
                      </Button>
                    ) : null}
                  </div>
                  {metaMessage ? (
                    <p className="text-xs text-destructive" role="alert">
                      {metaMessage}
                    </p>
                  ) : null}
                  {metaStatus === "connected" ? (
                    <div className="rounded-xl border border-green-200 bg-green-50/60 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-green-900">Conta Meta real</p>
                          <p className="text-xs text-green-700">
                            Dados financeiros consultados diretamente na Meta
                          </p>
                        </div>
                        {metaBalanceLoading ? (
                          <span className="text-xs text-muted-foreground">Atualizando...</span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="min-w-0 rounded-lg bg-background p-3">
                          <p className="text-xs text-muted-foreground">Saldo Meta</p>
                          <p className="mt-1 break-words text-lg font-semibold sm:text-xl">
                            {metaBalance
                              ? formatMetaCurrency(metaBalance.balance, metaBalance.currency)
                              : metaBalanceLoading
                                ? "Consultando..."
                                : "—"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {metaBalance?.balance_source === "unavailable"
                              ? "A Meta não informa os fundos desta conta. Confira em “Adicionar saldo na Meta” (campo Fundos)."
                              : "Valor retornado pela conta de anúncios"}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-background p-3">
                          <p className="text-xs text-muted-foreground">Gasto acumulado na Meta</p>
                          <p className="mt-1 break-words text-lg font-semibold sm:text-xl">
                            {metaBalance
                              ? formatMetaCurrency(metaBalance.amount_spent, metaBalance.currency)
                              : metaBalanceLoading
                                ? "Consultando..."
                                : "—"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Total informado pela conta de anúncios
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="flex-1"
                          onClick={openMetaBilling}
                          disabled={!metaBalance}
                        >
                          <CircleDollarSign className="mr-2 h-4 w-4" />
                          Adicionar saldo na Meta
                        </Button>
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => void refreshMetaAfterFunding()}
                          disabled={metaBalanceLoading}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Atualizar saldo
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        O pagamento é feito diretamente na Meta. O AutoAds não recebe, guarda ou
                        intermedeia seu dinheiro.
                      </p>
                      {metaBalanceError ? (
                        <p className="mt-3 text-xs text-destructive" role="alert">
                          {metaBalanceError}
                        </p>
                      ) : null}
                      {metaBalance?.fetched_at ? (
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          Atualizado em {new Date(metaBalance.fetched_at).toLocaleString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <section className="meta-performance mt-6">
                    <Card className="border-border/60 bg-background/50 shadow-none">
                      <CardHeader className="px-0 pt-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <CardTitle>Desempenho real da Meta</CardTitle>
                            <CardDescription>
                              Resultados das suas campanhas publicadas pelo AutoAds nos últimos 30
                              dias, direto da Meta.
                            </CardDescription>
                          </div>
                          {metaInsights?.fetched_at ? (
                            <p className="text-xs text-muted-foreground">
                              Atualizado em{" "}
                              {new Date(metaInsights.fetched_at).toLocaleString("pt-BR")}
                            </p>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 px-0">
                        {metaInsightsLoading && !metaInsights ? (
                          <p className="text-sm text-muted-foreground">
                            Consultando os indicadores da Meta...
                          </p>
                        ) : null}
                        {metaInsightsError ? (
                          <p className="text-sm text-destructive" role="alert">
                            {metaInsightsError}
                          </p>
                        ) : null}
                        {meta ? (
                          <>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 meta-results-grid">
                              <MetricCard
                                label="Conversas iniciadas"
                                value={formatMetaNumber(meta.messaging_conversations)}
                                icon={MessageCircle}
                              />
                              <MetricCard
                                label="Investimento"
                                value={formatInsightCurrency(
                                  meta.spend,
                                  metaBalance?.currency || "BRL",
                                )}
                                icon={CircleDollarSign}
                              />
                              <MetricCard
                                label="Custo por conversa"
                                value={
                                  Number(meta.messaging_conversations) > 0
                                    ? formatInsightCurrency(
                                        Number(meta.spend) / Number(meta.messaging_conversations),
                                        metaBalance?.currency || "BRL",
                                      )
                                    : "—"
                                }
                                icon={CircleDollarSign}
                              />
                              <MetricCard
                                label="Impressões"
                                value={formatMetaNumber(meta.impressions)}
                                icon={Eye}
                              />
                              <MetricCard
                                label="Alcance"
                                value={formatMetaNumber(meta.reach)}
                                icon={Users}
                              />
                              <MetricCard
                                label="Cliques"
                                value={formatMetaNumber(meta.clicks)}
                                icon={BarChart3}
                              />
                              <MetricCard
                                label="CTR"
                                value={formatMetaPercent(meta.ctr)}
                                icon={BarChart3}
                              />
                              <MetricCard
                                label="CPC médio"
                                value={formatInsightCurrency(
                                  meta.cpc,
                                  metaBalance?.currency || "BRL",
                                )}
                                icon={CircleDollarSign}
                              />
                            </div>
                            <details className="group rounded-xl border">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-medium">
                                Outros indicadores da Meta
                                <span className="text-xs text-muted-foreground group-open:hidden">
                                  Mostrar
                                </span>
                                <span className="hidden text-xs text-muted-foreground group-open:inline">
                                  Ocultar
                                </span>
                              </summary>
                              <div className="grid grid-cols-2 gap-3 border-t p-3 lg:grid-cols-4 meta-results-grid">
                                <MetricCard
                                  label="CPM médio"
                                  value={formatInsightCurrency(
                                    meta.cpm,
                                    metaBalance?.currency || "BRL",
                                  )}
                                  icon={CircleDollarSign}
                                />
                                <MetricCard
                                  label="Frequência"
                                  value={metaFrequency.toFixed(2).replace(".", ",")}
                                  icon={Eye}
                                />
                                <MetricCard
                                  label="Cliques em links"
                                  value={formatMetaNumber(
                                    meta.link_clicks || meta.inline_link_clicks,
                                  )}
                                  icon={BarChart3}
                                />
                                <MetricCard
                                  label="Leads Meta"
                                  value={formatMetaNumber(meta.leads)}
                                  icon={Users}
                                />
                                <MetricCard
                                  label="Páginas visualizadas"
                                  value={formatMetaNumber(meta.landing_page_views)}
                                  icon={Eye}
                                />
                                <MetricCard
                                  label="Conversões"
                                  value={formatMetaNumber(meta.conversions)}
                                  icon={BarChart3}
                                />
                                <MetricCard
                                  label="Compras"
                                  value={formatMetaNumber(meta.purchases)}
                                  icon={CircleDollarSign}
                                />
                                <MetricCard
                                  label="Adicionar ao carrinho"
                                  value={formatMetaNumber(meta.add_to_cart)}
                                  icon={BarChart3}
                                />
                                <MetricCard
                                  label="Checkouts"
                                  value={formatMetaNumber(meta.initiate_checkout)}
                                  icon={BarChart3}
                                />
                                <MetricCard
                                  label="Reproduções de vídeo"
                                  value={formatMetaNumber(meta.video_plays)}
                                  icon={Eye}
                                />
                                <MetricCard
                                  label="ThruPlays"
                                  value={formatMetaNumber(meta.thruplays)}
                                  icon={Eye}
                                />
                                <MetricCard
                                  label="Vídeo 50%"
                                  value={formatMetaNumber(meta.video_50)}
                                  icon={Eye}
                                />
                                <MetricCard
                                  label="Vídeo 100%"
                                  value={formatMetaNumber(meta.video_100)}
                                  icon={Eye}
                                />
                              </div>
                            </details>
                            {metaInsights.campaigns.length > 0 ? (
                              <div>
                                <h3 className="mb-3 font-medium">Desempenho por campanha</h3>
                                <div className="space-y-2 sm:hidden">
                                  {metaInsights.campaigns.map((item, index) => (
                                    <div
                                      className="rounded-xl border p-3"
                                      key={item.campaign_id || `${item.campaign_name}-m-${index}`}
                                    >
                                      <p className="break-words text-sm font-medium">
                                        {item.campaign_name}
                                      </p>
                                      <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-2 text-xs">
                                        {[
                                          [
                                            "Conversas",
                                            formatMetaNumber(item.messaging_conversations),
                                          ],
                                          [
                                            "Gasto",
                                            formatInsightCurrency(
                                              item.spend,
                                              metaBalance?.currency || "BRL",
                                            ),
                                          ],
                                          ["Cliques", formatMetaNumber(item.clicks)],
                                          ["Impressões", formatMetaNumber(item.impressions)],
                                          ["Alcance", formatMetaNumber(item.reach)],
                                          ["CTR", formatMetaPercent(item.ctr)],
                                        ].map(([label, value]) => (
                                          <div key={label} className="min-w-0">
                                            <dt className="text-muted-foreground">{label}</dt>
                                            <dd className="truncate text-sm font-semibold">
                                              {value}
                                            </dd>
                                          </div>
                                        ))}
                                      </dl>
                                    </div>
                                  ))}
                                </div>
                                <div className="hidden overflow-x-auto rounded-xl border sm:block">
                                  <table className="w-full min-w-[640px] text-sm">
                                    <thead className="bg-muted/40">
                                      <tr>
                                        <th className="p-3 text-left font-medium">Campanha</th>
                                        <th className="p-3 text-right font-medium">Impressões</th>
                                        <th className="p-3 text-right font-medium">Alcance</th>
                                        <th className="p-3 text-right font-medium">Cliques</th>
                                        <th className="p-3 text-right font-medium">CTR</th>
                                        <th className="p-3 text-right font-medium">Gasto</th>
                                        <th className="p-3 text-right font-medium">Conversas</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {metaInsights.campaigns.map((item, index) => (
                                        <tr
                                          className="border-t"
                                          key={item.campaign_id || `${item.campaign_name}-${index}`}
                                        >
                                          <td className="p-3 font-medium">{item.campaign_name}</td>
                                          <td className="p-3 text-right">
                                            {formatMetaNumber(item.impressions)}
                                          </td>
                                          <td className="p-3 text-right">
                                            {formatMetaNumber(item.reach)}
                                          </td>
                                          <td className="p-3 text-right">
                                            {formatMetaNumber(item.clicks)}
                                          </td>
                                          <td className="p-3 text-right">
                                            {formatMetaPercent(item.ctr)}
                                          </td>
                                          <td className="p-3 text-right">
                                            {formatInsightCurrency(
                                              item.spend,
                                              metaBalance?.currency || "BRL",
                                            )}
                                          </td>
                                          <td className="p-3 text-right">
                                            {formatMetaNumber(item.messaging_conversations)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                Nenhuma campanha do AutoAds teve resultados nos últimos 30 dias.
                              </p>
                            )}
                          </>
                        ) : null}
                      </CardContent>
                    </Card>
                  </section>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A conexão usa OAuth oficial. O AutoAds não solicita nem exibe a senha da sua
                    conta Meta.
                  </p>
                  <div className="border-t pt-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">Destino dos seus leads</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="5511999999999"
                        value={whatsapp}
                        onChange={(event) => setWhatsapp(event.target.value)}
                      />
                      <Button onClick={saveWhatsapp} disabled={savingWhatsapp}>
                        {savingWhatsapp ? "Salvando" : "Salvar"}
                      </Button>
                    </div>
                    {message ? (
                      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </section>
          </section>
          <section
            className={show(["inicio", "campanhas", "resultados"]) ? "" : "hidden"}
            id="minhas-campanhas"
          >
            <Card>
              <CardHeader>
                <CardTitle>Minhas campanhas</CardTitle>
                <CardDescription>
                  Acompanhe o status e os resultados dos seus anúncios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.filter((campaign) => !isEndedCampaign(campaign)).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 font-medium">
                      {campaigns.length
                        ? "Nenhuma campanha em andamento"
                        : "Você ainda não tem campanhas"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaigns.length
                        ? "Suas campanhas anteriores terminaram junto com a oferta. Os resultados continuam em Resultados. Escolha uma oferta acima para publicar de novo."
                        : "Escolha uma oferta acima para começar."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns
                      .filter((campaign) => !isEndedCampaign(campaign))
                      .slice(0, 5)
                      .map((campaign) => {
                        const continuous = campaign.duration_days == null;
                        const totalBudget = campaign.total_budget || campaign.budget_amount;
                        const spent = campaign.spent_amount || campaign.spend;
                        const balance = continuous ? 1 : Math.max(0, totalBudget - spent);
                        const spentPercent =
                          totalBudget > 0
                            ? Math.min(100, Math.max(0, (spent / totalBudget) * 100))
                            : 0;
                        // Sem ID na Meta a campanha nunca foi publicada: mostra o erro e esconde pausar/reativar.
                        const unpublished =
                          !campaign.meta_campaign_id && campaign.status !== "pending";
                        const campaignIsActive = campaign.status === "active" && !unpublished;
                        // Terminou junto com a oferta (ou o período): não dá mais para reativar.
                        const ended =
                          !campaignIsActive &&
                          !unpublished &&
                          Boolean(campaign.end_date) &&
                          new Date(campaign.end_date as string).getTime() <= Date.now();
                        const delivery = unpublished ? null : deliveryBadge(campaign);
                        const deliveryNote = delivery
                          ? [delivery.hint, campaign.meta_delivery_detail].filter(Boolean).join(" ")
                          : "";

                        return (
                          <div
                            className="group overflow-hidden rounded-xl border bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                            key={campaign.id}
                          >
                            <div className="flex flex-col gap-4 p-4 sm:p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Megaphone className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-semibold">
                                      {campaign.name}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {continuous
                                          ? `Desde ${formatCampaignDate(campaign.start_date)}${campaign.end_date ? ` · até ${formatCampaignDate(campaign.end_date)} (fim da oferta)` : ""}`
                                          : `${formatCampaignDate(campaign.start_date)} até ${formatCampaignDate(campaign.end_date)}`}
                                      </span>
                                      <span className="text-border">•</span>
                                      <span>
                                        {continuous
                                          ? `Contínua · ${formatCurrency(campaign.daily_budget)}/dia até acabar o saldo`
                                          : `${campaign.duration_days || 0} dias de veiculação`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                  <Badge
                                    variant={
                                      unpublished
                                        ? "destructive"
                                        : balance <= 0
                                          ? "destructive"
                                          : delivery
                                            ? delivery.variant
                                            : statusVariant(campaign.status)
                                    }
                                  >
                                    {unpublished
                                      ? "Não publicada"
                                      : balance <= 0
                                        ? "Orçamento esgotado"
                                        : delivery
                                          ? delivery.label
                                          : statusLabel(campaign.status)}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label="Arquivar campanha"
                                    title="Arquivar campanha (o histórico continua nos resultados)"
                                    disabled={changingCampaignId === campaign.id}
                                    onClick={() => void archiveSellerCampaign(campaign)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {ended ? (
                                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                                  A oferta desta campanha venceu, então ela não pode ser reativada.
                                  Arquive pelo ícone da lixeira (o histórico continua nos
                                  resultados) ou peça ao gerente para renovar a oferta e publicar as
                                  alterações.
                                </p>
                              ) : null}
                              {unpublished ? (
                                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                  A Meta não publicou esta campanha
                                  {campaign.error_message
                                    ? `: ${campaign.error_message.replace(/^Etapa: [^|]+\| (Código Meta: [^|]+\| )?Mensagem: /, "").replace(/ \| fbtrace_id: .*$/, "")}`
                                    : "."}{" "}
                                  Exclua este card e publique de novo depois de resolver.
                                </p>
                              ) : null}
                              {deliveryNote ? (
                                <p
                                  className={`rounded-lg px-3 py-2 text-xs ${
                                    delivery?.variant === "destructive"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-muted/40 text-muted-foreground"
                                  }`}
                                >
                                  {deliveryNote}
                                </p>
                              ) : null}

                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">
                                    {continuous ? "Orçamento por dia" : "Orçamento total"}
                                  </p>
                                  <p className="mt-1 text-base font-semibold">
                                    {formatCurrency(
                                      continuous ? campaign.daily_budget : totalBudget,
                                    )}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">
                                    Gasto até agora
                                  </p>
                                  <p className="mt-1 text-base font-semibold">
                                    {formatCurrency(spent)}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">
                                    {continuous ? "Saldo na conta Meta" : "Saldo disponível"}
                                  </p>
                                  <p className="mt-1 text-base font-semibold">
                                    {continuous
                                      ? metaBalance
                                        ? formatMetaCurrency(
                                            metaBalance.balance,
                                            metaBalance.currency,
                                          )
                                        : "—"
                                      : formatCurrency(balance)}
                                  </p>
                                </div>
                              </div>

                              <div className={continuous ? "hidden" : ""}>
                                <div className="mb-2 flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    Consumo do orçamento
                                  </span>
                                  <span className="font-medium">{Math.round(spentPercent)}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${spentPercent}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>
                                    <strong className="font-semibold text-foreground">
                                      {campaign.leads_count || 0}
                                    </strong>{" "}
                                    {campaign.leads_count === 1 ? "conversa" : "conversas"}
                                  </span>
                                  <span>
                                    <strong className="font-semibold text-foreground">
                                      {campaign.clicks || 0}
                                    </strong>{" "}
                                    cliques
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant={campaignIsActive ? "outline" : "default"}
                                  disabled={changingCampaignId === campaign.id}
                                  className={unpublished || ended ? "hidden" : ""}
                                  onClick={() => void toggleSellerCampaign(campaign)}
                                >
                                  {campaignIsActive ? (
                                    <Pause className="mr-2 h-4 w-4" />
                                  ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                  )}
                                  {changingCampaignId === campaign.id
                                    ? "Alterando..."
                                    : campaignIsActive
                                      ? "Pausar anúncio"
                                      : "Reativar anúncio"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {campaignMessage ? (
                  <p className="mt-3 text-sm text-muted-foreground" role="status">
                    {campaignMessage}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>
          <footer className="pb-4 text-center text-xs text-muted-foreground">
            Gestão de anúncios para vendedores. Meta Ads e WhatsApp serão conectados por integrações
            oficiais.
          </footer>
        </div>
      </div>
    </main>
  );
}

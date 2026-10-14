import { useEffect, useState } from "react";
import { CheckCircle2, Facebook, Loader2, LogOut, ShieldCheck, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const META_OAUTH_RESULT_KEY = "autoads-meta-oauth-result";

type MetaStatus = "loading" | "connected" | "disconnected" | "error";

type MetaConnection = {
  status: string | null;
};

type MetaAccount = {
  name: string | null;
  external_account_id: string | null;
  status: string | null;
};

export function MetaAdsConnection() {
  const [status, setStatus] = useState<MetaStatus>("loading");
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshConnection(userId?: string) {
    const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!id) {
      setStatus("disconnected");
      return;
    }

    const [connectionResult, accountResult] = await Promise.all([
      supabase
        .from("meta_connections_v2")
        .select("status")
        .eq("seller_id", id)
        .eq("provider", "meta")
        .maybeSingle(),
      supabase
        .from("meta_ad_accounts_v2")
        .select("name, external_account_id, status")
        .eq("seller_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (connectionResult.error && connectionResult.error.code !== "PGRST116") {
      setStatus("error");
      setMessage(connectionResult.error.message);
      return;
    }

    const connection = connectionResult.data as MetaConnection | null;
    if (connection?.status === "connected") {
      setStatus("connected");
      setAccount((accountResult.data as MetaAccount | null) ?? null);
      setMessage("");
      return;
    }

    if (connection?.status === "error") {
      setStatus("error");
      setAccount(null);
      return;
    }

    setStatus("disconnected");
    setAccount(null);
  }

  useEffect(() => {
    void refreshConnection();

    const handleOAuthStatus = (oauthStatus: string) => {
      if (oauthStatus !== "connected" && oauthStatus !== "error") return;
      if (oauthStatus === "error") {
        setStatus("error");
        setMessage("A Meta não conseguiu concluir a conexão. Tente novamente.");
        setBusy(false);
        return;
      }
      setBusy(false);
      setMessage("");
      void refreshConnection();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "autoads-meta-oauth") return;
      handleOAuthStatus(event.data.status);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== META_OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        handleOAuthStatus(payload.status);
      } catch {
        /* ignore malformed storage payload */
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("autoads-meta-oauth");
      channel.addEventListener("message", (event) => handleOAuthStatus(event.data?.status));
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  async function connect() {
    setBusy(true);
    setMessage("");
    setStatus("loading");
    try {
      window.localStorage.removeItem(META_OAUTH_RESULT_KEY);
    } catch {
      /* ignore storage restrictions */
    }

    const { data, error } = await supabase.functions.invoke("meta-oauth-callback-v1", {
      body: { return_to: window.location.href },
    });

    if (error || !data?.url) {
      setBusy(false);
      setStatus("error");
      setMessage(error?.message || data?.error || "Não foi possível iniciar a conexão Meta.");
      return;
    }

    const popup = window.open(
      data.url,
      "autoads-meta-oauth",
      "popup,width=600,height=760,resizable=yes,scrollbars=yes",
    );

    if (!popup) {
      setBusy(false);
      setStatus("disconnected");
      setMessage("O navegador bloqueou a janela da Meta. Permita pop-ups para continuar.");
      return;
    }

    const startedAt = Date.now();
    const pollTimer = window.setInterval(async () => {
      if (popup.closed) {
        window.clearInterval(pollTimer);
        if (Date.now() - startedAt > 2500) {
          await refreshConnection();
          setBusy(false);
        }
      }
    }, 1000);

    window.setTimeout(() => window.clearInterval(pollTimer), 120000);
  }

  async function disconnect() {
    const confirmed = window.confirm(
      "Desconectar sua conta Meta? O AutoAds deixará de consultar e usar essa autorização até que você conecte novamente.",
    );
    if (!confirmed) return;

    setBusy(true);
    setStatus("loading");
    setMessage("");
    const { data, error } = await supabase.functions.invoke("meta-oauth-disconnect-v1", { body: {} });

    if (error || !data?.success) {
      setBusy(false);
      setStatus("connected");
      setMessage(error?.message || data?.error || "Não foi possível desconectar a conta Meta.");
      return;
    }

    setBusy(false);
    setStatus("disconnected");
    setAccount(null);
    setMessage(data?.warning ? `Conta desconectada. ${data.warning}` : "Conta Meta desconectada com sucesso.");
  }

  const connected = status === "connected";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Meta Ads</CardTitle>
              <CardDescription>
                Conecte a conta Meta do gerente para consultar a conta de anúncios vinculada a este acesso.
              </CardDescription>
            </div>
            <Badge variant={connected ? "default" : "outline"} className="w-fit gap-1">
              {connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Facebook className="h-3.5 w-3.5" />}
              {connected ? "Conectado" : status === "loading" ? "Verificando..." : "Não conectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Autorização</p>
              <p className="mt-1 font-semibold">Meta Login for Business</p>
              <p className="mt-1 text-sm text-muted-foreground">A autorização acontece diretamente na Meta.</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conta de anúncios</p>
              <p className="mt-1 font-semibold">{account?.name || "Nenhuma vinculada"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{account?.external_account_id || "Conecte a Meta para identificar a conta."}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Segurança</p>
              <p className="mt-1 font-semibold">Tokens no backend</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Nenhum token privado é exibido aqui.</p>
            </div>
          </div>

          {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={connected ? disconnect : connect} disabled={busy || status === "loading"} className="gap-2">
              {busy || status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : connected ? <Unplug className="h-4 w-4" /> : <Facebook className="h-4 w-4" />}
              {busy || status === "loading" ? "Processando..." : connected ? "Desconectar Meta" : "Conectar Meta Ads"}
            </Button>
            {connected ? <Badge variant="secondary" className="w-fit">Conta vinculada a este gerente</Badge> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed shadow-none">
        <CardContent className="flex items-start gap-3 p-5">
          <LogOut className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">Cada acesso possui sua própria autorização</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A conexão do gerente é independente das conexões dos vendedores. O gerente não passa a administrar a conta Meta de outro vendedor por estar conectado.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

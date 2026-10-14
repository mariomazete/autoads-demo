import { useEffect, useState } from "react";
import { Bell, Building2, Check, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

type ManagerSettingsProps = { onLogout: () => Promise<void> };
const preferenceKey = "autoads.manager.settings";

type Preferences = {
  period: "7" | "30" | "90";
  sellerWithoutCampaign: boolean;
  campaignError: boolean;
  campaignWithoutMetrics: boolean;
  metaConnectionError: boolean;
  staleData: boolean;
};

const defaultPreferences: Preferences = {
  period: "30", sellerWithoutCampaign: true, campaignError: true,
  campaignWithoutMetrics: true, metaConnectionError: true, staleData: true,
};

export function ManagerSettings({ onLogout }: ManagerSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({ full_name: "", email: "", whatsapp: "", job_title: "Gerente" });
  const [store, setStore] = useState({ id: "", name: "Minha loja" });
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  useEffect(() => {
    const stored = window.localStorage.getItem(preferenceKey);
    if (stored) {
      try { setPreferences({ ...defaultPreferences, ...JSON.parse(stored) }); } catch { /* ignore invalid local preference */ }
    }

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setError("Sessão não encontrada."); setLoading(false); return; }
      const { data: profileData, error: profileError } = await supabase
        .from("profiles").select("full_name,email,whatsapp,job_title,store_id").eq("id", auth.user.id).single();
      if (profileError) setError(profileError.message);
      if (profileData) {
        setProfile({ full_name: profileData.full_name || "", email: profileData.email || auth.user.email || "", whatsapp: profileData.whatsapp || "", job_title: profileData.job_title || "Gerente" });
        if (profileData.store_id) {
          const { data: storeData } = await supabase.from("stores").select("id,name").eq("id", profileData.store_id).single();
          if (storeData) setStore(storeData);
        }
      }
      setLoading(false);
    }
    void load();
  }, []);

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function saveAccount() {
    setSavingAccount(true); setAccountSaved(false); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sessão não encontrada."); setSavingAccount(false); return; }
    const { error: updateError } = await supabase.from("profiles").update({ full_name: profile.full_name, whatsapp: profile.whatsapp }).eq("id", auth.user.id);
    if (updateError) setError(updateError.message);
    else { setAccountSaved(true); window.setTimeout(() => setAccountSaved(false), 3000); }
    setSavingAccount(false);
  }

  function savePreferences() {
    setSaving(true);
    window.localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    window.setTimeout(() => { setSaving(false); setSaved(true); }, 250);
  }

  async function changePassword() {
    setChangingPassword(true); setPasswordMessage(""); setError("");
    const { error: passwordError } = await supabase.auth.updateUser({ password: window.prompt("Digite a nova senha:") || "" });
    if (passwordError) setError(passwordError.message);
    else setPasswordMessage("Senha atualizada com sucesso.");
    setChangingPassword(false);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando configurações...</div>;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-primary">Minha loja</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground">Conta, loja e preferências do painel do gerente.</p>
      </section>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Minha conta</CardTitle><CardDescription>Dados do gerente conectado ao AutoAds.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome</Label><Input value={profile.full_name} onChange={(e) => { setProfile({ ...profile, full_name: e.target.value }); setAccountSaved(false); }} /></div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={profile.job_title} disabled /></div>
            </div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={profile.email} disabled /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={profile.whatsapp} onChange={(e) => { setProfile({ ...profile, whatsapp: e.target.value }); setAccountSaved(false); }} placeholder="(00) 00000-0000" /></div>
            <div className="flex flex-wrap gap-2 pt-1"><Badge variant="secondary">Gerente</Badge><Badge variant="outline">Loja vinculada</Badge></div>
            <p className="text-xs text-muted-foreground">O vínculo com a loja e suas permissões não podem ser alterados pelo gerente.</p>
            <div className="flex justify-end"><Button onClick={() => void saveAccount()} disabled={savingAccount} className="gap-2">{accountSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{savingAccount ? "Salvando..." : accountSaved ? "Dados salvos" : "Salvar dados"}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Minha loja</CardTitle><CardDescription>Informações da loja vinculada à sua conta.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Loja</p><p className="mt-1 text-lg font-semibold">{store.name}</p><p className="mt-1 text-xs text-muted-foreground">ID interno: {store.id || "—"}</p></div>
            <div className="flex items-start gap-3 rounded-lg border p-4"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Acesso restrito à loja</p><p className="mt-1 text-sm text-muted-foreground">Vendedores, campanhas e métricas ficam isolados das demais lojas.</p></div></div>
            <p className="text-xs text-muted-foreground">Alterações estruturais da loja são feitas pelo administrador Master.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><div className="flex items-center gap-3"><Save className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Preferências do painel</CardTitle><CardDescription>Defina como o gerente visualiza os dados.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-5">
            <div><Label>Período padrão das métricas</Label><div className="mt-2 flex flex-wrap gap-2">{(["7", "30", "90"] as const).map((period) => <Button key={period} type="button" variant={preferences.period === period ? "default" : "outline"} size="sm" onClick={() => updatePreference("period", period)}>{period} dias</Button>)}</div></div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <PreferenceRow label="Vendedor sem campanha ativa" checked={preferences.sellerWithoutCampaign} onChange={(value) => updatePreference("sellerWithoutCampaign", value)} />
              <PreferenceRow label="Campanha com erro" checked={preferences.campaignError} onChange={(value) => updatePreference("campaignError", value)} />
              <PreferenceRow label="Campanha ativa sem métricas" checked={preferences.campaignWithoutMetrics} onChange={(value) => updatePreference("campaignWithoutMetrics", value)} />
              <PreferenceRow label="Falha na conexão Meta" checked={preferences.metaConnectionError} onChange={(value) => updatePreference("metaConnectionError", value)} />
              <PreferenceRow label="Dados sem atualização recente" checked={preferences.staleData} onChange={(value) => updatePreference("staleData", value)} />
            </div>
            <div className="flex items-center justify-end gap-3"><span className="text-xs text-muted-foreground">{saved ? "Preferências salvas neste dispositivo." : ""}</span><Button onClick={savePreferences} disabled={saving} className="gap-2">{saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saving ? "Salvando..." : "Salvar preferências"}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-3"><Bell className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Alertas da loja</CardTitle><CardDescription>Os mesmos alertas usados no Dashboard.</CardDescription></div></div></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">As preferências acima definem quais situações aparecem como atenção para o gerente.</p></CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Segurança</CardTitle><CardDescription>Controles da sua sessão.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => void changePassword()} disabled={changingPassword}>Alterar senha</Button>
            {passwordMessage && <p className="text-xs text-primary">{passwordMessage}</p>}
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => void onLogout()}>Sair desta conta</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreferenceRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border p-4"><div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">Exibir este alerta para o gerente.</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

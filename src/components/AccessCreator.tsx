import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Role = "ADMIN_MASTER" | "ADMIN_LOJA" | "VENDEDOR";
type Company = { id: string; name: string };
type Store = { id: string; company_id: string; name: string };

const roles = [
  { value: "ADMIN_MASTER" as Role, label: "Master", description: "Controle global da plataforma" },
  { value: "ADMIN_LOJA" as Role, label: "Gerente", description: "Administração de uma loja" },
  { value: "VENDEDOR" as Role, label: "Vendedor", description: "Acesso às próprias campanhas" },
];

export function AccessCreator({ onCreated }: { onCreated?: () => void } = {}) {
  const [role, setRole] = useState<Role>("VENDEDOR");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredStores = useMemo(
    () => stores.filter((store) => store.company_id === companyId),
    [stores, companyId],
  );

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Sessão não encontrada.");
        setLoading(false);
        return;
      }

      const [profileResult, companiesResult] = await Promise.all([
        supabase.from("profiles").select("group_id").eq("id", userData.user.id).single(),
        supabase.from("companies").select("id,name").order("name"),
      ]);

      if (profileResult.error || companiesResult.error) {
        setError(
          profileResult.error?.message ||
            companiesResult.error?.message ||
            "Não foi possível carregar os dados.",
        );
      }

      setGroupId(profileResult.data?.group_id ?? null);
      setCompanies(companiesResult.data ?? []);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStoresForCompany() {
      if (!companyId) {
        setStores([]);
        setStoreId("");
        setStoresLoading(false);
        return;
      }

      setStoresLoading(true);
      setError("");
      setStoreId("");

      const { data, error: storesError } = await supabase
        .from("stores")
        .select("id,company_id,name")
        .eq("company_id", companyId)
        .order("name");

      if (cancelled) return;

      if (storesError) {
        setStores([]);
        setError(storesError.message || "Não foi possível carregar as lojas da empresa.");
      } else {
        setStores(data ?? []);
      }

      setStoresLoading(false);
    }

    loadStoresForCompany();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Nome, e-mail e senha de no mínimo 8 caracteres são obrigatórios.");
      return;
    }

    if (role !== "ADMIN_MASTER" && (!companyId || !storeId)) {
      setError("Empresa e loja são obrigatórias para Gerente e Vendedor.");
      return;
    }

    const store = stores.find((item) => item.id === storeId);
    if (role !== "ADMIN_MASTER" && (!store || store.company_id !== companyId)) {
      setError("A loja selecionada não pertence à empresa escolhida.");
      return;
    }

    setSaving(true);

    const fn =
      role === "ADMIN_MASTER"
        ? "admin-manage-user-v1"
        : role === "ADMIN_LOJA"
          ? "admin-create-manager-v1"
          : "admin-create-seller-v5";

    const body =
      role === "ADMIN_MASTER"
        ? {
            action: "create",
            role,
            full_name: name.trim(),
            email: email.trim(),
            password,
            whatsapp: whatsapp.trim(),
          }
        : {
            full_name: name.trim(),
            email: email.trim(),
            password,
            whatsapp: whatsapp.trim(),
            company_id: companyId,
            store_id: storeId,
            group_id: groupId,
          };

    const { data, error: invokeError } = await supabase.functions.invoke(fn, { body });

    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || "Não foi possível criar o acesso.");
    } else {
      setName("");
      setEmail("");
      setPassword("");
      setWhatsapp("");
      setCompanyId("");
      setStoreId("");
      setMessage(`${roles.find((item) => item.value === role)?.label} criado com sucesso.`);
      onCreated?.();
    }

    setSaving(false);
  }

  const selected = roles.find((item) => item.value === role)!;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Criar novo acesso</CardTitle>
            <CardDescription>
              Selecione a função para abrir os campos correspondentes.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="mb-5 grid gap-2 sm:grid-cols-3"
          role="tablist"
          aria-label="Função do novo acesso"
        >
          {roles.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={role === item.value}
              onClick={() => {
                setRole(item.value);
                setCompanyId("");
                setStoreId("");
                setError("");
                setMessage("");
              }}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                role === item.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>

        {(message || error) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
              error
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-primary/20 bg-primary/5"
            }`}
          >
            {error || message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <form id="access-creator-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Senha provisória</Label>
              <PasswordInput
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {role !== "ADMIN_MASTER" && (
              <>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      setStoreId("");
                    }}
                    required
                  >
                    <option value="">Selecione a empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Loja</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    disabled={!companyId || storesLoading}
                    required
                  >
                    <option value="">
                      {!companyId
                        ? "Selecione primeiro a empresa"
                        : storesLoading
                          ? "Carregando lojas..."
                          : "Selecione a loja"}
                    </option>
                    {filteredStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </form>
        )}

        {!loading && (
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" form="access-creator-form" disabled={saving || storesLoading}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {saving ? "Criando..." : `Criar ${selected.label}`}
            </Button>
            <span className="text-xs text-muted-foreground">{selected.description}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

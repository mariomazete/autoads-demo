import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Store, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Brand = {
  id: string;
  name: string;
};

type Store = {
  id: string;
  company_id: string;
  brand_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string;
};

type Mode = "companies" | "stores";

type CompanyForm = {
  name: string;
};

type StoreForm = {
  companyId: string;
  brandId: string;
  name: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  city: string;
  state: string;
};

const emptyStore: StoreForm = {
  companyId: "",
  brandId: "",
  name: "",
  zipCode: "",
  address: "",
  number: "",
  complement: "",
  city: "",
  state: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminStructure({ mode }: { mode: Mode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeCounts, setStoreCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({ name: "" });
  const [storeForm, setStoreForm] = useState<StoreForm>(emptyStore);

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const brandMap = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand.name])),
    [brands],
  );

  async function loadData() {
    setLoading(true);
    setError("");

    const [companiesResult, brandsResult, storesResult] = await Promise.all([
      supabase
        .from("companies")
        .select("id,name,slug,status")
        .order("name"),
      supabase.from("brands").select("id,name").eq("active", true).order("name"),
      supabase
        .from("stores")
        .select("id,company_id,brand_id,name,address,city,state,zip_code,status")
        .order("name"),
    ]);

    if (companiesResult.error || brandsResult.error || storesResult.error) {
      setError(
        companiesResult.error?.message ||
          brandsResult.error?.message ||
          storesResult.error?.message ||
          "Não foi possível carregar a estrutura.",
      );
    }

    const loadedCompanies = companiesResult.data ?? [];
    const loadedStores = storesResult.data ?? [];

    const counts = loadedStores.reduce<Record<string, number>>((result, store) => {
      result[store.company_id] = (result[store.company_id] ?? 0) + 1;
      return result;
    }, {});

    setCompanies(loadedCompanies);
    setBrands(brandsResult.data ?? []);
    setStores(loadedStores);
    setStoreCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const zip = storeForm.zipCode.replace(/\D/g, "");
    if (zip.length !== 8) return;

    let cancelled = false;
    setCepLoading(true);
    setError("");

    fetch(`https://viacep.com.br/ws/${zip}/json/`)
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.erro) throw new Error("CEP não encontrado.");

        setStoreForm((current) => ({
          ...current,
          address: data.logradouro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "CEP inválido.");
        }
      })
      .finally(() => {
        if (!cancelled) setCepLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeForm.zipCode]);

  function openNewCompany() {
    setEditingCompany(null);
    setCompanyForm({ name: "" });
    setMessage("");
    setError("");
    setCompanyDialogOpen(true);
  }

  function openEditCompany(company: Company) {
    setEditingCompany(company);
    setCompanyForm({ name: company.name });
    setMessage("");
    setError("");
    setCompanyDialogOpen(true);
  }

  function openNewStore() {
    setEditingStore(null);
    setStoreForm(emptyStore);
    setMessage("");
    setError("");
    setStoreDialogOpen(true);
  }

  function openEditStore(store: Store) {
    const addressParts = (store.address ?? "").split(",").map((part) => part.trim());

    setEditingStore(store);
    setStoreForm({
      companyId: store.company_id,
      brandId: store.brand_id ?? "",
      name: store.name,
      zipCode: store.zip_code ?? "",
      address: addressParts[0] ?? "",
      number: addressParts[1] ?? "",
      complement: addressParts.slice(2).join(", "),
      city: store.city ?? "",
      state: store.state ?? "",
    });
    setMessage("");
    setError("");
    setStoreDialogOpen(true);
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();

    if (!companyForm.name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const groupId = (await supabase.rpc("current_group_id")).data;
    if (!editingCompany && !groupId) {
      setError("Não foi possível identificar o grupo desta conta.");
      setSaving(false);
      return;
    }

    const result = editingCompany
      ? await supabase
          .from("companies")
          .update({
            name: companyForm.name.trim(),
            slug: slugify(companyForm.name),
          })
          .eq("id", editingCompany.id)
      : await supabase.from("companies").insert({
          name: companyForm.name.trim(),
          slug: slugify(companyForm.name),
          group_id: groupId ?? "",
          status: "active",
        });

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage(editingCompany ? "Empresa atualizada." : "Empresa criada.");
      setCompanyDialogOpen(false);
      await loadData();
    }

    setSaving(false);
  }

  async function saveStore(event: FormEvent) {
    event.preventDefault();

    const zip = storeForm.zipCode.replace(/\D/g, "");
    if (
      !storeForm.companyId ||
      !storeForm.brandId ||
      !storeForm.name.trim() ||
      zip.length !== 8 ||
      !storeForm.address.trim() ||
      !storeForm.number.trim() ||
      !storeForm.city.trim() ||
      !storeForm.state.trim()
    ) {
      setError("Preencha empresa, marca, nome, CEP, número e endereço.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const address = [
      storeForm.address.trim(),
      storeForm.number.trim(),
      storeForm.complement.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    const values = {
      company_id: storeForm.companyId,
      brand_id: storeForm.brandId,
      name: storeForm.name.trim(),
      address,
      zip_code: zip,
      city: storeForm.city.trim(),
      state: storeForm.state.trim(),
    };

    const groupId = (await supabase.rpc("current_group_id")).data;
    if (!editingStore && !groupId) {
      setError("Não foi possível identificar o grupo desta conta.");
      setSaving(false);
      return;
    }

    const result = editingStore
      ? await supabase.from("stores").update(values).eq("id", editingStore.id)
      : await supabase.from("stores").insert({
          ...values,
          group_id: groupId ?? "",
          latitude: 0,
          longitude: 0,
          default_radius_km: 10,
          status: "active",
        });

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage(editingStore ? "Loja atualizada." : "Loja criada.");
      setStoreDialogOpen(false);
      await loadData();
    }

    setSaving(false);
  }

  async function deleteCompany(company: Company) {
    const { count } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);

    if ((count ?? 0) > 0) {
      setError(
        `Não é possível excluir "${company.name}". Existem ${count} loja(s) vinculada(s).`,
      );
      return;
    }

    if (!window.confirm(`Excluir a empresa "${company.name}"?`)) return;

    const { error: deleteError } = await supabase
      .from("companies")
      .delete()
      .eq("id", company.id);

    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Empresa excluída.");
      await loadData();
    }
  }

  async function deleteStore(store: Store) {
    const [profiles, campaigns, vehicles] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
      supabase
        .from("seller_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
      supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
    ]);

    const dependencies =
      (profiles.count ?? 0) + (campaigns.count ?? 0) + (vehicles.count ?? 0);

    if (dependencies > 0) {
      setError(
        `Não é possível excluir "${store.name}". A loja possui registros vinculados: ${profiles.count ?? 0} usuário(s), ${campaigns.count ?? 0} campanha(s) e ${vehicles.count ?? 0} veículo(s).`,
      );
      return;
    }

    if (!window.confirm(`Excluir a loja "${store.name}"?`)) return;

    const { error: deleteError } = await supabase
      .from("stores")
      .delete()
      .eq("id", store.id);

    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Loja excluída.");
      await loadData();
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando estrutura da operação...
        </CardContent>
      </Card>
    );
  }

  const isCompanies = mode === "companies";

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Operação</p>
          <h2 className="mt-1 text-2xl font-semibold">
            {isCompanies ? "Empresas" : "Lojas"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCompanies
              ? "Gerencie as empresas cadastradas na plataforma."
              : "Gerencie as lojas, marcas e endereços da operação."}
          </p>
        </div>

        <Button onClick={isCompanies ? openNewCompany : openNewStore}>
          <Plus className="mr-2 h-4 w-4" />
          {isCompanies ? "Criar empresa" : "Criar loja"}
        </Button>
      </div>

      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          {error || message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isCompanies ? "Empresas cadastradas" : "Lojas cadastradas"}</CardTitle>
          <CardDescription>
            {isCompanies
              ? `${companies.length} empresa(s) cadastrada(s).`
              : `${stores.length} loja(s) cadastrada(s).`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isCompanies ? (
            <div className="divide-y divide-border">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {storeCounts[company.id] ?? 0} loja(s) vinculada(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={company.status === "active" ? "default" : "secondary"}>
                      {company.status === "active" ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => openEditCompany(company)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteCompany(company)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}

              {!companies.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{store.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {companyMap.get(store.company_id) ?? "Empresa não identificada"} ·{" "}
                        {brandMap.get(store.brand_id ?? "") ?? "Marca não definida"} ·{" "}
                        {[store.city, store.state].filter(Boolean).join(" / ") || "Localização não informada"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={store.status === "active" ? "default" : "secondary"}>
                      {store.status === "active" ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => openEditStore(store)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteStore(store)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}

              {!stores.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma loja cadastrada.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Editar empresa" : "Criar empresa"}</DialogTitle>
            <DialogDescription>
              Informe os dados básicos da empresa.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={saveCompany}>
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da empresa</Label>
              <Input
                id="company-name"
                value={companyForm.name}
                onChange={(event) =>
                  setCompanyForm({ name: event.target.value })
                }
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompanyDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Editar loja" : "Criar loja"}</DialogTitle>
            <DialogDescription>
              Mantenha a loja vinculada à empresa e à marca corretas.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveStore}>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={storeForm.companyId}
                onChange={(event) =>
                  setStoreForm((current) => ({
                    ...current,
                    companyId: event.target.value,
                  }))
                }
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
              <Label>Marca</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={storeForm.brandId}
                onChange={(event) =>
                  setStoreForm((current) => ({
                    ...current,
                    brandId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Selecione a marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Nome da loja</Label>
              <Input
                value={storeForm.name}
                onChange={(event) =>
                  setStoreForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={storeForm.zipCode}
                onChange={(event) =>
                  setStoreForm((current) => ({
                    ...current,
                    zipCode: event.target.value,
                  }))
                }
                inputMode="numeric"
                maxLength={9}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={storeForm.number}
                onChange={(event) =>
                  setStoreForm((current) => ({
                    ...current,
                    number: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Logradouro</Label>
              <Input value={storeForm.address} readOnly className="bg-muted/30" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Complemento</Label>
              <Input
                value={storeForm.complement}
                onChange={(event) =>
                  setStoreForm((current) => ({
                    ...current,
                    complement: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={storeForm.city} readOnly className="bg-muted/30" />
            </div>

            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={storeForm.state} readOnly className="bg-muted/30" />
            </div>

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setStoreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || cepLoading}>
                {saving || cepLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar loja
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, Plus, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Template = { id: string; brand_id: string | null; title: string | null; model: string | null; version: string | null };
type Mode = "new" | "library";
type UploadedMedia = { mediaUrl: string; mediaType: "image" | "video"; position: number };

export function ManagerCampaignCreator() {
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("Minha loja");
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("Minha marca");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mode, setMode] = useState<Mode>("new");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [model, setModel] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [offerCondition, setOfferCondition] = useState("");
  const [price, setPrice] = useState("");
  const [promotionalPrice, setPromotionalPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState("14");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  async function load() {
    setLoading(true);
    setError("");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setError("Sessão não encontrada.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (profileError || !profile?.store_id) {
      setError("Gerente sem loja vinculada.");
      setLoading(false);
      return;
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id,name,brand_id")
      .eq("id", profile.store_id)
      .maybeSingle();

    if (storeError || !store) {
      setError("Não foi possível carregar a loja do gerente.");
      setLoading(false);
      return;
    }

    setStoreId(store.id);
    setStoreName(store.name);
    setBrandId(store.brand_id ?? "");

    if (store.brand_id) {
      const [{ data: brand }, { data: library }] = await Promise.all([
        supabase.from("brands").select("name").eq("id", store.brand_id).maybeSingle(),
        supabase
          .from("campaign_templates")
          .select("id,brand_id,title,model,version")
          .eq("brand_id", store.brand_id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      setBrandName(brand?.name ?? "Marca da loja");
      setTemplates((library ?? []) as Template[]);
    } else {
      setTemplates([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function resetNewCampaign() {
    setTitle("");
    setModel("");
    setVersion("");
    setDescription("");
    setOfferCondition("");
    setPrice("");
    setPromotionalPrice("");
    setStartDate("");
    setEndDate("");
    setFiles([]);
    setMessage("");
    setError("");
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    if (selected.length > 10) {
      setError("Você pode selecionar no máximo 10 fotos para o conjunto do carrossel.");
      event.target.value = "";
      return;
    }
    const invalid = selected.some((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setError("O conjunto do carrossel aceita apenas fotos. Para vídeo, use uma única mídia.");
      event.target.value = "";
      return;
    }
    setError("");
    setFiles(selected);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function uploadMedia() {
    if (!files.length) return { items: [] as UploadedMedia[], error: null as string | null };
    const items: UploadedMedia[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = file.name.split(".").pop() || "jpg";
      const path = `manager/${storeId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("campaign-media").upload(path, file, { upsert: false });
      if (uploadError) return { items: [], error: uploadError.message };
      const mediaUrl = supabase.storage.from("campaign-media").getPublicUrl(path).data.publicUrl;
      items.push({ mediaUrl, mediaType: "image", position: index });
    }
    return { items, error: null };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const totalBudget = Number(budget.replace(",", "."));
    const durationDays = Number(duration);

    if (mode === "library") {
      if (!templateId) {
        setError("Selecione uma oferta da biblioteca.");
        setSaving(false);
        return;
      }
      if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
        setError("Informe um orçamento total válido.");
        setSaving(false);
        return;
      }
      if (![3, 7, 14, 30].includes(durationDays)) {
        setError("Informe uma duração válida.");
        setSaving(false);
        return;
      }
      const { data, error: invokeError } = await supabase.rpc("manager_create_campaign_for_store", {
        p_template_id: templateId,
        p_total_budget: totalBudget,
        p_duration_days: durationDays,
      });
      setSaving(false);
      if (invokeError) {
        setError(invokeError.message);
        return;
      }
      setMessage(`Campanha criada para a loja e disponibilizada para ${data ?? 0} vendedor(es).`);
      setBudget("");
      return;
    }

    if (!brandId || !storeId) {
      setError("A loja do gerente não possui marca vinculada.");
      setSaving(false);
      return;
    }
    if (!title.trim()) {
      setError("Informe o nome da campanha.");
      setSaving(false);
      return;
    }
    if (!model.trim()) {
      setError("Informe o modelo do veículo.");
      setSaving(false);
      return;
    }
    if (files.length > 10) {
      setError("O conjunto da campanha pode ter no máximo 10 fotos.");
      setSaving(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Sessão não encontrada.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("group_id,company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.group_id) {
      setError("Sua conta não está vinculada a um grupo.");
      setSaving(false);
      return;
    }

    const media = await uploadMedia();
    if (media.error) {
      setError(`Não foi possível enviar o material: ${media.error}`);
      setSaving(false);
      return;
    }

    const primaryMedia = media.items[0] ?? null;
    const mediaItems = media.items.map((item) => ({ url: item.mediaUrl, type: item.mediaType, position: item.position }));

    const { error: insertError } = await supabase.from("campaign_templates").insert({
      group_id: profile.group_id,
      company_id: profile.company_id ?? null,
      brand_id: brandId,
      model: model.trim(),
      version: version.trim() || null,
      title: title.trim(),
      name: title.trim(),
      description: description.trim() || null,
      headline: title.trim(),
      primary_text: description.trim() || null,
      price: Number(price.replace(",", ".")) || null,
      promotional_price: Number(promotionalPrice.replace(",", ".")) || null,
      offer_condition: offerCondition.trim() || null,
      media_type: primaryMedia?.mediaType ?? null,
      media_url: primaryMedia?.mediaUrl ?? null,
      image_url: primaryMedia?.mediaType === "image" ? primaryMedia.mediaUrl : null,
      media_items: mediaItems,
      period_start: startDate || null,
      period_end: endDate || null,
      status: "active",
      objective: "LEAD_GENERATION",
      cta: "WhatsApp",
    });

    setSaving(false);
    if (insertError) {
      setError(`Não foi possível criar a campanha: ${insertError.message}`);
      return;
    }

    setMessage(
      media.items.length > 1
        ? `Campanha criada com ${media.items.length} fotos no conjunto do carrossel. Ela já fica disponível aos vendedores desta loja.`
        : "Campanha criada para esta loja. Ela já fica disponível aos vendedores desta loja e na visão do Master.",
    );
    resetNewCampaign();
    await load();
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Nova campanha</CardTitle>
            <CardDescription className="mt-1">Crie uma campanha exclusiva para a loja que você gerencia.</CardDescription>
          </div>
          <Badge variant="secondary">Acesso restrito à loja</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados da loja...</div>
        ) : (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <div className="rounded-lg bg-muted/40 p-3 md:col-span-2">
              <p className="text-xs text-muted-foreground">Loja</p>
              <p className="font-semibold">{storeName}</p>
              <p className="text-xs text-muted-foreground">Marca: {brandName} · Destino: WhatsApp · Raio: 10 km</p>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Como deseja criar?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => { setMode("new"); setError(""); setMessage(""); }} className={`rounded-lg border p-3 text-left ${mode === "new" ? "border-primary bg-primary/5" : ""}`}>
                  <span className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4" />Criar do zero</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Crie uma nova oferta exclusiva desta loja.</span>
                </button>
                <button type="button" onClick={() => { setMode("library"); setError(""); setMessage(""); }} className={`rounded-lg border p-3 text-left ${mode === "library" ? "border-primary bg-primary/5" : ""}`}>
                  <span className="flex items-center gap-2 font-medium"><Plus className="h-4 w-4" />Usar oferta existente</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Use uma oferta já criada na biblioteca.</span>
                </button>
              </div>
            </div>

            {mode === "library" ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Oferta</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">Selecione uma oferta</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.title || template.model || "Oferta"}{template.version ? ` · ${template.version}` : ""}</option>)}
                  </select>
                  {!templates.length && <p className="text-xs text-muted-foreground">Nenhuma oferta ativa desta marca está disponível.</p>}
                </div>
                <div className="space-y-2"><Label>Orçamento total</Label><Input inputMode="decimal" placeholder="R$ 100,00" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
                <div className="space-y-2"><Label>Duração</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={duration} onChange={(e) => setDuration(e.target.value)}><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></div>
              </>
            ) : (
              <>
                <div className="space-y-2"><Label>Nome da campanha</Label><Input placeholder="Ex.: Feirão Fastback Setembro" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Modelo</Label><Input placeholder="Ex.: Fastback" value={model} onChange={(e) => setModel(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Versão</Label><Input placeholder="Ex.: T200" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
                <div className="space-y-2"><Label>Preço</Label><Input inputMode="decimal" placeholder="R$ 149.990,00" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                <div className="space-y-2"><Label>Preço promocional</Label><Input inputMode="decimal" placeholder="R$ 139.990,00" value={promotionalPrice} onChange={(e) => setPromotionalPrice(e.target.value)} /></div>
                <div className="space-y-2"><Label>Condição da oferta</Label><Input placeholder="Ex.: taxa zero / estoque limitado" value={offerCondition} onChange={(e) => setOfferCondition(e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Texto da campanha</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Descreva a oferta que será anunciada..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="space-y-2"><Label>Início da oferta</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>Fim da oferta</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Fotos do anúncio</Label>
                  <Input type="file" accept="image/*" multiple onChange={handleFilesChange} />
                  <p className="text-xs text-muted-foreground">Selecione até 10 fotos. Com 1 foto, o anúncio continua normal; com 2 a 10, o AutoAds prepara o conjunto para carrossel.</p>
                  {previews.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-5">
                      {previews.map(({ file, url }, index) => (
                        <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-lg border bg-muted/20">
                          <img src={url} alt={`Foto ${index + 1}`} className="aspect-square w-full object-cover" />
                          <div className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium">{index + 1}</div>
                          <button type="button" aria-label={`Remover foto ${index + 1}`} onClick={() => removeFile(index)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 hover:bg-background">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {(error || message) && <div className={`rounded-lg border px-3 py-2 text-sm md:col-span-2 ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5"}`}>{error || message}</div>}
            <div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Criando..." : mode === "new" ? "Criar campanha para minha loja" : "Criar campanha a partir da oferta"}</Button></div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

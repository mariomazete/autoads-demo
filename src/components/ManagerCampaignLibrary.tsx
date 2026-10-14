import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Eye, Loader2, Megaphone, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { OfferAdsUpdater } from "@/components/OfferAdsUpdater";
import { CampaignMediaCarousel } from "@/components/CampaignMediaCarousel";

type CampaignTemplate = {
  id: string;
  title: string | null;
  name: string;
  model: string | null;
  version: string | null;
  price: number | null;
  promotional_price: number | null;
  offer_condition: string | null;
  description: string | null;
  primary_text: string | null;
  image_url: string | null;
  media_type: string | null;
  media_url: string | null;
  media_items: string[] | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  store_id: string | null;
  created_by: string | null;
  created_at: string;
};

type EditForm = {
  title: string;
  model: string;
  version: string;
  price: string;
  promotionalPrice: string;
  offerCondition: string;
  description: string;
  periodStart: string;
  periodEnd: string;
};

const money = (value: number | null) => value == null ? "—" : `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";
const editFormFromCampaign = (campaign: CampaignTemplate): EditForm => ({
  title: campaign.title || campaign.name || "",
  model: campaign.model || "",
  version: campaign.version || "",
  price: campaign.price == null ? "" : String(campaign.price).replace(".", ","),
  promotionalPrice: campaign.promotional_price == null ? "" : String(campaign.promotional_price).replace(".", ","),
  offerCondition: campaign.offer_condition || "",
  description: campaign.description || campaign.primary_text || "",
  periodStart: campaign.period_start || "",
  periodEnd: campaign.period_end || "",
});
const mediaPathFromUrl = (url: string | null) => {
  if (!url) return null;
  const marker = "/campaign-media/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
};

function CampaignCard({ campaign, origin, selected, editing, saving, deleting, editForm, onSelect, onEdit, onCancelEdit, onSave, onDelete, onChange, onFileChange }: {
  campaign: CampaignTemplate;
  origin: "master" | "store";
  selected: boolean;
  editing: boolean;
  saving: boolean;
  deleting: boolean;
  editForm: EditForm | null;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChange: (field: keyof EditForm, value: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  const media = campaign.media_url || campaign.image_url;
  const title = campaign.title || campaign.name || "Campanha sem nome";
  const modelLabel = [campaign.model, campaign.version].filter(Boolean).join(" · ");
  const canManage = origin === "store";

  // Data local (não UTC): a oferta vale até o fim do último dia no horário de Brasília.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const expired = Boolean(campaign.period_end && campaign.period_end < today);
  const hasPrices = campaign.price != null || campaign.promotional_price != null;
  const discount =
    campaign.price && campaign.promotional_price && campaign.promotional_price < campaign.price
      ? Math.round((1 - campaign.promotional_price / campaign.price) * 100)
      : null;

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CampaignMediaCarousel
        title={title}
        mediaItems={campaign.media_items}
        mediaUrl={media}
        mediaType={campaign.media_type}
        overlay={
          <>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${origin === "master" ? "bg-white/95 text-foreground" : "bg-primary text-primary-foreground"}`}>
              {origin === "master" ? "Campanha Master" : "Minha loja"}
            </span>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${expired ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
              {expired ? "Vencida" : campaign.status === "active" ? "Ativa" : campaign.status}
            </span>
          </>
        }
      />
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{title}</h3>
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{modelLabel || "Modelo não informado"}</p>
        </div>

        {hasPrices ? (
          <div className="flex items-end justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              {campaign.price != null && campaign.promotional_price != null ? (
                <p className="text-xs text-muted-foreground line-through">{money(campaign.price)}</p>
              ) : null}
              <p className="text-xl font-bold tracking-tight text-primary">
                {money(campaign.promotional_price ?? campaign.price)}
              </p>
            </div>
            {discount ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">-{discount}%</span> : null}
          </div>
        ) : campaign.offer_condition ? (
          <p className="line-clamp-2 rounded-xl bg-muted/40 px-4 py-3 text-sm font-medium leading-snug">{campaign.offer_condition}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className={`flex items-center gap-1.5 text-xs ${expired ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3.5 w-3.5" />
            {campaign.period_end ? `${expired ? "Venceu em" : "Válida até"} ${date(campaign.period_end)}` : "Sem data de validade"}
          </span>
          <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full px-3" onClick={onSelect}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />{selected ? "Fechar" : "Detalhes"}
          </Button>
        </div>

        {selected && (
          <div className="space-y-4 border-t pt-4">
            {!editing ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs font-medium text-muted-foreground">Condição da oferta</p><p className="mt-1 text-sm">{campaign.offer_condition || "Não informada."}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">Vigência</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{date(campaign.period_start)} → {date(campaign.period_end)}</p></div>
                </div>
                <div><p className="text-xs font-medium text-muted-foreground">Texto da campanha</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{campaign.description || campaign.primary_text || "Sem texto cadastrado."}</p></div>
                {canManage && <div className="flex flex-wrap gap-2 border-t pt-3"><Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={deleting}>{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Excluir</Button></div>}
              </>
            ) : editForm ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Nome da campanha</Label><Input value={editForm.title} onChange={(e) => onChange("title", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Modelo</Label><Input value={editForm.model} onChange={(e) => onChange("model", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Versão</Label><Input value={editForm.version} onChange={(e) => onChange("version", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Preço</Label><Input inputMode="decimal" value={editForm.price} onChange={(e) => onChange("price", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Preço promocional</Label><Input inputMode="decimal" value={editForm.promotionalPrice} onChange={(e) => onChange("promotionalPrice", e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Condição da oferta</Label><Input value={editForm.offerCondition} onChange={(e) => onChange("offerCondition", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Início</Label><Input type="date" value={editForm.periodStart} onChange={(e) => onChange("periodStart", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Fim</Label><Input type="date" value={editForm.periodEnd} onChange={(e) => onChange("periodEnd", e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Texto da campanha</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.description} onChange={(e) => onChange("description", e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Trocar imagem ou vídeo (opcional)</Label><Input type="file" accept="image/*,video/*" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} /></div>
                <div className="flex flex-wrap gap-2 sm:col-span-2"><Button size="sm" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar alterações</Button><Button variant="ghost" size="sm" onClick={onCancelEdit} disabled={saving}><X className="mr-2 h-4 w-4" />Cancelar</Button></div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignSection({ title, description, count, children }: { title: string; description: string; count: number; children: React.ReactNode }) {
  return <section className="space-y-3"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold">{title}</h2><Badge variant="outline" className="rounded-full px-2 py-0 text-xs">{count}</Badge></div><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div>{children}</section>;
}

export function ManagerCampaignLibrary() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [updatedOfferId, setUpdatedOfferId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setError("Sessão não encontrada."); setLoading(false); setRefreshing(false); return; }
    setCurrentUserId(user.user.id);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("store_id").eq("id", user.user.id).maybeSingle();
    if (profileError || !profile?.store_id) { setError("Gerente sem loja vinculada."); setLoading(false); setRefreshing(false); return; }
    setStoreId(profile.store_id);
    const { data, error: campaignError } = await supabase.from("campaign_templates").select("id,title,name,model,version,price,promotional_price,offer_condition,description,primary_text,image_url,media_type,media_url,media_items,period_start,period_end,status,store_id,created_by,created_at").eq("status", "active").order("created_at", { ascending: false });
    if (campaignError) setError(campaignError.message);
    setCampaigns((data ?? []) as CampaignTemplate[]);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const masterCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.store_id === null), [campaigns]);
  const storeCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.store_id === storeId), [campaigns, storeId]);

  const startEdit = (campaign: CampaignTemplate) => { setSelectedId(campaign.id); setEditingId(campaign.id); setEditForm(editFormFromCampaign(campaign)); setEditFile(null); setError(""); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); setEditFile(null); };
  const changeEdit = (field: keyof EditForm, value: string) => setEditForm((current) => current ? { ...current, [field]: value } : current);

  const saveEdit = async (campaign: CampaignTemplate) => {
    if (!editForm || !currentUserId || !storeId) return;
    if (!editForm.title.trim() || !editForm.model.trim()) { setError("Informe pelo menos o nome da campanha e o modelo."); return; }
    setSavingId(campaign.id); setError("");
    let mediaUrl = campaign.media_url; let mediaType = campaign.media_type; let imageUrl = campaign.image_url; let mediaItems: unknown = campaign.media_items;
    if (editFile) {
      const extension = editFile.name.split(".").pop() || "bin";
      const path = `manager/${storeId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("campaign-media").upload(path, editFile, { upsert: false });
      if (uploadError) { setError(`Não foi possível enviar o novo material: ${uploadError.message}`); setSavingId(null); return; }
      mediaUrl = supabase.storage.from("campaign-media").getPublicUrl(path).data.publicUrl;
      mediaType = editFile.type.startsWith("video/") ? "video" : "image";
      imageUrl = mediaType === "image" ? mediaUrl : null;
      // O anúncio usa a lista de fotos; com arquivo novo, ela passa a ter só esse arquivo.
      mediaItems = mediaType === "image" ? [{ url: mediaUrl, type: "image", position: 0 }] : [];
    }
    const { data, error: updateError } = await supabase.from("campaign_templates").update({
      title: editForm.title.trim(), name: editForm.title.trim(), headline: editForm.title.trim(), model: editForm.model.trim(), version: editForm.version.trim() || null,
      price: Number(editForm.price.replace(",", ".")) || null, promotional_price: Number(editForm.promotionalPrice.replace(",", ".")) || null,
      offer_condition: editForm.offerCondition.trim() || null, description: editForm.description.trim() || null, primary_text: editForm.description.trim() || null,
      period_start: editForm.periodStart || null, period_end: editForm.periodEnd || null, media_url: mediaUrl, media_type: mediaType, image_url: imageUrl, media_items: mediaItems as never,
    }).eq("id", campaign.id).eq("store_id", storeId).eq("created_by", currentUserId).select("id").maybeSingle();
    if (updateError || !data) { setError(updateError?.message || "Não foi possível salvar as alterações."); setSavingId(null); return; }
    const oldPath = mediaPathFromUrl(campaign.media_url || campaign.image_url); const newPath = mediaPathFromUrl(mediaUrl);
    if (editFile && oldPath && oldPath !== newPath) await supabase.storage.from("campaign-media").remove([oldPath]);
    setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, title: editForm.title.trim(), name: editForm.title.trim(), model: editForm.model.trim(), version: editForm.version.trim() || null, price: Number(editForm.price.replace(",", ".")) || null, promotional_price: Number(editForm.promotionalPrice.replace(",", ".")) || null, offer_condition: editForm.offerCondition.trim() || null, description: editForm.description.trim() || null, primary_text: editForm.description.trim() || null, period_start: editForm.periodStart || null, period_end: editForm.periodEnd || null, media_url: mediaUrl, media_type: mediaType, image_url: imageUrl } : item));
    cancelEdit(); setSavingId(null); setUpdatedOfferId(campaign.id);
  };

  const deleteCampaign = async (campaign: CampaignTemplate) => {
    if (!currentUserId || !storeId) return;
    const title = campaign.title || campaign.name || "esta campanha";
    if (!window.confirm(`Excluir "${title}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(campaign.id); setError("");
    const { error: deleteError } = await supabase.from("campaign_templates").delete().eq("id", campaign.id).eq("store_id", storeId).eq("created_by", currentUserId);
    if (deleteError) { setError(`Não foi possível excluir a campanha: ${deleteError.message}`); setDeletingId(null); return; }
    const mediaPath = mediaPathFromUrl(campaign.media_url || campaign.image_url);
    if (mediaPath) await supabase.storage.from("campaign-media").remove([mediaPath]);
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    if (selectedId === campaign.id) setSelectedId(null);
    if (editingId === campaign.id) cancelEdit();
    setDeletingId(null);
  };

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando campanhas disponíveis...</CardContent></Card>;

  const renderCards = (items: CampaignTemplate[], origin: "master" | "store") => items.map((campaign) => (
    <CampaignCard key={campaign.id} campaign={campaign} origin={origin} selected={selectedId === campaign.id} editing={editingId === campaign.id} saving={savingId === campaign.id} deleting={deletingId === campaign.id} editForm={editingId === campaign.id ? editForm : null}
      onSelect={() => setSelectedId((current) => current === campaign.id ? null : campaign.id)} onEdit={() => startEdit(campaign)} onCancelEdit={cancelEdit} onSave={() => void saveEdit(campaign)} onDelete={() => void deleteCampaign(campaign)} onChange={changeEdit} onFileChange={setEditFile} />
  ));

  return (
    <section className="space-y-5">
      <Card className="border-border/70 shadow-sm"><CardHeader className="p-4 md:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Megaphone className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-base">Biblioteca de campanhas</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulte as campanhas do Master e as ofertas criadas para sua loja.</p></div></div><Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Atualizar</Button></div></CardHeader></Card>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {updatedOfferId ? <OfferAdsUpdater key={updatedOfferId} templateId={updatedOfferId} onClose={() => setUpdatedOfferId(null)} /> : null}
      <CampaignSection title="Campanhas do Master" description="Ofertas disponibilizadas para a sua loja." count={masterCampaigns.length}>{masterCampaigns.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{renderCards(masterCampaigns, "master")}</div> : <Card><CardContent className="p-5 text-sm text-muted-foreground">Nenhuma campanha do Master está disponível para esta loja no momento.</CardContent></Card>}</CampaignSection>
      <CampaignSection title="Campanhas da minha loja" description="Ofertas criadas pelo gerente para esta loja." count={storeCampaigns.length}>{storeCampaigns.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{renderCards(storeCampaigns, "store")}</div> : <Card><CardContent className="p-5 text-sm text-muted-foreground">Ainda não há campanhas próprias desta loja. Quando o gerente criar uma, ela aparecerá aqui.</CardContent></Card>}</CampaignSection>
    </section>
  );
}

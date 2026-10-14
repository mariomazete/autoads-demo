import { FormEvent, useEffect, useState } from "react";
import { Archive, ArchiveRestore, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { OfferAdsUpdater } from "@/components/OfferAdsUpdater";
import { CampaignMediaCarousel } from "@/components/CampaignMediaCarousel";
import { BudgetGuide, MIN_DAILY_BUDGET } from "@/components/seller/BudgetGuide";
import { loadMySellerReadiness } from "@/lib/sellerReadiness";

type Brand = { id: string; name: string; slug?: string };
const DEFAULT_BRANDS: Brand[] = [
  { id: "fallback-fiat", name: "Fiat", slug: "fiat" }, { id: "fallback-jeep", name: "Jeep", slug: "jeep" }, { id: "fallback-ford", name: "Ford", slug: "ford" }, { id: "fallback-peugeot", name: "Peugeot", slug: "peugeot" }, { id: "fallback-citroen", name: "Citroën", slug: "citroen" }, { id: "fallback-renault", name: "Renault", slug: "renault" }, { id: "fallback-gac", name: "GAC", slug: "gac" }, { id: "fallback-geely", name: "Geely", slug: "geely" }, { id: "fallback-omoda-jaecoo", name: "Omoda & Jaecoo", slug: "omoda-jaecoo" }, { id: "fallback-leapmotor", name: "Leapmotor", slug: "leapmotor" },
];
const DEFAULT_BRAND_ORDER = DEFAULT_BRANDS.map((brand) => brand.slug);

type LibraryCampaign = { id: string; brand_id: string | null; model: string | null; version: string | null; title: string | null; description: string | null; price: number | null; promotional_price: number | null; offer_condition: string | null; media_type: string | null; media_url: string | null; media_items: string[] | null; period_start: string | null; period_end: string | null; status: "active" | "inactive"; brands: Brand | null };
type CampaignForm = { brandId: string; model: string; version: string; title: string; description: string; price: string; promotionalPrice: string; offerCondition: string; startDate: string; endDate: string; status: "active" | "inactive" };
const emptyForm: CampaignForm = { brandId: "", model: "", version: "", title: "", description: "", price: "", promotionalPrice: "", offerCondition: "", startDate: "", endDate: "", status: "active" };

function formatCurrency(value: number | null) { if (value == null) return "—"; return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function formatDate(value: string | null) { if (!value) return "Sem período definido"; return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)); }
function isWithinCampaignValidity(campaign: Pick<LibraryCampaign, "period_start" | "period_end">) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (campaign.period_start) {
    const start = new Date(`${campaign.period_start}T00:00:00`);
    if (today < start) return false;
  }
  if (campaign.period_end) {
    const end = new Date(`${campaign.period_end}T23:59:59`);
    if (today > end) return false;
  }
  return true;
}
function CampaignMedia({ campaign }: { campaign: Pick<LibraryCampaign, "id" | "media_type" | "media_url" | "media_items"> }) {
  const items = (campaign.media_items ?? []).filter(Boolean);
  const mediaItems = items.length ? items : campaign.media_url ? [campaign.media_url] : [];
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [campaign.id, mediaItems.length]);
  if (!mediaItems.length) return <div className="flex aspect-video items-center justify-center rounded-lg bg-muted"><ImagePlus className="h-8 w-8 text-muted-foreground" /></div>;
  const current = mediaItems[Math.min(index, mediaItems.length - 1)];
  const isVideo = mediaItems.length === 1 && campaign.media_type === "video";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted/30">
      {isVideo ? <video className="h-full w-full object-contain" controls src={current} /> : <img alt={`Material da campanha ${index + 1}`} className="h-full w-full object-contain" src={current} />}
      {mediaItems.length > 1 && <>
        <button type="button" aria-label="Foto anterior" onClick={() => setIndex((value) => (value - 1 + mediaItems.length) % mediaItems.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/75"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label="Próxima foto" onClick={() => setIndex((value) => (value + 1) % mediaItems.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/75"><ChevronRight className="h-5 w-5" /></button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white">{index + 1}/{mediaItems.length}</div>
      </>}
    </div>
  );
}
function campaignToForm(campaign: LibraryCampaign): CampaignForm { return { brandId: campaign.brand_id ?? "", model: campaign.model ?? "", version: campaign.version ?? "", title: campaign.title ?? "", description: campaign.description ?? "", price: campaign.price?.toString() ?? "", promotionalPrice: campaign.promotional_price?.toString() ?? "", offerCondition: campaign.offer_condition ?? "", startDate: campaign.period_start ?? "", endDate: campaign.period_end ?? "", status: campaign.status }; }

// Pausa na Meta os anúncios publicados e ativos de uma oferta (o master tem permissão na função).
// Devolve quantos foram pausados e quantos falharam.
async function pauseOfferAdsOnMeta(templateId: string) {
  const { data } = await supabase
    .from("seller_campaigns")
    .select("id")
    .eq("template_id", templateId)
    .eq("status", "active")
    .not("meta_campaign_id", "is", null);
  let paused = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const { data: result, error } = await supabase.functions.invoke("meta-set-campaign-status-v1", {
      body: { campaign_id: row.id, status: "paused" },
    });
    if (error || !result?.success) failed++;
    else paused++;
  }
  return { paused, failed };
}

const pauseSummary = ({ paused, failed }: { paused: number; failed: number }) =>
  [
    paused ? `${paused} anúncio(s) pausado(s) na Meta.` : "",
    failed ? `${failed} anúncio(s) não puderam ser pausados na Meta — pause pelo painel do vendedor.` : "",
  ]
    .filter(Boolean)
    .join(" ");

export function CampaignLibrary({ sellerOnly = false }: { sellerOnly?: boolean }) {
  const [brands, setBrands] = useState<Brand[]>([]); const [campaigns, setCampaigns] = useState<LibraryCampaign[]>([]); const [selectedBrand, setSelectedBrand] = useState("all"); const [form, setForm] = useState<CampaignForm>(emptyForm); const [editingId, setEditingId] = useState<string | null>(null); const [file, setFile] = useState<File | null>(null); const [mediaFiles, setMediaFiles] = useState<File[]>([]); const [previewUrl, setPreviewUrl] = useState(""); const [keptMedia, setKeptMedia] = useState<string[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [selectedOffer, setSelectedOffer] = useState<LibraryCampaign | null>(null); const [campaignBudget, setCampaignBudget] = useState(""); const [campaignDuration, setCampaignDuration] = useState("14"); const [campaignMode, setCampaignMode] = useState<"period" | "continuous">("period"); const [creatingSellerCampaign, setCreatingSellerCampaign] = useState(false); const [sellerCampaignMessage, setSellerCampaignMessage] = useState(""); const [campaignCreated, setCampaignCreated] = useState(false); const [lastCampaignBudget, setLastCampaignBudget] = useState(0); const [lastCampaignDuration, setLastCampaignDuration] = useState(14); const [showForm, setShowForm] = useState(false); const [updatedOfferId, setUpdatedOfferId] = useState<string | null>(null);
  // Ofertas arquivadas (só o master vê e pode reativar).
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCampaigns, setArchivedCampaigns] = useState<(LibraryCampaign & { archived_at: string | null })[] | null>(null);
  async function loadArchived() {
    const { data, error } = await supabase
      .from("campaign_templates")
      .select("id, brand_id, model, version, title, description, price, promotional_price, offer_condition, media_type, media_url, media_items, period_start, period_end, status, archived_at, brands(id, name)")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    if (error) { setMessage(`Não foi possível carregar as ofertas arquivadas: ${error.message}`); return; }
    setArchivedCampaigns((data ?? []) as (LibraryCampaign & { archived_at: string | null })[]);
  }
  async function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next) await loadArchived();
  }
  async function unarchiveCampaign(campaign: LibraryCampaign) {
    const label = campaign.title || campaign.model || "oferta";
    if (!window.confirm(`Reativar "${label}"? A oferta volta para a biblioteca, ativa, e os vendedores podem publicar com ela de novo.`)) return;
    const { error } = await supabase.rpc("unarchive_campaign_template", { p_template_id: campaign.id });
    if (error) { setMessage(`Não foi possível reativar a oferta: ${error.message}`); return; }
    setArchivedCampaigns((current) => (current ?? []).filter((item) => item.id !== campaign.id));
    await reloadCampaigns();
    const expired = campaign.period_end && campaign.period_end < new Date().toISOString().slice(0, 10);
    setMessage(`Oferta "${label}" reativada.${expired ? " A validade dela já passou: edite a data de fim para os vendedores verem a oferta." : ""} As campanhas antigas dos vendedores continuam arquivadas; cada um publica uma nova.`);
  }

  // Ofertas que o vendedor já tem publicadas (ou publicando): não podem ser publicadas de novo.
  const [runningTemplateIds, setRunningTemplateIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!sellerOnly) return;
    let mounted = true;
    const loadRunning = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("seller_campaigns")
        .select("template_id, status, meta_campaign_id")
        .eq("seller_id", user.id)
        .in("status", ["pending", "active"]);
      if (!mounted) return;
      setRunningTemplateIds(
        new Set(
          (data ?? [])
            .filter((row) => row.template_id && (row.status === "pending" || row.meta_campaign_id))
            .map((row) => String(row.template_id)),
        ),
      );
    };
    void loadRunning();
    const refresh = () => window.setTimeout(() => void loadRunning(), 1500);
    window.addEventListener("autoads:campaign-created", refresh);
    window.addEventListener("autoads:campaigns-changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("autoads:campaign-created", refresh);
      window.removeEventListener("autoads:campaigns-changed", refresh);
    };
  }, [sellerOnly]);

  useEffect(() => { let mounted = true; async function loadLibrary() { const { data: { user } } = await supabase.auth.getUser(); const [brandsResult, assignmentsResult] = await Promise.all([supabase.from("brands").select("id, name, slug").eq("active", true).order("name"), sellerOnly && user ? supabase.from("seller_brands").select("brand_id").eq("seller_id", user.id) : Promise.resolve({ data: null, error: null })]); let loadedBrands = (brandsResult.data ?? []) as Brand[]; if (!sellerOnly && loadedBrands.length === 0) { const { error: seedError } = await supabase.from("brands").upsert(DEFAULT_BRANDS.map(({ name, slug }) => ({ name, slug: slug as string, active: true })), { onConflict: "slug" }); if (!seedError) { const { data: refreshedBrands } = await supabase.from("brands").select("id, name, slug").eq("active", true).order("name"); loadedBrands = (refreshedBrands ?? []) as Brand[]; } } const assignedBrandIds = assignmentsResult.data?.map((item) => item.brand_id) ?? []; let query = supabase.from("campaign_templates").select("id, brand_id, model, version, title, description, price, promotional_price, offer_condition, media_type, media_url, media_items, period_start, period_end, status, brands(id, name)").is("archived_at", null).order("created_at", { ascending: false }); if (sellerOnly) query = query.in("brand_id", assignedBrandIds.length ? assignedBrandIds : ["00000000-0000-0000-0000-000000000000"]); const { data: campaignsData, error: campaignsError } = await query; if (!mounted) return; if (brandsResult.error && loadedBrands.length === 0) setMessage("Não foi possível carregar as marcas disponíveis."); if (campaignsError) setMessage(campaignsError.message); const brandsBySlug = new Map(loadedBrands.filter((brand) => brand.slug).map((brand) => [brand.slug, brand])); const availableBrands = DEFAULT_BRANDS.map((fallbackBrand) => brandsBySlug.get(fallbackBrand.slug ?? "") ?? fallbackBrand); availableBrands.sort((a, b) => DEFAULT_BRAND_ORDER.indexOf(a.slug ?? "") - DEFAULT_BRAND_ORDER.indexOf(b.slug ?? "")); setBrands(availableBrands); setCampaigns((campaignsData ?? []) as LibraryCampaign[]); setLoading(false); } loadLibrary().catch(() => { if (mounted) { setMessage("Não foi possível carregar a biblioteca."); setLoading(false); } }); return () => { mounted = false; }; }, [sellerOnly]);

  function updateForm(field: keyof CampaignForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function handleFileChange(nextFile: File | undefined) { if (!nextFile) return; setFile(nextFile); setMediaFiles([nextFile]); setPreviewUrl(URL.createObjectURL(nextFile)); }
  function handleMediaFilesChange(files: FileList | null) { const picked = Array.from(files ?? []); const room = Math.max(0, 10 - keptMedia.length - mediaFiles.length); if (picked.length > room) setMessage(`O carrossel aceita no máximo 10 fotos. ${room ? `Só ${room} foram adicionadas.` : "Remova alguma foto antes de adicionar outra."}`); const next = [...mediaFiles, ...picked.slice(0, room)]; setMediaFiles(next); setFile(next[0] ?? null); setPreviewUrl(next[0] ? URL.createObjectURL(next[0]) : ""); }
  function removeKeptMedia(index: number) { setKeptMedia((current) => current.filter((_, position) => position !== index)); }
  function removeNewMedia(index: number) { setMediaFiles((current) => { const next = current.filter((_, position) => position !== index); setFile(next[0] ?? null); return next; }); }
  function resetForm() { setEditingId(null); setForm(emptyForm); setFile(null); setMediaFiles([]); setPreviewUrl(""); setKeptMedia([]); }
  function closeForm() { resetForm(); setShowForm(false); }
  function startEditing(campaign: LibraryCampaign) { setEditingId(campaign.id); setForm(campaignToForm(campaign)); setFile(null); setMediaFiles([]); setPreviewUrl(campaign.media_type === "video" ? campaign.media_url ?? "" : ""); setKeptMedia(campaign.media_type === "video" ? [] : (campaign.media_items ?? []).filter(Boolean).length ? (campaign.media_items ?? []).filter(Boolean) : campaign.media_url ? [campaign.media_url] : []); setMessage(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function reloadCampaigns() { const { data } = await supabase.from("campaign_templates").select("id, brand_id, model, version, title, description, price, promotional_price, offer_condition, media_type, media_url, media_items, period_start, period_end, status, brands(id, name)").is("archived_at", null).order("created_at", { ascending: false }); setCampaigns((data ?? []) as LibraryCampaign[]); }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setSaving(false); setMessage("Sua sessão expirou. Entre novamente."); return; } const { data: profile } = await supabase.from("profiles").select("group_id").eq("id", user.id).maybeSingle(); if (!profile?.group_id && !editingId) { setSaving(false); setMessage("Sua conta master ainda não está vinculada a um grupo."); return; } let mediaUrl = editingId ? campaigns.find((campaign) => campaign.id === editingId)?.media_url ?? null : null; let mediaType = editingId ? campaigns.find((campaign) => campaign.id === editingId)?.media_type ?? null : null; let mediaItems = editingId ? campaigns.find((campaign) => campaign.id === editingId)?.media_items ?? [] : []; if (keptMedia.length + mediaFiles.length > 10) { setSaving(false); setMessage("O carrossel aceita no máximo 10 fotos."); return; } const editingVideo = Boolean(editingId) && mediaType === "video" && !mediaFiles.length; if (!editingVideo && !keptMedia.length && !mediaFiles.length && !file) { setSaving(false); setMessage("Adicione pelo menos uma foto ao anúncio."); return; } if (!editingVideo && (keptMedia.length || mediaFiles.length)) { const uploaded: string[] = []; for (const mediaFile of mediaFiles) { if (!mediaFile.type.startsWith("image/")) { setSaving(false); setMessage("O carrossel aceita somente fotos."); return; } const extension = mediaFile.name.split(".").pop() || "jpg"; const path = `${user.id}/${crypto.randomUUID()}.${extension}`; const { error: uploadError } = await supabase.storage.from("campaign-media").upload(path, mediaFile, { upsert: false }); if (uploadError) { setSaving(false); setMessage("Não foi possível enviar uma das fotos do carrossel."); return; } uploaded.push(supabase.storage.from("campaign-media").getPublicUrl(path).data.publicUrl); } mediaItems = [...keptMedia, ...uploaded]; mediaUrl = mediaItems[0] ?? null; mediaType = "image"; } else if (!editingId && file) { const extension = file.name.split(".").pop() || "bin"; const path = `${user.id}/${crypto.randomUUID()}.${extension}`; const { error: uploadError } = await supabase.storage.from("campaign-media").upload(path, file, { upsert: false }); if (uploadError) { setSaving(false); setMessage("Não foi possível enviar o material."); return; } mediaUrl = supabase.storage.from("campaign-media").getPublicUrl(path).data.publicUrl; mediaType = file.type.startsWith("video/") ? "video" : "image"; mediaItems = mediaType === "image" ? [mediaUrl] : []; } const selectedBrandRecord = brands.find((brand) => brand.id === form.brandId); if (!selectedBrandRecord || selectedBrandRecord.id.startsWith("fallback-")) { setSaving(false); setMessage("A marca selecionada não está disponível no banco."); return; } const values = { p_template_id: editingId, p_brand_id: selectedBrandRecord.id, p_model: form.model, p_version: form.version || null, p_title: form.title, p_description: form.description || null, p_price: Number(form.price.replace(",", ".")) || null, p_promotional_price: Number(form.promotionalPrice.replace(",", ".")) || null, p_offer_condition: form.offerCondition || null, p_media_type: mediaType, p_media_url: mediaUrl, p_media_items: mediaItems.slice(0, 10), p_period_start: form.startDate || null, p_period_end: form.endDate || null, p_status: form.status }; const result = editingId ? await supabase.rpc("update_campaign_template", values as never) : await supabase.from("campaign_templates").insert({ brand_id: selectedBrandRecord.id, model: form.model, version: form.version || null, title: form.title, name: form.title, description: form.description || null, primary_text: form.description || null, price: values.p_price, promotional_price: values.p_promotional_price, offer_condition: form.offerCondition || null, media_type: mediaType, media_url: mediaUrl, media_items: mediaItems.slice(0, 10), image_url: mediaType === "image" ? mediaUrl : null, period_start: form.startDate || null, period_end: form.endDate || null, status: form.status, objective: "LEAD", cta: "WhatsApp", group_id: profile?.group_id as string }); if (result.error) { setSaving(false); setMessage(`Não foi possível salvar a campanha: ${result.error.message}`); return; } const pauseResult = editingId && form.status === "inactive" ? await pauseOfferAdsOnMeta(editingId) : null; setSaving(false); setMessage([editingId ? "Oferta atualizada." : "Campanha criada e disponível para a marca.", pauseResult ? pauseSummary(pauseResult) : ""].filter(Boolean).join(" ")); setUpdatedOfferId(editingId && form.status === "active" ? editingId : null); closeForm(); await reloadCampaigns(); }

  async function toggleCampaign(campaign: LibraryCampaign) { const nextStatus = campaign.status === "active" ? "inactive" : "active"; const { error } = await supabase.rpc("set_campaign_template_status", { p_template_id: campaign.id, p_status: nextStatus }); if (error) { setMessage(`Não foi possível ${nextStatus === "active" ? "reativar" : "pausar"} a campanha: ${error.message}`); return; } setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, status: nextStatus } : item)); if (nextStatus === "active") { setMessage("Oferta reativada. Os vendedores já podem publicar campanhas com ela."); return; } const pauseResult = await pauseOfferAdsOnMeta(campaign.id); setMessage(["Oferta pausada para todas as lojas e vendedores.", pauseSummary(pauseResult)].filter(Boolean).join(" ")); }
  // Arquivar: pausa na Meta os anúncios dos vendedores que usam a oferta e só então arquiva a oferta
  // e as campanhas dela (somem de "no ar"; os resultados ficam guardados).
  async function archiveCampaign(campaign: LibraryCampaign) {
    const label = campaign.title || campaign.model || "oferta";
    if (!window.confirm(`Arquivar "${label}"? Os anúncios dos vendedores com esta oferta param de veicular na Meta e saem das campanhas ativas deles. Os resultados continuam guardados.`)) return;
    setMessage("Pausando os anúncios desta oferta na Meta...");
    const pauseResult = await pauseOfferAdsOnMeta(campaign.id);
    if (pauseResult.failed) {
      setMessage(`${pauseSummary(pauseResult)} A oferta não foi arquivada para nenhum anúncio continuar gastando sem aparecer no painel. Tente de novo em alguns minutos.`);
      return;
    }
    const { data: archivedCount, error } = await supabase.rpc("archive_campaign_template", { p_template_id: campaign.id });
    if (error) { setMessage(`Não foi possível arquivar a oferta: ${error.message}`); return; }
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    if (editingId === campaign.id) closeForm();
    if (updatedOfferId === campaign.id) setUpdatedOfferId(null);
    if (showArchived) await loadArchived();
    setMessage([`Oferta "${label}" arquivada.`, pauseSummary(pauseResult), archivedCount ? `${archivedCount} campanha(s) de vendedores arquivada(s); os resultados continuam nos relatórios.` : ""].filter(Boolean).join(" "));
  }
  async function deleteCampaign(campaign: LibraryCampaign) { const label = campaign.title || campaign.model || "oferta"; if (!window.confirm(`Excluir "${label}" de todas as lojas e vendedores? Esta ação remove as ativações individuais e não pode ser desfeita.`)) return; setMessage(""); const { error } = await supabase.rpc("delete_campaign_template", { p_template_id: campaign.id }); if (error) { setMessage(error.message); return; } setCampaigns((current) => current.filter((item) => item.id !== campaign.id)); if (editingId === campaign.id) closeForm(); setMessage("Campanha excluída de todas as lojas e vendedores."); }

  async function createSellerCampaign() {
    setSellerCampaignMessage("");
    if (!selectedOffer) return;

    if (!isWithinCampaignValidity(selectedOffer)) {
      setSellerCampaignMessage(
        `Esta oferta só pode ser divulgada de ${formatDate(selectedOffer.period_start)} até ${formatDate(selectedOffer.period_end)}. Fora desse período, a publicação é bloqueada.`,
      );
      return;
    }

    const continuous = campaignMode === "continuous";
    const totalBudget = Number(campaignBudget.replace(",", "."));
    const durationDays = continuous ? 1 : Number(campaignDuration);
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      setSellerCampaignMessage(continuous ? "Informe um valor por dia válido." : "Informe um orçamento total válido.");
      return;
    }
    if (continuous && totalBudget < MIN_DAILY_BUDGET) {
      setSellerCampaignMessage(`A Meta exige pelo menos ${formatCurrency(MIN_DAILY_BUDGET)} por dia.`);
      return;
    }
    if (!continuous && Number.isFinite(durationDays) && durationDays > 0 && totalBudget / durationDays < MIN_DAILY_BUDGET) {
      setSellerCampaignMessage(
        `A Meta exige pelo menos ${formatCurrency(MIN_DAILY_BUDGET)} por dia. Para ${durationDays} dias, o orçamento mínimo é ${formatCurrency(MIN_DAILY_BUDGET * durationDays)}.`,
      );
      return;
    }
    if (!continuous && ![3, 7, 14, 30].includes(durationDays)) {
      setSellerCampaignMessage("Informe uma duração válida.");
      return;
    }


    if (runningTemplateIds.has(selectedOffer.id)) {
      setSellerCampaignMessage("Você já tem esta oferta no ar. Pause a campanha atual antes de publicar de novo.");
      return;
    }
    // Sem Meta conectada (conta de anúncios e Página) a publicação falharia: avisa antes de criar a campanha.
    const readiness = await loadMySellerReadiness();
    if (readiness && (!readiness.meta_connected || !readiness.has_ad_account || !readiness.has_page)) {
      setSellerCampaignMessage("Conecte sua conta Meta (com conta de anúncios e Página) na aba Meta Ads antes de publicar.");
      return;
    }
    setCreatingSellerCampaign(true); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setCreatingSellerCampaign(false); setSellerCampaignMessage("Sua sessão expirou. Entre novamente."); return; } const { data: profile, error: profileError } = await supabase.from("profiles").select("group_id, company_id, store_id, whatsapp").eq("id", user.id).maybeSingle(); if (profileError || !profile?.group_id || !profile.store_id) { setCreatingSellerCampaign(false); setSellerCampaignMessage("Sua conta não está vinculada a uma loja."); return; } if (!profile.whatsapp) { setCreatingSellerCampaign(false); setSellerCampaignMessage("Seu cadastro não possui WhatsApp. Procure o Master."); return; } const { data: store } = await supabase.from("stores").select("address, city, state, default_radius_km, brand_id").eq("id", profile.store_id).maybeSingle(); if (!store || store.brand_id !== selectedOffer.brand_id) { setCreatingSellerCampaign(false); setSellerCampaignMessage("Esta campanha não pertence à marca da sua loja."); return; } const startDate = new Date(); const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + durationDays); /* Contínua: sem data de fim própria, só a validade da oferta (se houver). */ const continuousEnd = selectedOffer.period_end ? new Date(`${selectedOffer.period_end}T23:59:59-03:00`) : null; const { data: insertedCampaign, error } = await supabase.from("seller_campaigns").insert({ name: `${selectedOffer.brands?.name ?? ""} ${selectedOffer.model ?? ""}`.trim() || selectedOffer.title || "Campanha", seller_id: user.id, tenant_id: profile.group_id, company_id: profile.company_id, store_id: profile.store_id, template_id: selectedOffer.id, brand_id: selectedOffer.brand_id, vehicle_id: null, budget_amount: totalBudget, total_budget: continuous ? 0 : totalBudget, daily_budget: continuous ? totalBudget : totalBudget / durationDays, spent_amount: 0, duration_days: continuous ? null : durationDays, start_date: startDate.toISOString(), end_date: continuous ? (continuousEnd ? continuousEnd.toISOString() : null) : endDate.toISOString(), radius_km: 10, store_location: [store.address, store.city, store.state].filter(Boolean).join(", ") || null, whatsapp: profile.whatsapp, status: "pending", objective: "LEAD", source: "autoads" }).select("id").single(); setCreatingSellerCampaign(false); if (error) { setSellerCampaignMessage(`Não foi possível criar a campanha: ${error.message}`); return; } setLastCampaignBudget(totalBudget); setLastCampaignDuration(continuous ? 0 : durationDays); setCampaignBudget(""); setCampaignDuration("14"); setCampaignMode("period"); setCampaignCreated(true); setSellerCampaignMessage("Campanha criada. Publicando na Meta..."); window.dispatchEvent(new CustomEvent("autoads:campaign-created", { detail: { campaignId: insertedCampaign?.id ?? null } })); }

  // Vendedor vê só ofertas ativas e dentro da validade. Ofertas vencidas continuam visíveis
  // para o master e o gerente, que podem renovar a data.
  const todayLocal = (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })();
  const visibleCampaigns = campaigns.filter((campaign) =>
    sellerOnly
      ? campaign.status === "active" && !(campaign.period_end && campaign.period_end < todayLocal)
      : selectedBrand === "all" || campaign.brand_id === selectedBrand,
  );

  if (sellerOnly) {
    if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando campanhas...</CardContent></Card>;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escolha o que você quer anunciar</CardTitle>
          <CardDescription>Selecione uma oferta disponibilizada pelo administrador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCampaigns.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center">
              <div className="mx-auto text-xl">📣</div>
              <p className="mt-3 font-medium">Nenhuma oferta disponível no momento</p>
              <p className="mt-1 text-sm text-muted-foreground">Assim que o administrador ou o gerente liberar uma oferta válida para sua marca, ela aparece aqui.</p>
            </div>
          ) : (
            visibleCampaigns.map((campaign) => {
              const alreadyRunning = runningTemplateIds.has(campaign.id) && !(selectedOffer?.id === campaign.id && campaignCreated);
              const selected = selectedOffer?.id === campaign.id && !alreadyRunning;
              const title = campaign.title || [campaign.model, campaign.version].filter(Boolean).join(" ") || "Oferta";
              const modelLabel = [campaign.model, campaign.version].filter(Boolean).join(" · ");
              const now = new Date();
              const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
              const expired = Boolean(campaign.period_end && campaign.period_end < today);
              const hasPrices = campaign.price != null || campaign.promotional_price != null;
              const discount =
                campaign.price && campaign.promotional_price && campaign.promotional_price < campaign.price
                  ? Math.round((1 - campaign.promotional_price / campaign.price) * 100)
                  : null;
              const condition = campaign.offer_condition || campaign.description;
              return (
                <Card
                  key={campaign.id}
                  className={`group overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${selected ? "border-primary ring-2 ring-primary/30" : "border-border/60"}`}
                >
                  <CampaignMediaCarousel
                    title={title}
                    mediaItems={campaign.media_items}
                    mediaUrl={campaign.media_url}
                    mediaType={campaign.media_type}
                    overlay={
                      <>
                        {campaign.brands?.name ? (
                          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">{campaign.brands.name}</span>
                        ) : null}
                        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${expired ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
                          {expired ? "Vencida" : "Disponível"}
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
                            <p className="text-xs text-muted-foreground line-through">{formatCurrency(campaign.price)}</p>
                          ) : null}
                          <p className="text-xl font-bold tracking-tight text-primary">{formatCurrency(campaign.promotional_price ?? campaign.price)}</p>
                        </div>
                        {discount ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">-{discount}%</span> : null}
                      </div>
                    ) : null}
                    {condition ? (
                      <p className="line-clamp-3 rounded-xl bg-muted/40 px-4 py-3 text-sm font-medium leading-snug">{condition}</p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <span className={`flex items-center gap-1.5 text-xs ${expired ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        {campaign.period_end ? `${expired ? "Venceu em" : "Válida até"} ${formatDate(campaign.period_end)}` : "Sem data de validade"}
                      </span>
                    </div>

                    {alreadyRunning ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />Você já tem esta oferta no ar</p>
                        <p className="mt-0.5 opacity-80">Acompanhe em “Minhas campanhas”. Para publicar de novo, pause a atual.</p>
                      </div>
                    ) : (
                      <Button
                        className="w-full rounded-full"
                        variant={selected ? "default" : "outline"}
                        type="button"
                        onClick={() => { setSelectedOffer(campaign); setCampaignCreated(false); setSellerCampaignMessage(""); }}
                      >
                        {selected ? <><CheckCircle2 className="mr-2 h-4 w-4" />Oferta selecionada</> : "Selecionar oferta"}
                      </Button>
                    )}

                    {selected ? (
                      campaignCreated ? (
                        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" role="status">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            <div>
                              <p className="font-semibold text-primary">Campanha ativa</p>
                              <p className="mt-1 text-sm text-muted-foreground">Seu anúncio foi criado e está ativo para esta oferta.</p>
                            </div>
                          </div>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <p><span className="text-muted-foreground">Orçamento:</span> <strong>{formatCurrency(lastCampaignBudget)}{lastCampaignDuration === 0 ? " por dia" : ""}</strong></p>
                            <p><span className="text-muted-foreground">Duração:</span> <strong>{lastCampaignDuration === 0 ? "Contínua, até acabar o saldo" : `${lastCampaignDuration} dias`}</strong></p>
                            <p><span className="text-muted-foreground">Área:</span> <strong>10 km da loja</strong></p>
                          </div>
                          <Badge variant="default">ATIVA</Badge>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                          <p className="text-sm font-semibold">Defina seu anúncio</p>
                          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Tipo de campanha">
                            {([
                              ["period", "Por período", "Escolhe os dias"],
                              ["continuous", "Contínua", "Até acabar o saldo"],
                            ] as const).map(([value, label, hint]) => (
                              <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={campaignMode === value}
                                onClick={() => { setCampaignMode(value); setCampaignBudget(""); setSellerCampaignMessage(""); }}
                                className={`rounded-md px-2 py-1.5 text-left transition-colors ${campaignMode === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                <span className="block text-xs font-semibold">{label}</span>
                                <span className="block text-[10px] text-muted-foreground">{hint}</span>
                              </button>
                            ))}
                          </div>
                          {campaignMode === "period" ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor={`budget-${campaign.id}`}>Orçamento total</Label>
                                <Input id={`budget-${campaign.id}`} inputMode="decimal" placeholder="Ex.: 90" value={campaignBudget} onChange={(event) => setCampaignBudget(event.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`duration-${campaign.id}`}>Duração</Label>
                                <Select value={campaignDuration} onValueChange={setCampaignDuration}>
                                  <SelectTrigger id={`duration-${campaign.id}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="3">3 dias</SelectItem>
                                    <SelectItem value="7">7 dias</SelectItem>
                                    <SelectItem value="14">14 dias</SelectItem>
                                    <SelectItem value="30">30 dias</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label htmlFor={`daily-${campaign.id}`}>Valor por dia</Label>
                              <Input id={`daily-${campaign.id}`} inputMode="decimal" placeholder="Ex.: 30" value={campaignBudget} onChange={(event) => setCampaignBudget(event.target.value)} />
                            </div>
                          )}
                          <BudgetGuide
                            mode={campaignMode}
                            budget={campaignBudget}
                            duration={Number(campaignDuration)}
                            offerEnd={campaign.period_end}
                            onPick={setCampaignBudget}
                          />
                          <p className="text-xs text-muted-foreground">O material, oferta, loja e raio são definidos pela operação.</p>
                          <Button className="w-full rounded-full" type="button" disabled={creatingSellerCampaign} onClick={createSellerCampaign}>
                            {creatingSellerCampaign ? "Criando..." : "Criar campanha"}
                          </Button>
                          {sellerCampaignMessage ? <p className="text-xs text-muted-foreground" role="status">{sellerCampaignMessage}</p> : null}
                        </div>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    );
  }

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando biblioteca de campanhas...</CardContent></Card>;
  return <div className="space-y-6"><Card><CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><CardTitle>Biblioteca de campanhas</CardTitle><CardDescription>O Master controla as ofertas por marca. Pausar, editar ou excluir uma oferta afeta toda a operação daquela campanha.</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Select value={selectedBrand} onValueChange={setSelectedBrand}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Filtrar por marca" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as marcas</SelectItem>{brands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}</SelectContent></Select><Button onClick={() => { resetForm(); setMessage(""); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" />Nova oferta</Button></div></CardHeader></Card>
    {!showForm && message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}{updatedOfferId && !showForm ? <OfferAdsUpdater key={updatedOfferId} templateId={updatedOfferId} onClose={() => setUpdatedOfferId(null)} /> : null}{showForm ? <Card><CardHeader><CardTitle>{editingId ? "Editar oferta" : "Nova oferta"}</CardTitle><CardDescription>As alterações feitas aqui refletem na oferta da operação inteira.</CardDescription></CardHeader><CardContent><form className="grid gap-5 md:grid-cols-2" onSubmit={saveCampaign}><div className="space-y-2"><Label>Marca</Label><Select value={form.brandId} onValueChange={(value) => updateForm("brandId", value)}><SelectTrigger><SelectValue placeholder="Selecione a marca" /></SelectTrigger><SelectContent>{brands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="campaign-model">Modelo</Label><Input id="campaign-model" value={form.model} onChange={(event) => updateForm("model", event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="campaign-version">Versão</Label><Input id="campaign-version" value={form.version} onChange={(event) => updateForm("version", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="campaign-title">Título da oferta</Label><Input id="campaign-title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} required /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="campaign-description">Descrição</Label><Input id="campaign-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="campaign-price">Preço</Label><Input id="campaign-price" inputMode="decimal" value={form.price} onChange={(event) => updateForm("price", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="campaign-promo-price">Preço promocional</Label><Input id="campaign-promo-price" inputMode="decimal" value={form.promotionalPrice} onChange={(event) => updateForm("promotionalPrice", event.target.value)} /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="campaign-condition">Condição da oferta</Label><Input id="campaign-condition" value={form.offerCondition} onChange={(event) => updateForm("offerCondition", event.target.value)} placeholder="Ex.: Entrada a partir de R$ X + financiamento" /></div><div className="space-y-2"><Label htmlFor="campaign-start">Início</Label><Input id="campaign-start" type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="campaign-end">Fim</Label><Input id="campaign-end" type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} /></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => updateForm("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativa</SelectItem><SelectItem value="inactive">Inativa</SelectItem></SelectContent></Select></div><div className="space-y-2 md:col-span-2"><Label htmlFor="campaign-media">Fotos do anúncio — carrossel</Label><Input id="campaign-media" type="file" accept="image/*" multiple onChange={(event) => { handleMediaFilesChange(event.target.files); event.target.value = ""; }} /><p className="text-xs text-muted-foreground">Carrossel: de 1 a 10 fotos. Novas fotos entram no fim da lista; toque no X para remover uma foto. A primeira foto é a capa do anúncio.</p>{keptMedia.length + mediaFiles.length > 0 ? <div className="rounded-lg border p-2"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{keptMedia.length + mediaFiles.length} foto(s) no carrossel</span><span>máximo 10</span></div><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{keptMedia.map((url, index) => <div key={`kept-${url}-${index}`} className="relative"><img className="aspect-square w-full rounded object-cover" src={url} alt={`Foto ${index + 1}`} />{index === 0 ? <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Capa</span> : null}<button type="button" onClick={() => removeKeptMedia(index)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-bold leading-none text-white hover:bg-red-600" aria-label={`Remover foto ${index + 1}`}>×</button></div>)}{mediaFiles.map((mediaFile, index) => <div key={`new-${mediaFile.name}-${index}`} className="relative"><img className="aspect-square w-full rounded object-cover ring-2 ring-primary" src={URL.createObjectURL(mediaFile)} alt={`Nova foto ${index + 1}`} />{keptMedia.length === 0 && index === 0 ? <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Capa</span> : <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Nova</span>}<button type="button" onClick={() => removeNewMedia(index)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-bold leading-none text-white hover:bg-red-600" aria-label={`Remover nova foto ${index + 1}`}>×</button></div>)}</div></div> : previewUrl ? <div className="rounded-lg border p-2"><img className="max-h-72 w-full rounded-lg object-contain" src={previewUrl} alt="Prévia do material" /></div> : null}</div><div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={saving} type="submit">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar oferta"}</Button><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button></div>{message ? <p className="text-sm text-muted-foreground md:col-span-2" role="status">{message}</p> : null}</form></CardContent></Card> : null}
    <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Ofertas cadastradas</CardTitle><CardDescription>{visibleCampaigns.length} oferta(s) na seleção atual.</CardDescription></div><Button type="button" size="sm" variant={showArchived ? "secondary" : "outline"} onClick={() => void toggleArchived()}><Archive className="mr-1.5 h-4 w-4" />{showArchived ? "Esconder arquivadas" : "Mostrar arquivadas"}</Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visibleCampaigns.length === 0 ? <div className="col-span-full rounded-xl border border-dashed p-8 text-center"><p className="font-medium">Nenhuma campanha cadastrada</p><p className="mt-1 text-sm text-muted-foreground">Use “Nova oferta” para criar a primeira campanha.</p></div> : visibleCampaigns.map((campaign) => <Card className="overflow-hidden" key={campaign.id}><CampaignMedia campaign={campaign} /><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status === "active" ? "Ativa" : "Pausada"}</Badge><Badge variant="outline">{campaign.brands?.name}</Badge></div><div><CardTitle className="text-lg">{campaign.model} {campaign.version}</CardTitle><CardDescription>{campaign.title}</CardDescription></div><p className="text-sm text-muted-foreground">{campaign.offer_condition || campaign.description || "Sem condição informada."}</p><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Preço</p><p className="font-semibold">{formatCurrency(campaign.promotional_price ?? campaign.price)}</p></div><p className="text-xs text-muted-foreground">{formatDate(campaign.period_start)} até {formatDate(campaign.period_end)}</p></div><div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3"><Button size="sm" variant="outline" className="h-8 px-3 text-xs" title="Editar para toda a operação" onClick={() => startEditing(campaign)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="secondary" className="h-8 px-3 text-xs" title={campaign.status === "active" ? "Pausar esta campanha para todas as lojas e vendedores" : "Reativar esta campanha para toda a operação"} onClick={() => toggleCampaign(campaign)}>{campaign.status === "active" ? "Pausar" : "Reativar"}</Button><Button size="sm" variant="outline" className="h-8 px-3 text-xs" title="Arquivar: para os anúncios na Meta e tira dos vendedores, mantendo os resultados" onClick={() => void archiveCampaign(campaign)}><Archive className="mr-1.5 h-3.5 w-3.5" />Arquivar</Button><Button size="sm" variant="destructive" className="h-8 px-3 text-xs" title="Excluir esta campanha de todas as lojas e vendedores" onClick={() => deleteCampaign(campaign)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div><p className="text-xs text-muted-foreground">As ações desta oferta valem para todas as lojas e vendedores que a utilizam.</p></CardContent></Card>)}</CardContent></Card>{showArchived ? <Card className="border-dashed"><CardHeader><CardTitle>Ofertas arquivadas</CardTitle><CardDescription>Não aparecem para lojas nem vendedores. Os resultados das campanhas continuam nos relatórios.</CardDescription></CardHeader><CardContent>{archivedCampaigns === null ? <p className="text-sm text-muted-foreground">Carregando...</p> : archivedCampaigns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma oferta arquivada.</p> : <div className="space-y-2">{archivedCampaigns.map((campaign) => <div key={campaign.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{campaign.model} {campaign.version} <span className="text-sm font-normal text-muted-foreground">· {campaign.brands?.name}</span></p><p className="truncate text-sm text-muted-foreground">{campaign.title}</p><p className="text-xs text-muted-foreground">Validade {formatDate(campaign.period_start)} até {formatDate(campaign.period_end)} · arquivada em {campaign.archived_at ? new Date(campaign.archived_at).toLocaleDateString("pt-BR") : "—"}</p></div><Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void unarchiveCampaign(campaign)}><ArchiveRestore className="mr-1.5 h-4 w-4" />Reativar</Button></div>)}</div>}</CardContent></Card> : null}
  </div>;
}

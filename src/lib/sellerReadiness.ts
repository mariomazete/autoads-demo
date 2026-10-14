import { supabase } from "@/integrations/supabase/client";

export type SellerReadiness = {
  seller_id: string;
  full_name: string | null;
  whatsapp: string | null;
  meta_connected: boolean;
  meta_error: string | null;
  has_ad_account: boolean;
  has_page: boolean;
  page_name: string | null;
  connected_at: string | null;
  store_id?: string | null;
  store_name?: string | null;
};

export type ReadinessCheck = { key: string; label: string; ok: boolean };

/** What a seller needs before publishing on Meta, in the order they have to do it. */
export function readinessChecks(seller: SellerReadiness): ReadinessCheck[] {
  return [
    { key: "whatsapp", label: "WhatsApp cadastrado", ok: Boolean(seller.whatsapp?.trim()) },
    { key: "meta", label: "Meta conectada", ok: seller.meta_connected },
    { key: "account", label: "Conta de anúncios", ok: seller.has_ad_account },
    { key: "page", label: "Página do Facebook", ok: seller.has_page },
  ];
}

export const isReady = (seller: SellerReadiness) => readinessChecks(seller).every((check) => check.ok);

/** Readiness of every active seller in all stores (master only; read-only, no tokens exposed). */
export async function loadMasterSellerReadiness(): Promise<SellerReadiness[] | null> {
  const { data, error } = await supabase.rpc("get_master_seller_readiness" as never);
  if (error) return null;
  return (data ?? []) as unknown as SellerReadiness[];
}

/** Readiness of every active seller in the current manager's store (read-only, no tokens exposed). */
export async function loadSellerReadiness(): Promise<SellerReadiness[] | null> {
  const { data, error } = await supabase.rpc("get_store_seller_readiness" as never);
  if (error) return null;
  return (data ?? []) as unknown as SellerReadiness[];
}

/** Readiness of the logged-in seller (read-only, no tokens exposed). */
export async function loadMySellerReadiness(): Promise<SellerReadiness | null> {
  const { data, error } = await supabase.rpc("get_my_seller_readiness" as never);
  if (error) return null;
  const rows = (data ?? []) as unknown as SellerReadiness[];
  return rows[0] ?? null;
}

alter table public.seller_campaigns
  add column if not exists meta_delivery_status text,
  add column if not exists meta_delivery_detail text,
  add column if not exists meta_delivery_checked_at timestamptz;

comment on column public.seller_campaigns.meta_delivery_status is
  'Status de veiculação espelhado da Meta (in_review, approved, delivering, scheduled, rejected, with_issues, paused, billing, completed, deleted, unknown).';
comment on column public.seller_campaigns.meta_delivery_detail is
  'Motivo legível (reprovação, problema ou observação) retornado pela Meta.';

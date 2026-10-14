export type CampaignValidity = {
  validFrom: string | null;
  validUntil: string | null;
};

/**
 * Central safety gate for campaign validity.
 * Dates are interpreted as local campaign dates/times when supplied.
 */
export function isCampaignWithinValidity(
  validity: CampaignValidity,
  now = new Date(),
): boolean {
  if (!validity.validFrom || !validity.validUntil) return false;

  const start = new Date(validity.validFrom);
  const end = new Date(validity.validUntil);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  if (end.getTime() < start.getTime()) return false;

  const timestamp = now.getTime();
  return timestamp >= start.getTime() && timestamp <= end.getTime();
}

export function isCampaignExpired(
  validity: CampaignValidity,
  now = new Date(),
): boolean {
  if (!validity.validUntil) return true;
  const end = new Date(validity.validUntil);
  return Number.isNaN(end.getTime()) || now.getTime() > end.getTime();
}

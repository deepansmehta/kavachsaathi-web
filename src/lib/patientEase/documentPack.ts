/** F16 — Document pack helpers */

export const DOC_PACK_SECTIONS = [
  { id: "cover", label: "Cover page", defaultOn: true },
  { id: "cashless", label: "Cashless form", defaultOn: true },
  { id: "admission", label: "Admission sheet", defaultOn: true },
  { id: "id_proofs", label: "ID proofs", defaultOn: true },
  { id: "policy_card", label: "Policy card", defaultOn: true },
  { id: "policy_bond", label: "Policy bond", defaultOn: false },
  { id: "vault", label: "Latest 3 vault records", defaultOn: true },
] as const;

export type DocPackSectionId = (typeof DOC_PACK_SECTIONS)[number]["id"];

/** Mask Aadhaar — show last 4 only */
export function maskAadhaar(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 4) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

const rateMap = new Map<string, number[]>();

/** In-memory rate limit: max 10 document-pack downloads / hour / profile */
export function checkDocPackRateLimit(
  profileId: string,
  max = 10,
  windowMs = 60 * 60 * 1000
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const prev = (rateMap.get(profileId) || []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    rateMap.set(profileId, prev);
    return { ok: false, remaining: 0 };
  }
  prev.push(now);
  rateMap.set(profileId, prev);
  return { ok: true, remaining: max - prev.length };
}

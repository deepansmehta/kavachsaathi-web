/** KavachSaathi health_id formats:
 *  - Production: KVS-YYYY-XXXXX (4-digit year + 5 alphanumeric)
 *  - Demo only:  KVS-DEMO-XXXXX (literal DEMO + 5 alphanumeric)
 */
export const HEALTH_ID_RE = /^KVS-(?:\d{4}|DEMO)-[A-Z0-9]{5}$/i;

export function normalizeHealthId(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

export function isValidHealthId(raw: string): boolean {
  return HEALTH_ID_RE.test(normalizeHealthId(raw));
}

export function isDemoHealthId(raw: string): boolean {
  return /^KVS-DEMO-[A-Z0-9]{5}$/i.test(normalizeHealthId(raw));
}

/** Disposable / rehearsal kits (KVS-2099-*) — not sold inventory. */
export function isDisposableHealthId(raw: string): boolean {
  return /^KVS-2099-[A-Z0-9]{5}$/i.test(normalizeHealthId(raw));
}

/** Real sold inventory only (KVS-2026-*). */
export function isRealInventoryHealthId(raw: string): boolean {
  return /^KVS-2026-[A-Z0-9]{5}$/i.test(normalizeHealthId(raw));
}

export function isCardActivatedStatus(status: unknown, activated?: unknown): boolean {
  if (activated === true) return true;
  const s = String(status || "").toLowerCase();
  // blocked cards remain "activated" historically but are not publicly usable
  return s === "activated" || s === "active";
}

export function isCardBlockedStatus(status: unknown): boolean {
  return String(status || "").toLowerCase() === "blocked";
}

export function isCardUnactivatedStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s === "unactivated" || s === "available" || s === "";
}

/** Normalize admin/list display status */
export function normalizeCardStatus(
  status: unknown
): "unactivated" | "activated" | "blocked" {
  const s = String(status || "").toLowerCase();
  if (s === "blocked") return "blocked";
  if (s === "activated" || s === "active") return "activated";
  return "unactivated";
}

/** Generic public error — do not reveal whether an id exists or is malformed */
export const INVALID_CARD_MESSAGE =
  "This QR / link is not a valid KavachSaathi card.";

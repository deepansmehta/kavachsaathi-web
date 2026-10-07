/** KavachSaathi health_id formats:
 *  - Production: KVS-YYYY-XXXXX (4-digit year + 5 alphanumeric)
 *  - Demo only:  KVS-DEMO-XXXXX (literal DEMO + 5 alphanumeric)
 *  - Disposable/test (2099): 5–6 alphanumeric suffix (e.g. REH01, AUTO01)
 */
export const HEALTH_ID_RE = /^KVS-(?:\d{4}|DEMO)-[A-Z0-9]{5}$/i;
/** KVS-2099 test/rehearsal kits — 5 or 6 char suffix (AUTO01 etc.). */
export const DISPOSABLE_HEALTH_ID_RE = /^KVS-2099-[A-Z0-9]{5,6}$/i;

export function normalizeHealthId(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

export function isValidHealthId(raw: string): boolean {
  const id = normalizeHealthId(raw);
  return HEALTH_ID_RE.test(id) || DISPOSABLE_HEALTH_ID_RE.test(id);
}

export function isDemoHealthId(raw: string): boolean {
  return /^KVS-DEMO-[A-Z0-9]{5}$/i.test(normalizeHealthId(raw));
}

/** Disposable / rehearsal / auto-test kits (KVS-2099-*) — not sold inventory. */
export function isDisposableHealthId(raw: string): boolean {
  return DISPOSABLE_HEALTH_ID_RE.test(normalizeHealthId(raw));
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

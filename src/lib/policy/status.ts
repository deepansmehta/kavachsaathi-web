import { EXPIRING_SOON_DAYS } from "./constants";

export type PolicyStatus = "active" | "expiring_soon" | "expired";

/** Parse YYYY-MM-DD or ISO date to local-midnight Date, or null */
export function parsePolicyDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function daysUntil(end: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function policyStatus(
  endDate: string | null | undefined,
  from = new Date()
): PolicyStatus {
  const end = parsePolicyDate(endDate);
  if (!end) return "active";
  const d = daysUntil(end, from);
  if (d < 0) return "expired";
  if (d <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

/** DD-MM-YYYY for display */
export function formatPolicyDateDMY(raw: string | null | undefined): string | null {
  const d = parsePolicyDate(raw);
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function maskPolicyNumber(last4: string | null | undefined): string {
  const t = String(last4 || "").replace(/\D/g, "").slice(-4);
  if (!t) return "****";
  return `****${t}`;
}

export function last4FromNumber(num: string | null | undefined): string | null {
  const digits = String(num || "").replace(/\s/g, "");
  if (!digits) return null;
  return digits.slice(-4);
}

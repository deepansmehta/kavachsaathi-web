/**
 * Indian mobile normalization — single source of truth for login/activation.
 * Canonical stored form: +91XXXXXXXXXX (10-digit local, starts 6–9).
 */

export function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) {
    return `+91${d}`;
  }
  return null;
}

/** 10-digit local form (legacy field `phone`) */
export function phoneLocal10(normalizedOrRaw: string): string | null {
  const n = normalizePhone(normalizedOrRaw);
  return n ? n.slice(-10) : null;
}

export function maskPhone(raw: string): string {
  const n = normalizePhone(raw);
  if (!n) return "+91 XXXXXX****";
  return `+91 XXXXXX${n.slice(-4)}`;
}

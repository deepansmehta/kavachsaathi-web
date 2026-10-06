/**
 * Card validity / renewal helpers (F46).
 * Emergency view is NEVER blocked by expiry — only owner Full Details / PDFs / vault.
 */

export const VALIDITY_DAYS =
  Number(process.env.CARD_VALIDITY_DAYS || 365) || 365;
export const GRACE_DAYS = Number(process.env.CARD_GRACE_DAYS || 30) || 30;

export type ValidityInput = {
  validFrom?: unknown;
  validTill?: unknown;
  activatedAt?: unknown;
};

export type ValidityResult = {
  validFrom: Date | null;
  validTill: Date | null;
  daysRemaining: number | null;
  /** Past validTill */
  expired: boolean;
  /** Past validTill but within grace */
  inGrace: boolean;
  /** Past validTill + grace — owner extras blocked */
  ownerFeaturesLocked: boolean;
  /** Aliases for older call sites */
  isExpired: boolean;
  isInGrace: boolean;
  isPastGrace: boolean;
};

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Add calendar days; returns a Date. */
export function addDays(from: Date | string, days: number): Date {
  const d =
    typeof from === "string" ? new Date(from) : new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addDaysIso(from: Date | string, days: number): string {
  return addDays(from, days).toISOString();
}

export function defaultValidTillFrom(activatedAt: Date | string): string {
  return addDaysIso(activatedAt, VALIDITY_DAYS);
}

/**
 * Compute validity from card fields.
 * Accepts either an object `{ validFrom, validTill, activatedAt }` or
 * legacy `(activatedAt, validTillOverride[, now])`.
 */
export function computeValidity(
  inputOrActivated: ValidityInput | unknown,
  validTillOrNow?: unknown,
  maybeNow?: Date
): ValidityResult {
  let validFrom: Date | null = null;
  let validTill: Date | null = null;
  let now = new Date();

  if (
    inputOrActivated &&
    typeof inputOrActivated === "object" &&
    !(inputOrActivated instanceof Date) &&
    ("validFrom" in (inputOrActivated as object) ||
      "validTill" in (inputOrActivated as object) ||
      "activatedAt" in (inputOrActivated as object))
  ) {
    const o = inputOrActivated as ValidityInput;
    validFrom = toDate(o.validFrom) || toDate(o.activatedAt);
    validTill = toDate(o.validTill);
    if (validTillOrNow instanceof Date) now = validTillOrNow;
    else if (validTillOrNow) now = toDate(validTillOrNow) || now;
  } else {
    validFrom = toDate(inputOrActivated);
    validTill = toDate(validTillOrNow);
    if (maybeNow) now = maybeNow;
  }

  if (!validTill && validFrom) {
    validTill = addDays(validFrom, VALIDITY_DAYS);
  }

  let daysRemaining: number | null = null;
  let expired = false;
  let inGrace = false;
  let ownerFeaturesLocked = false;

  if (validTill) {
    const ms = validTill.getTime() - now.getTime();
    daysRemaining = Math.ceil(ms / (1000 * 60 * 60 * 24));
    expired = daysRemaining < 0;
    if (expired) {
      const daysPast = Math.abs(daysRemaining);
      inGrace = daysPast <= GRACE_DAYS;
      ownerFeaturesLocked = daysPast > GRACE_DAYS;
    }
  }

  return {
    validFrom,
    validTill,
    daysRemaining,
    expired,
    inGrace,
    ownerFeaturesLocked,
    isExpired: expired,
    isInGrace: inGrace,
    isPastGrace: ownerFeaturesLocked,
  };
}

export function isInGrace(
  activatedAt: unknown,
  validTillOverride?: unknown
): boolean {
  return computeValidity(activatedAt, validTillOverride).inGrace;
}

export function isPastGrace(
  activatedAt: unknown,
  validTillOverride?: unknown
): boolean {
  return computeValidity(activatedAt, validTillOverride).ownerFeaturesLocked;
}

export function daysRemaining(
  activatedAt: unknown,
  validTillOverride?: unknown
): number | null {
  return computeValidity(activatedAt, validTillOverride).daysRemaining;
}

export function maskPhone(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `${"*".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
}

export function firstNameOnly(fullName: string): string {
  return String(fullName || "").trim().split(/\s+/)[0] || "";
}

/** JSON error when owner extras are locked after grace. */
export function pastGraceResponseBody() {
  return {
    error: "Card validity expired — renew at kavachsaathi.in",
    code: "VALIDITY_EXPIRED",
  };
}

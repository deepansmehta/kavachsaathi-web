/**
 * Activation launch gate (server authoritative).
 *
 * Real kits may activate only when BOTH:
 *  1) ACTIVATION_ENABLED is not an explicit kill-switch ("false"/"0"/"off"/"no")
 *  2) server time (UTC) >= ACTIVATION_OPENS_AT
 *
 * Site pre-launch middleware uses the SAME ACTIVATION_OPENS_AT instant
 * (see src/lib/launchConfig.ts isSiteLaunched).
 *
 * Demo (KVS-DEMO-*), disposable (KVS-2099-*), and isDemo:true cards are always exempt.
 * ACTIVATION_TEST_NOW / ACTIVATION_TEST_AS_REAL are ignored in production.
 */
import { isDemoHealthId, normalizeHealthId } from "./healthId";
import { getSiteLaunchAt, getSiteLaunchNow } from "./launchConfig";

export type ActivationDenyCode =
  | "ACTIVATION_NOT_OPEN"
  | "ACTIVATION_DISABLED";

export type ActivationGateResult =
  | { ok: true }
  | { ok: false; code: ActivationDenyCode; message: string };

const KILL_VALUES = new Set(["0", "false", "no", "off"]);

/** Emergency kill switch — true when activation must stay closed. */
export function isActivationKillSwitchOn(): boolean {
  const v = String(process.env.ACTIVATION_ENABLED || "")
    .trim()
    .toLowerCase();
  return KILL_VALUES.has(v);
}

/** @deprecated use !isActivationKillSwitchOn() && isActivationScheduleOpen() */
export function isActivationEnabled(): boolean {
  return !isActivationKillSwitchOn() && isActivationScheduleOpen();
}

export function getActivationOpensAt(): Date | null {
  // Prefer env; fall back to shared site launch instant so gates never drift
  const raw = String(process.env.ACTIVATION_OPENS_AT || "").trim();
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return getSiteLaunchAt();
}

function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const ctx = String(process.env.CONTEXT || process.env.NETLIFY_CONTEXT || "")
    .trim()
    .toLowerCase();
  if (ctx === "production") return true;
  return false;
}

/**
 * Mockable clock for tests. ACTIVATION_TEST_NOW is ignored in production.
 * Shared with site pre-launch via getSiteLaunchNow().
 */
export function getActivationNow(): Date {
  return getSiteLaunchNow();
}

export function isActivationScheduleOpen(now = getActivationNow()): boolean {
  const opens = getActivationOpensAt();
  if (!opens) return false;
  return now.getTime() >= opens.getTime();
}

/** Non-prod only: treat listed health IDs as real (not exempt) for gate tests. */
function isForcedRealForTest(id: string): boolean {
  if (isProductionRuntime()) return false;
  const list = String(process.env.ACTIVATION_TEST_AS_REAL || "")
    .split(",")
    .map((s) => normalizeHealthId(s.trim()))
    .filter(Boolean);
  return list.includes(id);
}

/** Kits that may activate even when the global gate is closed. */
export function isActivationExemptHealthId(raw: string): boolean {
  const id = normalizeHealthId(raw);
  if (isForcedRealForTest(id)) return false;
  if (isDemoHealthId(id)) return true;
  if (/^KVS-2099-[A-Z0-9]{5}$/i.test(id)) return true;
  return false;
}

export const ACTIVATION_NOT_OPEN_MESSAGE =
  "Activation opens on 11 October 2026, 12:00 PM IST. Your QR stays valid — please try again after that time.";

export const ACTIVATION_DISABLED_MESSAGE =
  "Activation is temporarily closed. Your QR stays valid — please try again later.";

/** Prefer schedule message when opens-at is known. */
export function activationNotOpenMessage(): string {
  const opens = getActivationOpensAt();
  if (!opens) return ACTIVATION_NOT_OPEN_MESSAGE;
  try {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(opens);
    return `Activation opens on ${fmt} IST. Your QR stays valid — please try again after that time.`;
  } catch {
    return ACTIVATION_NOT_OPEN_MESSAGE;
  }
}

export function evaluateActivationGate(
  raw: string,
  cardIsDemo?: boolean | null,
  now = getActivationNow()
): ActivationGateResult {
  if (cardIsDemo === true) return { ok: true };
  if (isActivationExemptHealthId(raw)) return { ok: true };

  if (isActivationKillSwitchOn()) {
    return {
      ok: false,
      code: "ACTIVATION_DISABLED",
      message: ACTIVATION_DISABLED_MESSAGE,
    };
  }

  if (!isActivationScheduleOpen(now)) {
    return {
      ok: false,
      code: "ACTIVATION_NOT_OPEN",
      message: activationNotOpenMessage(),
    };
  }

  return { ok: true };
}

export function canActivateHealthId(
  raw: string,
  cardIsDemo?: boolean | null,
  now = getActivationNow()
): boolean {
  return evaluateActivationGate(raw, cardIsDemo, now).ok;
}

/** @deprecated use activationNotOpenMessage / ACTIVATION_DISABLED_MESSAGE */
export const ACTIVATION_CLOSED_MESSAGE = ACTIVATION_NOT_OPEN_MESSAGE;

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
} as const;

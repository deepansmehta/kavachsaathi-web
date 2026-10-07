/**
 * Site pre-launch / marketing gate — SAME instant as activation schedule.
 *
 * Source of truth (in order):
 *   1) ACTIVATION_OPENS_AT (server env — preferred; also gates real-card activation)
 *   2) NEXT_PUBLIC_LAUNCH_DATE (legacy / client countdown)
 *   3) DEFAULT_SITE_LAUNCH_AT hardcoded fallback
 *
 * At that moment the middleware unlocks /my-profile, marketing pages, etc.
 * with NO redeploy — it compares request time to this fixed Instant.
 *
 * Emergency overrides (no schedule change needed):
 *   SITE_PRELAUNCH_FORCE=open   → treat site as launched
 *   SITE_PRELAUNCH_FORCE=closed → keep pre-launch gate on
 *
 * Mock clock ACTIVATION_TEST_NOW: site pre-launch middleware only (non-prod).
 * It NEVER opens real-card activation — see activationGate.getActivationNow().
 *
 * Preview unlock (pre-launch QA only):
 *   ?preview=<PRELAUNCH_PREVIEW_SECRET> + httpOnly cookie (2h).
 *   Secret from env only — no hardcoded fallback. Unset → no bypass.
 *   After site launch instant → preview has no effect (cookie cleared).
 */

import { timingSafeEqual } from "crypto";

export const DEFAULT_SITE_LAUNCH_AT = "2026-10-11T12:00:00+05:30";

/** httpOnly cookie set after a valid ?preview= secret (2 hours). */
export const LAUNCH_PREVIEW_COOKIE = "kavach_preview_v3";

/** Cookie lifetime — 2 hours. */
export const PRELAUNCH_PREVIEW_COOKIE_MAX_AGE_SEC = 60 * 60 * 2;

/** @deprecated removed hardcoded secret — use getPrelaunchPreviewSecret() */
export const LAUNCH_PREVIEW_SECRET = "";

function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const ctx = String(process.env.CONTEXT || process.env.NETLIFY_CONTEXT || "")
    .trim()
    .toLowerCase();
  return ctx === "production";
}

/**
 * Preview secret from env PRELAUNCH_PREVIEW_SECRET (set on Netlify production only).
 * Empty / unset / too short → null (no bypass). No hardcoded fallback.
 * Netlify deploy-preview/branch contexts do not have this var → no bypass there.
 */
export function getPrelaunchPreviewSecret(): string | null {
  const s = String(process.env.PRELAUNCH_PREVIEW_SECRET || "").trim();
  if (s.length < 16) return null;
  return s;
}

function safeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** True when ?preview= matches PRELAUNCH_PREVIEW_SECRET (production + env set). */
export function previewParamMatchesSecret(
  previewRaw: string | null | undefined
): boolean {
  const secret = getPrelaunchPreviewSecret();
  if (!secret || previewRaw == null || previewRaw === "") return false;
  if (
    previewRaw === "off" ||
    previewRaw === "clear" ||
    previewRaw === "0"
  ) {
    return false;
  }
  return safeEqualString(previewRaw, secret);
}

/**
 * Whether the pre-launch gate may be bypassed for this request.
 * After launch instant → always false (preview has no effect).
 */
export function isPrelaunchPreviewActive(opts: {
  previewParam?: string | null;
  cookieValue?: string | null;
  now?: Date;
}): boolean {
  if (isSiteLaunched(opts.now)) return false;
  if (!getPrelaunchPreviewSecret()) return false;
  if (previewParamMatchesSecret(opts.previewParam ?? null)) return true;
  if (opts.cookieValue === "1") return true;
  return false;
}

/** Resolved launch / activation-open instant (ms since epoch). */
export function getSiteLaunchAtMs(): number {
  const raw = String(
    process.env.ACTIVATION_OPENS_AT ||
      process.env.NEXT_PUBLIC_LAUNCH_DATE ||
      DEFAULT_SITE_LAUNCH_AT
  ).trim();
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return Date.parse(DEFAULT_SITE_LAUNCH_AT);
  return t;
}

export function getSiteLaunchAt(): Date {
  return new Date(getSiteLaunchAtMs());
}

/**
 * Clock for launch + activation gates.
 * ACTIVATION_TEST_NOW is honored only outside production.
 */
export function getSiteLaunchNow(): Date {
  if (!isProductionRuntime()) {
    const raw = String(process.env.ACTIVATION_TEST_NOW || "").trim();
    if (raw) {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) return new Date(t);
    }
  }
  return new Date();
}

/** Emergency override — null when unset / invalid. */
export function getSitePrelaunchForce(): "open" | "closed" | null {
  const v = String(
    process.env.SITE_PRELAUNCH_FORCE || process.env.LAUNCH_FORCE || ""
  )
    .trim()
    .toLowerCase();
  if (v === "open" || v === "1" || v === "true" || v === "on") return "open";
  if (v === "closed" || v === "0" || v === "false" || v === "off")
    return "closed";
  return null;
}

/**
 * Marketing /my-profile /api/profile pre-launch gate.
 * Opens automatically when now >= ACTIVATION_OPENS_AT (same as kit activation).
 */
export function isSiteLaunched(now: Date = getSiteLaunchNow()): boolean {
  const force = getSitePrelaunchForce();
  if (force === "open") return true;
  if (force === "closed") return false;
  return now.getTime() >= getSiteLaunchAtMs();
}

/** @deprecated use getSiteLaunchAt() — kept for countdown UI imports */
export const LAUNCH_DATE: Date = new Proxy(new Date(DEFAULT_SITE_LAUNCH_AT), {
  get(_target, prop) {
    if (prop === "getTime") return () => getSiteLaunchAtMs();
    if (prop === "toISOString")
      return () => new Date(getSiteLaunchAtMs()).toISOString();
    if (prop === "valueOf") return () => getSiteLaunchAtMs();
    const live = new Date(getSiteLaunchAtMs());
    const v = Reflect.get(live, prop, live);
    return typeof v === "function" ? v.bind(live) : v;
  },
}) as Date;

/** @deprecated use isSiteLaunched */
export function isLaunched(now = getSiteLaunchNow()): boolean {
  return isSiteLaunched(now);
}

/**
 * Preview-only launch simulation (30-second dry run).
 *
 * Active ONLY when:
 *   1) Netlify CONTEXT / NETLIFY_CONTEXT is NOT "production"
 *   2) LAUNCH_SIM_ENABLED === "true"
 *
 * Cookie `ks_launch_sim` stores the simulated launch epoch (ms). While present,
 * middleware + activation gates treat that instant as ACTIVATION_OPENS_AT, and
 * the demo card is NOT exempt.
 *
 * Production always ignores this — no env/cookie can turn it on when CONTEXT=production.
 */

export const LAUNCH_SIM_COOKIE = "ks_launch_sim";

export const LAUNCH_SIM_MIN_SEC = 10;
export const LAUNCH_SIM_MAX_SEC = 300;

/** True only on non-production Netlify contexts with the flag on. */
export function isLaunchSimEnabled(): boolean {
  const ctx = String(process.env.CONTEXT || process.env.NETLIFY_CONTEXT || "")
    .trim()
    .toLowerCase();
  if (ctx === "production") return false;
  const flag = String(process.env.LAUNCH_SIM_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "true" || flag === "1" || flag === "on" || flag === "yes";
}

/** Parse cookie value → opens-at epoch ms, or null if invalid. */
export function parseLaunchSimCookie(
  raw: string | undefined | null
): number | null {
  if (!isLaunchSimEnabled()) return null;
  const v = String(raw || "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Reject absurd values (more than 1 day in the past or 2 days ahead)
  const now = Date.now();
  if (n < now - 24 * 60 * 60_000 || n > now + 2 * 24 * 60 * 60_000) return null;
  return Math.floor(n);
}

export function parseLaunchInParam(
  raw: string | null | undefined
): "reset" | number | null {
  if (!isLaunchSimEnabled()) return null;
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "reset" || v === "off" || v === "clear" || v === "0") return "reset";
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const sec = Math.floor(n);
  if (sec < LAUNCH_SIM_MIN_SEC || sec > LAUNCH_SIM_MAX_SEC) return null;
  return sec;
}

/** Cookie options for set/clear. */
export function launchSimCookieOptions(maxAgeSec: number) {
  return {
    path: "/",
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: true,
    maxAge: Math.max(0, maxAgeSec),
  };
}

export type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export function getLaunchSimOpensAtMs(
  cookieStore: CookieReader | null | undefined
): number | null {
  if (!cookieStore) return null;
  return parseLaunchSimCookie(cookieStore.get(LAUNCH_SIM_COOKIE)?.value);
}

/** Format sim opens-at for ActivationSoon headline. */
export function formatSimOpensMessage(opensAtMs: number): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date(opensAtMs));
    return `Activation opens on ${fmt} IST (simulated)`;
  } catch {
    return "Activation opens soon (simulated)";
  }
}

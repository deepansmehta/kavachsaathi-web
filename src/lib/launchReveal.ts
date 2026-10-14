/**
 * Launch-day cinematic reveal (11 Oct 2026, 12:00–23:59:59 IST).
 * Server time is authoritative — clients must call /api/time or /api/launch-reveal/status.
 */

export const LAUNCH_REVEAL_STORAGE_KEY = "kavach_launch_reveal_seen_v1";

/** Inclusive window: noon IST through end of calendar day IST. */
export const LAUNCH_REVEAL_DAY_START_MS = Date.parse(
  "2026-10-11T12:00:00+05:30"
);
export const LAUNCH_REVEAL_DAY_END_MS = Date.parse(
  "2026-10-11T23:59:59.999+05:30"
);
/** From this instant the reveal bundle must never load. */
export const LAUNCH_REVEAL_NEVER_AFTER_MS = Date.parse(
  "2026-10-12T00:00:00+05:30"
);

/** Paths that may mount the reveal. Everything else is blocked. */
export function isLaunchRevealPathAllowed(pathname: string): boolean {
  const p = String(pathname || "/").split("?")[0] || "/";
  return p === "/" || p === "" || p === "/coming-soon";
}

export function isLaunchRevealDay(nowMs: number): boolean {
  return nowMs >= LAUNCH_REVEAL_DAY_START_MS && nowMs <= LAUNCH_REVEAL_DAY_END_MS;
}

export function isAfterRevealEra(nowMs: number): boolean {
  return nowMs >= LAUNCH_REVEAL_NEVER_AFTER_MS;
}

export function isBeforeLaunchInstant(nowMs: number): boolean {
  return nowMs < LAUNCH_REVEAL_DAY_START_MS;
}

export function hasSeenLaunchReveal(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LAUNCH_REVEAL_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLaunchRevealSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAUNCH_REVEAL_STORAGE_KEY, "1");
  } catch {
    /* */
  }
}

export function clearLaunchRevealSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAUNCH_REVEAL_STORAGE_KEY);
  } catch {
    /* */
  }
}

/** Pack catalog lives in pricing.ts (single source of truth with /pricing). */
export type { LaunchPack } from "@/lib/pricing";
export { LAUNCH_PACKS } from "@/lib/pricing";

export const ORDER_STATUSES = [
  "requested",
  "confirmed",
  "paid",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Scene durations (ms) — match reference.html DUR (without rehearsal countdown):
 * reveal · brothers · leadership · birthday · slot · order(stays).
 */
export const LAUNCH_REVEAL_SCENE_DUR: (number | null)[] = [
  6500, 10000, 7500, 9000, 11500, null,
];
export const LAUNCH_REVEAL_REHEARSAL_COUNTDOWN_MS = 30000;

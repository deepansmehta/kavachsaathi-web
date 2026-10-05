/**
 * Public launch moment — 11 October 2026, 12:00 PM (noon) IST.
 * Explicit +05:30 so UTC hosts (Netlify) compare correctly.
 *
 * Middleware hardcodes the same instant (do not drift).
 * Local test override: set NEXT_PUBLIC_LAUNCH_DATE in .env.local
 * (e.g. a past ISO date), restart `npm run dev`, then restore this default.
 */
export const LAUNCH_DATE = new Date(
  process.env.NEXT_PUBLIC_LAUNCH_DATE || "2026-10-11T12:00:00+05:30"
);

/** ?preview=<secret> unlocks the full site before launch (for internal QA) */
export const LAUNCH_PREVIEW_SECRET = "kavach2026secret";

/** Bump name when re-locking so stale QA cookies cannot keep the site open */
export const LAUNCH_PREVIEW_COOKIE = "kavach_preview_v2";

export function isLaunched(now = new Date()): boolean {
  return now.getTime() >= LAUNCH_DATE.getTime();
}

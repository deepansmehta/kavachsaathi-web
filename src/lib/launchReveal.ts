/**
 * Launch-day cinematic reveal gate (11 Oct 2026, 12:00–23:59 IST).
 * Once per browser via localStorage. Owner may force with ?replayLaunch=1.
 */

export const LAUNCH_REVEAL_STORAGE_KEY = "kavach_launch_reveal_seen_v1";

/** Inclusive window: noon IST through end of calendar day IST. */
export const LAUNCH_REVEAL_DAY_START_MS = Date.parse(
  "2026-10-11T12:00:00+05:30"
);
export const LAUNCH_REVEAL_DAY_END_MS = Date.parse(
  "2026-10-11T23:59:59.999+05:30"
);

/** Routes where the reveal must never appear. */
const BLOCKED_PREFIXES = [
  "/card",
  "/e/",
  "/emergency",
  "/admin",
  "/hospital",
  "/org",
  "/my-profile",
  "/login",
  "/activate",
  "/forgot-pin",
  "/reset-pin",
  "/dashboard",
  "/profile",
  "/my-card",
  "/scan-history",
  "/offline",
  "/pass",
  "/api",
  "/coming-soon",
  "/doctor",
];

export function isLaunchRevealPathBlocked(pathname: string): boolean {
  const p = String(pathname || "/").split("?")[0] || "/";
  if (p === "/card" || p.startsWith("/card/")) return true;
  return BLOCKED_PREFIXES.some(
    (b) => p === b || p.startsWith(b.endsWith("/") ? b : `${b}/`)
  );
}

export function isLaunchRevealDay(now = new Date()): boolean {
  const t = now.getTime();
  return t >= LAUNCH_REVEAL_DAY_START_MS && t <= LAUNCH_REVEAL_DAY_END_MS;
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

/**
 * Whether the full-screen reveal should mount.
 * - Launch day + not yet seen + allowed path
 * - OR ?replayLaunch=1 (owner preview; clears seen)
 */
export function shouldShowLaunchReveal(opts: {
  pathname: string;
  searchParams: URLSearchParams | { get(name: string): string | null };
  now?: Date;
}): boolean {
  if (isLaunchRevealPathBlocked(opts.pathname)) return false;
  // Only on home (and bare marketing root)
  const p = (opts.pathname || "/").split("?")[0] || "/";
  if (p !== "/" && p !== "") return false;
  const replay =
    String(opts.searchParams.get("replayLaunch") || "") === "1";
  if (replay) return true;
  if (!isLaunchRevealDay(opts.now)) return false;
  if (hasSeenLaunchReveal()) return false;
  return true;
}

export type LaunchPack = {
  id: string;
  label: string;
  cards: string;
  price: number;
  save: number;
  best?: boolean;
};

export const LAUNCH_PACKS: LaunchPack[] = [
  { id: "Single", label: "Single", cards: "1 card", price: 499, save: 0 },
  {
    id: "Couple / Jodi",
    label: "Couple / Jodi",
    cards: "2 cards",
    price: 899,
    save: 99,
  },
  {
    id: "Parents Suraksha",
    label: "Parents Suraksha",
    cards: "2 cards + help",
    price: 949,
    save: 49,
  },
  {
    id: "Family Pack",
    label: "Family Pack",
    cards: "4 cards",
    price: 1599,
    save: 397,
    best: true,
  },
  {
    id: "Joint Family",
    label: "Joint Family",
    cards: "6 cards",
    price: 2199,
    save: 795,
  },
];

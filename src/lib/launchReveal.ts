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

export type LaunchPack = {
  id: string;
  label: string;
  cards: string;
  cardCount: number;
  price: number;
  save: number;
  best?: boolean;
};

export const LAUNCH_PACKS: LaunchPack[] = [
  {
    id: "Single",
    label: "Single",
    cards: "1 card",
    cardCount: 1,
    price: 499,
    save: 0,
  },
  {
    id: "Couple / Jodi",
    label: "Couple / Jodi",
    cards: "2 cards",
    cardCount: 2,
    price: 899,
    save: 99,
  },
  {
    id: "Parents Suraksha",
    label: "Parents Suraksha",
    cards: "2 cards + activation help",
    cardCount: 2,
    price: 949,
    save: 49,
  },
  {
    id: "Family Pack",
    label: "Family Pack",
    cards: "4 cards",
    cardCount: 4,
    price: 1599,
    save: 397,
    best: true,
  },
  {
    id: "Joint Family",
    label: "Joint Family",
    cards: "6 cards",
    cardCount: 6,
    price: 2199,
    save: 795,
  },
];

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

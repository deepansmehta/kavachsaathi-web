/**
 * Shared pending/ upload cleanup logic.
 * ONLY deletes Storage objects under pending/ that are older than cutoff.
 * Never touches profiles/, accessLogs, cards, or KVS-2026-* paths.
 */

export const PENDING_PREFIX = "pending/";
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingFileMeta = {
  name: string;
  updated?: string | null;
  timeCreated?: string | null;
};

export type CleanupSelection = {
  path: string;
  ageMs: number;
  reason: "old_pending";
};

export type CleanupPlan = {
  scanned: number;
  selected: CleanupSelection[];
  skipped: number;
  dryRun: boolean;
  cutoffMs: number;
};

/** Reject any path that is not a pending upload. */
export function isSafePendingPath(path: string): boolean {
  const p = String(path || "").replace(/^\/+/, "");
  if (!p.startsWith(PENDING_PREFIX)) return false;
  if (p.includes("..")) return false;
  // Never allow profiles / activated docs / real kit profile trees
  if (p.startsWith("profiles/")) return false;
  if (/KVS-2026-/i.test(p)) return false;
  if (p.startsWith("accessLogs") || p.includes("/accessLogs/")) return false;
  return true;
}

export function fileAgeMs(meta: PendingFileMeta, now = Date.now()): number | null {
  const raw = meta.updated || meta.timeCreated;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return now - t;
}

/**
 * Pure planner: given file list + age, select only old pending/ objects.
 * Activated profiles are never in this list when callers pass only pending/ prefix.
 */
export function planPendingCleanup(
  files: PendingFileMeta[],
  opts: {
    maxAgeMs?: number;
    dryRun?: boolean;
    now?: number;
  } = {}
): CleanupPlan {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = opts.now ?? Date.now();
  const dryRun = opts.dryRun === true;
  const cutoffMs = now - maxAgeMs;
  const selected: CleanupSelection[] = [];
  let skipped = 0;

  for (const f of files) {
    const path = String(f.name || "");
    if (!isSafePendingPath(path)) {
      skipped += 1;
      continue;
    }
    const age = fileAgeMs(f, now);
    if (age == null) {
      skipped += 1;
      continue;
    }
    const updated = new Date(f.updated || f.timeCreated || 0).getTime();
    if (updated >= cutoffMs) {
      skipped += 1;
      continue;
    }
    selected.push({ path, ageMs: age, reason: "old_pending" });
  }

  return {
    scanned: files.length,
    selected,
    skipped,
    dryRun,
    cutoffMs,
  };
}

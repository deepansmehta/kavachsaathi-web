import { getAdminDb } from "@/lib/firebase-admin";
import {
  FEATURE_KEYS,
  mergeFeatureFlags,
  type FeatureFlags,
  type FeatureKey,
} from "./flags";

let cache: { at: number; flags: FeatureFlags } | null = null;
const TTL_MS = 15_000;

export async function loadFeatureFlags(): Promise<FeatureFlags> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.flags;
  try {
    const db = getAdminDb();
    const snap = await db.collection("config").doc("features").get();
    const flags = mergeFeatureFlags(snap.exists ? snap.data() : null);
    cache = { at: now, flags };
    return flags;
  } catch {
    const flags = mergeFeatureFlags(null);
    cache = { at: now, flags };
    return flags;
  }
}

export async function requireFeature(key: FeatureKey): Promise<FeatureFlags | null> {
  const flags = await loadFeatureFlags();
  if (!flags[key]) return null;
  return flags;
}

export async function saveFeatureFlags(
  patch: Partial<Record<FeatureKey, boolean>>,
  byEmail: string
): Promise<FeatureFlags> {
  const db = getAdminDb();
  const ref = db.collection("config").doc("features");
  const clean: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: byEmail,
  };
  for (const key of FEATURE_KEYS) {
    if (typeof patch[key] === "boolean") clean[key] = patch[key];
  }
  await ref.set(clean, { merge: true });
  cache = null;
  return loadFeatureFlags();
}

export function invalidateFeatureCache() {
  cache = null;
}

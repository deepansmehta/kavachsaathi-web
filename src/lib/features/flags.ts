/**
 * Feature flags — Firestore `config/features` + env defaults.
 * Phase 1 defaults ON; Phase 2/3 default OFF.
 * Flag OFF ⇒ UI hidden and feature APIs return 404.
 */

export const FEATURE_KEYS = [
  "alertFamily",
  "criticalBadges",
  "quickCall",
  "cashlessTimer",
  "recordsVault",
  "claimFormPrefill",
  "familyPlan",
  "abhaLink",
  "hospitalPortal",
  "orgDashboard",
  "regionalLang",
  "donorDirective",
  "nfcInfo",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureFlags = Record<FeatureKey, boolean>;

/** Phase 1 ON; everything else OFF */
export const DEFAULT_FEATURES: FeatureFlags = {
  alertFamily: true,
  criticalBadges: true,
  quickCall: true,
  cashlessTimer: false,
  recordsVault: false,
  claimFormPrefill: false,
  familyPlan: false,
  abhaLink: false,
  hospitalPortal: false,
  orgDashboard: false,
  regionalLang: false,
  donorDirective: false,
  nfcInfo: false,
};

const ENV_MAP: Record<FeatureKey, string> = {
  alertFamily: "FEATURE_ALERT_FAMILY",
  criticalBadges: "FEATURE_CRITICAL_BADGES",
  quickCall: "FEATURE_QUICK_CALL",
  cashlessTimer: "FEATURE_CASHLESS_TIMER",
  recordsVault: "FEATURE_RECORDS_VAULT",
  claimFormPrefill: "FEATURE_CLAIM_FORM_PREFILL",
  familyPlan: "FEATURE_FAMILY_PLAN",
  abhaLink: "FEATURE_ABHA_LINK",
  hospitalPortal: "FEATURE_HOSPITAL_PORTAL",
  orgDashboard: "FEATURE_ORG_DASHBOARD",
  regionalLang: "FEATURE_REGIONAL_LANG",
  donorDirective: "FEATURE_DONOR_DIRECTIVE",
  nfcInfo: "FEATURE_NFC_INFO",
};

function envBool(name: string): boolean | null {
  const v = process.env[name];
  if (v === undefined || v === "") return null;
  if (v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "on")
    return true;
  if (v === "0" || v.toLowerCase() === "false" || v.toLowerCase() === "off")
    return false;
  return null;
}

/** Env overlay on defaults (no Firestore). Safe for edge/middleware. */
export function featuresFromEnv(): FeatureFlags {
  const out = { ...DEFAULT_FEATURES };
  for (const key of FEATURE_KEYS) {
    const e = envBool(ENV_MAP[key]);
    if (e !== null) out[key] = e;
  }
  return out;
}

export function mergeFeatureFlags(
  stored: Partial<Record<string, unknown>> | null | undefined
): FeatureFlags {
  const base = featuresFromEnv();
  if (!stored || typeof stored !== "object") return base;
  for (const key of FEATURE_KEYS) {
    if (typeof stored[key] === "boolean") base[key] = stored[key] as boolean;
  }
  return base;
}

export function isFeatureOn(flags: FeatureFlags, key: FeatureKey): boolean {
  return flags[key] === true;
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  alertFamily: "Alert Family (Phase 1)",
  criticalBadges: "Critical badges (Phase 1)",
  quickCall: "Quick call bar (Phase 1)",
  cashlessTimer: "Cashless timer (Phase 2)",
  recordsVault: "Records vault (Phase 2)",
  claimFormPrefill: "Claim form prefill (Phase 2)",
  familyPlan: "Family plan (Phase 2)",
  abhaLink: "ABHA link (Phase 2)",
  hospitalPortal: "Hospital portal (Phase 2)",
  orgDashboard: "Org dashboard (Phase 2)",
  regionalLang: "Regional languages (Phase 2)",
  donorDirective: "Donor / directive (Phase 3)",
  nfcInfo: "NFC info (Phase 3)",
};

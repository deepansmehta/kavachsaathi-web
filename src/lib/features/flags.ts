/**
 * Feature flags — Firestore `config/features` + env defaults.
 * Phase 1 defaults ON; Phase 2/3 + Pack 2 + Pack 3 default OFF.
 * Flag OFF ⇒ UI hidden and feature APIs return 404.
 */

export const FEATURE_KEYS = [
  // Phase 1
  "alertFamily",
  "criticalBadges",
  "quickCall",
  // Phase 2
  "cashlessTimer",
  "recordsVault",
  "claimFormPrefill",
  "familyPlan",
  "abhaLink",
  "hospitalPortal",
  "orgDashboard",
  "regionalLang",
  // Phase 3
  "donorDirective",
  "nfcInfo",
  // Pack 2 — Patient Ease (F14–F25)
  "coverageSnapshot",
  "dischargeChecklist",
  "documentPack",
  "billRequestLetter",
  "claimDeadline",
  "attendantPass",
  "doctorSummary",
  "followUpPlanner",
  "schemeGuide",
  "needBlood",
  "janAushadhi",
  "disclosureVault",
  // Pack 3 — Business / Growth / Ease (F46–F54)
  "cardValidity",
  "lostCard",
  "dataExport",
  "adminAnalytics",
  "vehicleSticker",
  "referral",
  "feedback",
  "elderlyMode",
  "offlineEmergency",
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
  coverageSnapshot: false,
  dischargeChecklist: false,
  documentPack: false,
  billRequestLetter: false,
  claimDeadline: false,
  attendantPass: false,
  doctorSummary: false,
  followUpPlanner: false,
  schemeGuide: false,
  needBlood: false,
  janAushadhi: false,
  disclosureVault: false,
  cardValidity: false,
  lostCard: false,
  dataExport: false,
  adminAnalytics: false,
  vehicleSticker: false,
  referral: false,
  feedback: false,
  elderlyMode: false,
  offlineEmergency: false,
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
  coverageSnapshot: "FEATURE_COVERAGE_SNAPSHOT",
  dischargeChecklist: "FEATURE_DISCHARGE_CHECKLIST",
  documentPack: "FEATURE_DOCUMENT_PACK",
  billRequestLetter: "FEATURE_BILL_REQUEST_LETTER",
  claimDeadline: "FEATURE_CLAIM_DEADLINE",
  attendantPass: "FEATURE_ATTENDANT_PASS",
  doctorSummary: "FEATURE_DOCTOR_SUMMARY",
  followUpPlanner: "FEATURE_FOLLOW_UP_PLANNER",
  schemeGuide: "FEATURE_SCHEME_GUIDE",
  needBlood: "FEATURE_NEED_BLOOD",
  janAushadhi: "FEATURE_JAN_AUSHADHI",
  disclosureVault: "FEATURE_DISCLOSURE_VAULT",
  cardValidity: "FEATURE_CARD_VALIDITY",
  lostCard: "FEATURE_LOST_CARD",
  dataExport: "FEATURE_DATA_EXPORT",
  adminAnalytics: "FEATURE_ADMIN_ANALYTICS",
  vehicleSticker: "FEATURE_VEHICLE_STICKER",
  referral: "FEATURE_REFERRAL",
  feedback: "FEATURE_FEEDBACK",
  elderlyMode: "FEATURE_ELDERLY_MODE",
  offlineEmergency: "FEATURE_OFFLINE_EMERGENCY",
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
  coverageSnapshot: "Coverage snapshot (Pack 2 F14)",
  dischargeChecklist: "Discharge checklist (Pack 2 F15)",
  documentPack: "Document pack PDF (Pack 2 F16)",
  billRequestLetter: "Bill request letter (Pack 2 F17)",
  claimDeadline: "Claim deadline (Pack 2 F18)",
  attendantPass: "Attendant pass (Pack 2 F19)",
  doctorSummary: "Doctor summary (Pack 2 F20)",
  followUpPlanner: "Follow-up planner (Pack 2 F21)",
  schemeGuide: "Scheme guide (Pack 2 F22)",
  needBlood: "Need blood (Pack 2 F23)",
  janAushadhi: "Jan Aushadhi link (Pack 2 F24)",
  disclosureVault: "Disclosure vault (Pack 2 F25)",
  cardValidity: "Card validity & renewal (Pack 3)",
  lostCard: "Lost card / replace (Pack 3)",
  dataExport: "Download my data (Pack 3)",
  adminAnalytics: "Admin analytics (Pack 3)",
  vehicleSticker: "Vehicle QR sticker (Pack 3)",
  referral: "Referral program (Pack 3)",
  feedback: "Post-activation feedback (Pack 3)",
  elderlyMode: "Elderly / large text mode (Pack 3)",
  offlineEmergency: "Emergency wallpaper (Pack 3)",
};

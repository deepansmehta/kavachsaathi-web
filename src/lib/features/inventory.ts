/**
 * Complete KavachSaathi feature inventory (58 features).
 * Source of truth for docs/FEATURES.md and /admin/features.
 */

import { FEATURE_KEYS, type FeatureKey } from "./flags";

export type FeatureGroup =
  | "core"
  | "phase1"
  | "phase2_3"
  | "patientEase"
  | "pack3"
  | "pack4";

export type InventoryRow = {
  id: string;
  group: FeatureGroup;
  name: string;
  summary: string;
  where: string;
  flag: FeatureKey | "always-on";
  test: string;
};

export const FEATURE_GROUPS: {
  id: FeatureGroup;
  title: string;
  count: number;
}[] = [
  { id: "core", title: "A) Core / always-on", count: 20 },
  { id: "phase1", title: "B) Phase 1 flags", count: 3 },
  { id: "phase2_3", title: "C) Phase 2/3 flags", count: 10 },
  { id: "patientEase", title: "D) Patient Ease flags", count: 12 },
  { id: "pack3", title: "E) Pack 3 flags", count: 9 },
  { id: "pack4", title: "F) Pack 4 flags", count: 4 },
];

export const FEATURE_INVENTORY: InventoryRow[] = [
  // ── A) Core / always-on (20) ───────────────────────────────────────────
  {
    id: "C01",
    group: "core",
    name: "Single adaptive QR",
    summary:
      "One QR per card resolves to /card/{health_id} for activation or emergency view.",
    where: "/card/[health_id]",
    flag: "always-on",
    test: "scripts/e2e-demo-test.ts",
  },
  {
    id: "C02",
    group: "core",
    name: "Activation code + PIN",
    summary:
      "4-digit activation code unlocks the wizard; owner PIN protects Full Details and My Profile.",
    where: "/card/[health_id] → ActivationForm; Full Details PIN",
    flag: "always-on",
    test: "scripts/e2e-demo-test.ts",
  },
  {
    id: "C03",
    group: "core",
    name: "7-step activation wizard",
    summary:
      "Guided activation collecting identity, medical, contacts, docs, and consents.",
    where: "/card/[health_id] (unactivated)",
    flag: "always-on",
    test: "scripts/e2e-full-details-smk02.ts",
  },
  {
    id: "C04",
    group: "core",
    name: "Public emergency profile",
    summary:
      "Scan view shows photo, blood group, allergies, contacts, and insurer name without PIN.",
    where: "/card/[health_id] (activated) — EmergencyLite",
    flag: "always-on",
    test: "scripts/e2e-demo-test.ts",
  },
  {
    id: "C05",
    group: "core",
    name: "Full Details (PIN)",
    summary:
      "PIN unlock reveals IDs, address, insurance docs, and advanced tools.",
    where: "Emergency → Full Details modal",
    flag: "always-on",
    test: "scripts/e2e-full-details-smk02.ts",
  },
  {
    id: "C06",
    group: "core",
    name: "Hospital emergency access",
    summary:
      "Hospital staff can unlock emergency-scoped Full Details with hospital credentials.",
    where: "/hospital + /api/hospital",
    flag: "always-on",
    test: "scripts/test-new-api-auth.ts",
  },
  {
    id: "C07",
    group: "core",
    name: "Access / scan log",
    summary: "Records card scans and emergency access events for the owner.",
    where: "/scan-history; /api/scan, /api/log-scan",
    flag: "always-on",
    test: "scripts/e2e-demo-test.ts",
  },
  {
    id: "C08",
    group: "core",
    name: "Document security / encryption",
    summary:
      "Sensitive profile documents stored AES-GCM encrypted; never on public emergency view.",
    where: "Activation uploads; Full Details decrypt",
    flag: "always-on",
    test: "scripts/test-docs-validation.ts",
  },
  {
    id: "C09",
    group: "core",
    name: "My Profile (login / edit / delete docs)",
    summary:
      "Owner signs in with health ID + PIN to view, edit profile, and manage documents.",
    where: "/my-profile, /login, /profile/edit",
    flag: "always-on",
    test: "scripts/test-login-lgn01.ts",
  },
  {
    id: "C10",
    group: "core",
    name: "Forgot PIN",
    summary: "Owner can reset PIN via activation-code verified flow.",
    where: "/forgot-pin, /reset-pin",
    flag: "always-on",
    test: "scripts/e2e-profile-login-x3.ts",
  },
  {
    id: "C11",
    group: "core",
    name: "Admin panel",
    summary:
      "Google-allowlisted admins manage cards, insurers, flags, and ops tools.",
    where: "/admin",
    flag: "always-on",
    test: "scripts/test-prelaunch-gate.ts",
  },
  {
    id: "C12",
    group: "core",
    name: "Rate limit + captcha",
    summary:
      "Login / Full Details unlock protected by attempt limits and captcha challenges.",
    where: "Full Details unlock; /api/profile/login",
    flag: "always-on",
    test: "scripts/test-login-lgn01.ts",
  },
  {
    id: "C13",
    group: "core",
    name: "Scheduled launch / activation",
    summary:
      "Real-card activation and site unlock share ACTIVATION_OPENS_AT (11 Oct 2026 12:00 IST).",
    where: "Activation gate + middleware pre-launch",
    flag: "always-on",
    test: "scripts/test-activation-schedule.ts",
  },
  {
    id: "C14",
    group: "core",
    name: "Countdown / coming-soon page",
    summary:
      "Pre-launch visitors see coming-soon; gated routes redirect until launch.",
    where: "/coming-soon",
    flag: "always-on",
    test: "scripts/test-prelaunch-gate.ts",
  },
  {
    id: "C15",
    group: "core",
    name: "Privacy / terms / grievance",
    summary: "Legal pages for privacy, terms, and grievance contacts.",
    where: "/privacy, /terms",
    flag: "always-on",
    test: "scripts/test-prelaunch-gate.ts",
  },
  {
    id: "C16",
    group: "core",
    name: "Demo card + reset",
    summary:
      "KVS-DEMO-00001 for QA; guarded reset refuses non-demo cards.",
    where: "/card/KVS-DEMO-00001; scripts/reset-demo-card.ts",
    flag: "always-on",
    test: "scripts/test-reset-demo-guard.ts",
  },
  {
    id: "C17",
    group: "core",
    name: "Pending-upload cleanup",
    summary:
      "Scheduled Netlify function removes stale pending upload objects safely.",
    where: "netlify/functions/cleanup-pending",
    flag: "always-on",
    test: "scripts/test-cleanup-pending-safety.ts",
  },
  {
    id: "C18",
    group: "core",
    name: "Branded errors + emergency lite",
    summary:
      "Branded error UX and lightweight emergency page for constrained clients.",
    where: "/e/[code], EmergencyLite on /card",
    flag: "always-on",
    test: "scripts/e2e-demo-test.ts",
  },
  {
    id: "C19",
    group: "core",
    name: "IRDAI cashless form PDF",
    summary: "Pre-filled IRDAI cashless claim form PDF from profile data.",
    where: "Full Details → /api/forms/cashless",
    flag: "always-on",
    test: "scripts/e2e-forms-frm01.ts",
  },
  {
    id: "C20",
    group: "core",
    name: "Admission info sheet PDF",
    summary: "Hospital admission information sheet PDF from profile data.",
    where: "Full Details → /api/forms/admission-sheet",
    flag: "always-on",
    test: "scripts/e2e-forms-frm01.ts",
  },

  // ── B) Phase 1 (3) ─────────────────────────────────────────────────────
  {
    id: "P1-01",
    group: "phase1",
    name: "Alert Family",
    summary: "One-tap WhatsApp/SMS alert to emergency contacts from the scan view.",
    where: "/card → EmergencyPhase1",
    flag: "alertFamily",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P1-02",
    group: "phase1",
    name: "Critical badges",
    summary: "High-visibility chips for insulin, epilepsy, severe allergy, etc.",
    where: "/card emergency view",
    flag: "criticalBadges",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P1-03",
    group: "phase1",
    name: "Quick call bar",
    summary: "Sticky call buttons for emergency contacts on the scan view.",
    where: "/card emergency view",
    flag: "quickCall",
    test: "scripts/test-advanced-features.ts",
  },

  // ── C) Phase 2/3 (10) ──────────────────────────────────────────────────
  {
    id: "P2-01",
    group: "phase2_3",
    name: "Cashless timer",
    summary: "IRDAI timeline clock + escalation steps after cashless request.",
    where: "Full Details → cashless timer",
    flag: "cashlessTimer",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-02",
    group: "phase2_3",
    name: "Records vault",
    summary: "Upload/list discharge summaries, labs, prescriptions (owner PIN).",
    where: "Full Details / My Profile → vault",
    flag: "recordsVault",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-03",
    group: "phase2_3",
    name: "Claim form prefill",
    summary: "Pre-filled insurer claim PDF from profile + insurance fields.",
    where: "Full Details → /api/forms/claim",
    flag: "claimFormPrefill",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-04",
    group: "phase2_3",
    name: "Family plan",
    summary: "Link family members under one group with invite/confirm flow.",
    where: "/my-profile → family; /api/family",
    flag: "familyPlan",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-05",
    group: "phase2_3",
    name: "ABHA link",
    summary: "Optional ABHA ID capture and display in Full Details.",
    where: "Activation / Full Details",
    flag: "abhaLink",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-06",
    group: "phase2_3",
    name: "Hospital portal",
    summary: "Hospital login dashboard for emergency access workflows.",
    where: "/hospital",
    flag: "hospitalPortal",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-07",
    group: "phase2_3",
    name: "Org dashboard",
    summary: "Organisation admin view for bulk/card programmes.",
    where: "/org",
    flag: "orgDashboard",
    test: "scripts/test-advanced-features.ts",
  },
  {
    id: "P2-08",
    group: "phase2_3",
    name: "Regional languages",
    summary: "EN/HI/PA/TA labels on emergency chrome (user data never translated).",
    where: "/card LanguageSwitcher",
    flag: "regionalLang",
    test: "scripts/verify-pack-turnon.ts",
  },
  {
    id: "P3-01",
    group: "phase2_3",
    name: "Donor / advance directive",
    summary: "Blood/organ donor prefs and advance-directive note in Full Details.",
    where: "Full Details → donor directive",
    flag: "donorDirective",
    test: "scripts/verify-donor-note.ts",
  },
  {
    id: "P3-02",
    group: "phase2_3",
    name: "NFC info",
    summary: "Admin NFC tooling and public NFC info surfaces.",
    where: "/admin/nfc",
    flag: "nfcInfo",
    test: "scripts/test-advanced-features.ts",
  },

  // ── D) Patient Ease / Pack 2 (12) ──────────────────────────────────────
  {
    id: "F14",
    group: "patientEase",
    name: "Coverage snapshot",
    summary:
      "Optional sum insured, room-rent tip, waiting periods — confirm with insurer/TPA.",
    where: "/my-profile Pack2; Full Details",
    flag: "coverageSnapshot",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F15",
    group: "patientEase",
    name: "Discharge checklist",
    summary: "Per-stay cashless vs reimbursement tick list with X of Y ready.",
    where: "/my-profile Pack2",
    flag: "dischargeChecklist",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F16",
    group: "patientEase",
    name: "Document pack PDF",
    summary:
      "On-demand multi-section PDF (cover + forms + IDs); Aadhaar masked; not stored.",
    where: "/my-profile → document pack",
    flag: "documentPack",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F17",
    group: "patientEase",
    name: "Bill request letter",
    summary: "EN+HI letter to hospital billing + bill-check checklist (not legal advice).",
    where: "/my-profile → bill letter PDF",
    flag: "billRequestLetter",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F18",
    group: "patientEase",
    name: "Claim deadline",
    summary: "Discharge date + claim window countdown with Google Calendar and .ics.",
    where: "/my-profile Pack2",
    flag: "claimDeadline",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F19",
    group: "patientEase",
    name: "Attendant pass",
    summary:
      "Time-limited one-time link (≥128-bit); watermarked; revoke → 410.",
    where: "/my-profile; /pass/[token]",
    flag: "attendantPass",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F20",
    group: "patientEase",
    name: "Doctor summary",
    summary: "1-page clinical summary PDF (conditions, meds, allergies, doctor).",
    where: "/my-profile → doctor summary PDF",
    flag: "doctorSummary",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F21",
    group: "patientEase",
    name: "Follow-up planner",
    summary: "Medicines and visits with Google Calendar links and .ics.",
    where: "/my-profile Pack2",
    flag: "followUpPlanner",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F22",
    group: "patientEase",
    name: "Scheme guide",
    summary:
      "EN/HI guide to PM-JAY, Vay Vandana, ECHS, ESIC, Haryana — official links only.",
    where: "/schemes",
    flag: "schemeGuide",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F23",
    group: "patientEase",
    name: "Need blood",
    summary:
      "Emergency wa.me blood request + official e-RaktKosh; hospital not stored.",
    where: "/card emergency (Need Blood button)",
    flag: "needBlood",
    test: "scripts/live-pack2-smoke.ts",
  },
  {
    id: "F24",
    group: "patientEase",
    name: "Jan Aushadhi",
    summary: "Official Jan Aushadhi Kendra locator link in summary / planner.",
    where: "/my-profile; doctor summary PDF",
    flag: "janAushadhi",
    test: "scripts/test-patient-ease.ts",
  },
  {
    id: "F25",
    group: "patientEase",
    name: "Disclosure vault",
    summary:
      "Private proposal/declaration/schedule uploads — PIN only, never emergency.",
    where: "/api/disclosure-vault (PIN session)",
    flag: "disclosureVault",
    test: "scripts/test-patient-ease.ts",
  },

  // ── E) Pack 3 (9) ──────────────────────────────────────────────────────
  {
    id: "F46",
    group: "pack3",
    name: "Card validity & renewal",
    summary: "365-day validity from activation, grace, renewal banner + WhatsApp.",
    where: "/my-profile ValidityBar; /admin/validity",
    flag: "cardValidity",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F47",
    group: "pack3",
    name: "Lost card / replace",
    summary: "Report lost (blocks scans) and request replacement via WhatsApp.",
    where: "/my-profile Pack3; lost banner on /card",
    flag: "lostCard",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F48",
    group: "pack3",
    name: "Download my data",
    summary: "Owner data export (ZIP/PDF) from My Profile.",
    where: "/my-profile → data export",
    flag: "dataExport",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F49",
    group: "pack3",
    name: "Admin analytics",
    summary: "Aggregate activation/scan analytics without storing personal data.",
    where: "/admin/analytics",
    flag: "adminAnalytics",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F50",
    group: "pack3",
    name: "Vehicle QR sticker",
    summary: "Vehicle sticker cards link 1–3 profiles (batch dry-run in admin).",
    where: "/admin/pack3; /api/vehicle",
    flag: "vehicleSticker",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F51",
    group: "pack3",
    name: "Referral program",
    summary:
      "Referral codes; +30 days to referrer on activation (yearly cap 12 months).",
    where: "/my-profile referral; activation step 7",
    flag: "referral",
    test: "scripts/test-referral-reward.ts",
  },
  {
    id: "F52",
    group: "pack3",
    name: "Post-activation feedback",
    summary: "Optional feedback modal after activation / Full Details.",
    where: "FeedbackModal on card flows",
    flag: "feedback",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F53",
    group: "pack3",
    name: "Elderly / large text mode",
    summary: "Larger type + optional read-aloud when speech API supported.",
    where: "/card EmergencyEaseControls",
    flag: "elderlyMode",
    test: "scripts/test-pack3.ts",
  },
  {
    id: "F54",
    group: "pack3",
    name: "Emergency wallpaper",
    summary:
      "Lock-screen wallpaper PNG with blood group/allergies — no IDs/address/insurance.",
    where: "/my-profile EmergencyWallpaper",
    flag: "offlineEmergency",
    test: "scripts/test-pack3.ts",
  },
  // ── F) Pack 4 (F55–F58) ────────────────────────────────────────────────
  {
    id: "F55",
    group: "pack4",
    name: "PWA + offline emergency card",
    summary:
      "Installable app; SW caches shell+/offline only (never /card/* or /api/*); owner PIN-encrypted offline card in IndexedDB.",
    where: "manifest; /offline; /my-profile OfflineCard",
    flag: "pwaApp",
    test: "scripts/test-pack4.ts",
  },
  {
    id: "F56",
    group: "pack4",
    name: "Doctor auto summary",
    summary:
      "Rule-based EN+HI clinical summary (~300 chars) at top of emergency view and doctor/admission/doc-pack PDFs.",
    where: "EmergencyLite; doctor-summary / admission / document-pack PDFs",
    flag: "autoSummary",
    test: "scripts/test-pack4.ts",
  },
  {
    id: "F57",
    group: "pack4",
    name: "FHIR R4 export",
    summary:
      "PIN-gated FHIR R4 Bundle (ABDM-oriented); no Aadhaar; 5/day; logged fhir_export.",
    where: "/my-profile; Full Details; /api/profile/fhir-export",
    flag: "fhirExport",
    test: "scripts/test-pack4.ts",
  },
  {
    id: "F58",
    group: "pack4",
    name: "Hospital Scan & Register",
    summary:
      "Verified hospital staff registration panel after patient PIN or 6-digit consent code; 15-min access; logged.",
    where: "/hospital ScanRegister; /api/hospital/scan-register",
    flag: "scanRegister",
    test: "scripts/test-pack4.ts",
  },
];

export const TOTAL_FEATURES = FEATURE_INVENTORY.length; // 58

export function inventoryByGroup(group: FeatureGroup): InventoryRow[] {
  return FEATURE_INVENTORY.filter((r) => r.group === group);
}

/** Assert inventory covers every FEATURE_KEY exactly once as a flagged row. */
export function assertInventoryCoversFlags(): string[] {
  const flagged = FEATURE_INVENTORY.filter((r) => r.flag !== "always-on").map(
    (r) => r.flag as FeatureKey
  );
  const missing = FEATURE_KEYS.filter((k) => !flagged.includes(k));
  const extras = flagged.filter(
    (k, i) => flagged.indexOf(k) !== i || !(FEATURE_KEYS as readonly string[]).includes(k)
  );
  return [
    ...missing.map((k) => `missing flag in inventory: ${k}`),
    ...extras.map((k) => `duplicate/unknown flag: ${k}`),
  ];
}

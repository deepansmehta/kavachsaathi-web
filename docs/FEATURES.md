# KavachSaathi — Complete feature inventory (54)

Source of truth in code: `src/lib/features/inventory.ts`  
Live flags: Firestore `config/features` via `/api/features`  
Admin UI: [/admin/features](https://kavachsaathi.in/admin/features)

**Counts:** Core 20 · Phase 1 3 · Phase 2/3 10 · Patient Ease 12 · Pack 3 9 = **54**

Production status below matches verification at last deploy (flags LIVE when ON in Firestore; always-on LIVE when HTTP surface responds as expected).

---

## A) Core / always-on (20) — flag: `always-on`

| ID | Name | What it does | Where | Flag | Status | Test |
|----|------|--------------|-------|------|--------|------|
| C01 | Single adaptive QR | One QR per card resolves to `/card/{health_id}` for activation or emergency view. | `/card/[health_id]` | always-on | LIVE | `scripts/e2e-demo-test.ts` |
| C02 | Activation code + PIN | 4-digit activation code unlocks the wizard; owner PIN protects Full Details and My Profile. | `/card` ActivationForm; Full Details PIN | always-on | LIVE | `scripts/e2e-demo-test.ts` |
| C03 | 7-step activation wizard | Guided activation collecting identity, medical, contacts, docs, and consents. | `/card/[health_id]` (unactivated) | always-on | LIVE | `scripts/e2e-full-details-smk02.ts` |
| C04 | Public emergency profile | Scan view shows photo, blood group, allergies, contacts, and insurer name without PIN. | `/card` EmergencyLite | always-on | LIVE | `scripts/e2e-demo-test.ts` |
| C05 | Full Details (PIN) | PIN unlock reveals IDs, address, insurance docs, and advanced tools. | Emergency → Full Details modal | always-on | LIVE | `scripts/e2e-full-details-smk02.ts` |
| C06 | Hospital emergency access | Hospital staff unlock emergency-scoped Full Details with hospital credentials. | `/hospital` + `/api/hospital` | always-on | LIVE | `scripts/test-new-api-auth.ts` |
| C07 | Access / scan log | Records card scans and emergency access events for the owner. | `/scan-history`; `/api/scan` | always-on | LIVE | `scripts/e2e-demo-test.ts` |
| C08 | Document security / encryption | Sensitive documents stored AES-GCM encrypted; never on public emergency view. | Activation uploads; Full Details | always-on | LIVE | `scripts/test-docs-validation.ts` |
| C09 | My Profile (login / edit / delete docs) | Owner signs in with health ID + PIN to view, edit, and manage documents. | `/my-profile`, `/login`, `/profile/edit` | always-on | LIVE | `scripts/test-login-lgn01.ts` |
| C10 | Forgot PIN | Owner resets PIN via activation-code verified flow. | `/forgot-pin`, `/reset-pin` | always-on | LIVE | `scripts/e2e-profile-login-x3.ts` |
| C11 | Admin panel | Google-allowlisted admins manage cards, insurers, flags, and ops tools. | `/admin` | always-on | LIVE | `scripts/test-prelaunch-gate.ts` |
| C12 | Rate limit + captcha | Login / Full Details unlock protected by attempt limits and captcha. | Full Details unlock; profile login | always-on | LIVE | `scripts/test-login-lgn01.ts` |
| C13 | Scheduled launch / activation | Real-card activation and site unlock share `ACTIVATION_OPENS_AT` (11 Oct 2026 12:00 IST). | Activation gate + middleware | always-on | LIVE | `scripts/test-activation-schedule.ts` |
| C14 | Countdown / coming-soon page | Pre-launch visitors see coming-soon; gated routes redirect until launch. | `/coming-soon` | always-on | LIVE | `scripts/test-prelaunch-gate.ts` |
| C15 | Privacy / terms / grievance | Legal pages for privacy, terms, and grievance contacts. | `/privacy`, `/terms` | always-on | LIVE | `scripts/test-prelaunch-gate.ts` |
| C16 | Demo card + reset | `KVS-DEMO-00001` for QA; guarded reset refuses non-demo cards. | `/card/KVS-DEMO-00001` | always-on | LIVE | `scripts/test-reset-demo-guard.ts` |
| C17 | Pending-upload cleanup | Scheduled function removes stale pending upload objects safely. | `netlify/functions/cleanup-pending` | always-on | LIVE | `scripts/test-cleanup-pending-safety.ts` |
| C18 | Branded errors + emergency lite | Branded error UX and lightweight emergency page for scan clients. | `/e/[code]`, EmergencyLite | always-on | LIVE | `scripts/e2e-demo-test.ts` |
| C19 | IRDAI cashless form PDF | Pre-filled IRDAI cashless claim form PDF from profile data. | Full Details → `/api/forms/cashless` | always-on | LIVE | `scripts/e2e-forms-frm01.ts` |
| C20 | Admission info sheet PDF | Hospital admission information sheet PDF from profile data. | Full Details → `/api/forms/admission-sheet` | always-on | LIVE | `scripts/e2e-forms-frm01.ts` |

---

## B) Phase 1 flags (3)

| ID | Name | What it does | Where | Flag | Status | Test |
|----|------|--------------|-------|------|--------|------|
| P1-01 | Alert Family | One-tap WhatsApp/SMS alert to emergency contacts from the scan view. | `/card` EmergencyPhase1 | `alertFamily` | LIVE | `scripts/test-advanced-features.ts` |
| P1-02 | Critical badges | High-visibility chips for insulin, epilepsy, severe allergy, etc. | `/card` emergency view | `criticalBadges` | LIVE | `scripts/test-advanced-features.ts` |
| P1-03 | Quick call bar | Sticky call buttons for emergency contacts on the scan view. | `/card` emergency view | `quickCall` | LIVE | `scripts/test-advanced-features.ts` |

---

## C) Phase 2/3 flags (10)

| ID | Name | What it does | Where | Flag | Status | Test |
|----|------|--------------|-------|------|--------|------|
| P2-01 | Cashless timer | IRDAI timeline clock + escalation after cashless request. | Full Details | `cashlessTimer` | LIVE | `scripts/test-advanced-features.ts` |
| P2-02 | Records vault | Upload/list discharge summaries, labs, prescriptions (owner PIN). | Full Details / My Profile | `recordsVault` | LIVE | `scripts/test-advanced-features.ts` |
| P2-03 | Claim form prefill | Pre-filled insurer claim PDF from profile + insurance fields. | Full Details → `/api/forms/claim` | `claimFormPrefill` | LIVE | `scripts/test-advanced-features.ts` |
| P2-04 | Family plan | Link family members under one group with invite/confirm flow. | `/my-profile`; `/api/family` | `familyPlan` | LIVE | `scripts/test-advanced-features.ts` |
| P2-05 | ABHA link | Optional ABHA ID capture and display in Full Details. | Activation / Full Details | `abhaLink` | LIVE | `scripts/test-advanced-features.ts` |
| P2-06 | Hospital portal | Hospital login dashboard for emergency access workflows. | `/hospital` | `hospitalPortal` | LIVE | `scripts/test-advanced-features.ts` |
| P2-07 | Org dashboard | Organisation admin view for bulk/card programmes. | `/org` | `orgDashboard` | LIVE | `scripts/test-advanced-features.ts` |
| P2-08 | Regional languages | EN/HI/PA/TA labels on emergency chrome (data never translated). | `/card` LanguageSwitcher | `regionalLang` | LIVE | `scripts/verify-pack-turnon.ts` |
| P3-01 | Donor / advance directive | Blood/organ donor prefs and advance-directive note in Full Details. | Full Details | `donorDirective` | LIVE | `scripts/verify-donor-note.ts` |
| P3-02 | NFC info | Admin NFC tooling and public NFC info surfaces. | `/admin/nfc` | `nfcInfo` | LIVE | `scripts/test-advanced-features.ts` |

---

## D) Patient Ease flags (12) — Pack 2 F14–F25

| ID | Name | What it does | Where | Flag | Status | Test |
|----|------|--------------|-------|------|--------|------|
| F14 | Coverage snapshot | Sum insured, room-rent tip, waiting periods — confirm with insurer/TPA. | `/my-profile` Pack2 | `coverageSnapshot` | LIVE | `scripts/test-patient-ease.ts` |
| F15 | Discharge checklist | Per-stay cashless vs reimbursement tick list with X of Y ready. | `/my-profile` Pack2 | `dischargeChecklist` | LIVE | `scripts/test-patient-ease.ts` |
| F16 | Document pack PDF | On-demand multi-section PDF; Aadhaar masked; not stored. | `/my-profile` | `documentPack` | LIVE | `scripts/test-patient-ease.ts` |
| F17 | Bill request letter | EN+HI letter to hospital billing + bill-check checklist. | `/my-profile` | `billRequestLetter` | LIVE | `scripts/test-patient-ease.ts` |
| F18 | Claim deadline | Discharge date + claim window countdown with GCal + .ics. | `/my-profile` | `claimDeadline` | LIVE | `scripts/test-patient-ease.ts` |
| F19 | Attendant pass | Time-limited one-time link (≥128-bit); watermarked; revoke → 410. | `/pass/[token]` | `attendantPass` | LIVE | `scripts/test-patient-ease.ts` |
| F20 | Doctor summary | 1-page clinical summary PDF. | `/my-profile` | `doctorSummary` | LIVE | `scripts/test-patient-ease.ts` |
| F21 | Follow-up planner | Medicines and visits with Google Calendar + .ics. | `/my-profile` | `followUpPlanner` | LIVE | `scripts/test-patient-ease.ts` |
| F22 | Scheme guide | EN/HI official scheme links (PM-JAY, ECHS, ESIC, Haryana, …). | `/schemes` | `schemeGuide` | LIVE | `scripts/test-patient-ease.ts` |
| F23 | Need blood | Emergency wa.me blood request + e-RaktKosh; hospital not stored. | `/card` Need Blood | `needBlood` | LIVE | `scripts/live-pack2-smoke.ts` |
| F24 | Jan Aushadhi | Official Jan Aushadhi Kendra locator link. | `/my-profile`; doctor PDF | `janAushadhi` | LIVE | `scripts/test-patient-ease.ts` |
| F25 | Disclosure vault | Private proposal/declaration/schedule uploads — PIN only. | `/api/disclosure-vault` | `disclosureVault` | LIVE | `scripts/test-patient-ease.ts` |

---

## E) Pack 3 flags (9) — F46–F54

| ID | Name | What it does | Where | Flag | Status | Test |
|----|------|--------------|-------|------|--------|------|
| F46 | Card validity & renewal | 365-day validity from activation, grace, renewal WhatsApp. | `/my-profile` ValidityBar | `cardValidity` | LIVE | `scripts/test-pack3.ts` |
| F47 | Lost card / replace | Report lost (blocks scans) and request replacement. | `/my-profile` Pack3 | `lostCard` | LIVE | `scripts/test-pack3.ts` |
| F48 | Download my data | Owner data export from My Profile. | `/my-profile` | `dataExport` | LIVE | `scripts/test-pack3.ts` |
| F49 | Admin analytics | Aggregate analytics without storing personal data. | `/admin/analytics` | `adminAnalytics` | LIVE | `scripts/test-pack3.ts` |
| F50 | Vehicle QR sticker | Vehicle sticker cards link 1–3 profiles. | `/admin/pack3`; `/api/vehicle` | `vehicleSticker` | LIVE | `scripts/test-pack3.ts` |
| F51 | Referral program | Referral codes; +30 days to referrer (max 12 months/year). | `/my-profile`; activation step 7 | `referral` | LIVE | `scripts/test-referral-reward.ts` |
| F52 | Post-activation feedback | Optional feedback after activation / Full Details. | FeedbackModal | `feedback` | LIVE | `scripts/test-pack3.ts` |
| F53 | Elderly / large text mode | Larger type + optional read-aloud when supported. | `/card` EmergencyEaseControls | `elderlyMode` | LIVE | `scripts/test-pack3.ts` |
| F54 | Emergency wallpaper | Lock-screen PNG with blood/allergies — no IDs/address/insurance. | `/my-profile` | `offlineEmergency` | LIVE | `scripts/test-pack3.ts` |

---

## Totals

| Bucket | Count |
|--------|------:|
| Core always-on | 20 |
| Flagged (Phase 1 + 2/3 + Patient Ease + Pack 3) | 34 |
| **All features** | **54** |

Toggle flagged features in `/admin` (Feature flags) or `/admin/features` (inventory view).

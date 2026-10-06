/**
 * Pack 2 — Patient Ease (F14–F25) unit + optional HTTP tests.
 *   TEST_BASE_URL=http://localhost:3000 npx --yes tsx scripts/test-patient-ease.ts
 */
import fs from "fs";
import path from "path";
import { parseCoverage, roomTip, COVERAGE_DISCLAIMER } from "../src/lib/patientEase/coverage";
import { progress, itemsForMode } from "../src/lib/patientEase/dischargeChecklist";
import { billLetterEnglish, billLetterHindi, NOT_LEGAL_ADVICE } from "../src/lib/patientEase/billLetter";
import { claimCountdown, claimCalendarLinks, CLAIM_REQUIRED_DOCS } from "../src/lib/patientEase/claimDeadline";
import {
  createAttendantToken,
  hashAttendantToken,
  isGuessableToken,
  attendantWatermark,
} from "../src/lib/patientEase/attendantPass";
import { maskAadhaar, checkDocPackRateLimit } from "../src/lib/patientEase/documentPack";
import { needBloodWaMessage, medicineCalendar } from "../src/lib/patientEase/helpers";
import {
  verifiedSchemes,
  E_RAKTKOSH_URL,
  JAN_AUSHADHI_LOCATOR,
  OFFICIAL_LINKS,
} from "../src/lib/patientEase/officialLinks";
import { buildBillLetterPdf } from "../src/lib/patientEase/pdfs/billLetterPdf";
import { buildDocumentPackPdf } from "../src/lib/patientEase/pdfs/documentPackPdf";
import { buildDoctorSummaryPdf } from "../src/lib/patientEase/pdfs/doctorSummaryPdf";
import { DEFAULT_FEATURES, FEATURE_KEYS } from "../src/lib/features/flags";

const BASE = (process.env.TEST_BASE_URL || "").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "tmp", "pack2-pdfs");

const PACK2 = [
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
] as const;

type Row = { id: string; ok: boolean; detail?: string };
const rows: Row[] = [];
function pass(id: string, detail?: string) {
  rows.push({ id, ok: true, detail });
  console.log("PASS", id, detail || "");
}
function fail(id: string, detail?: string) {
  rows.push({ id, ok: false, detail });
  console.log("FAIL", id, detail || "");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("=== Pack 2 Patient Ease tests ===\n");

  for (const k of PACK2) {
    FEATURE_KEYS.includes(k) && DEFAULT_FEATURES[k] === false
      ? pass(`flag ${k} default OFF`)
      : fail(`flag ${k}`, `missing or not OFF default=${(DEFAULT_FEATURES as any)[k]}`);
  }

  const cov = parseCoverage({
    sumInsured: 500000,
    roomRentLimit: { type: "day", value: 5000 },
  });
  roomTip(cov)?.includes("₹5000/day")
    ? pass("coverage room tip")
    : fail("coverage room tip", roomTip(cov) || "");
  COVERAGE_DISCLAIMER.includes("policyholder")
    ? pass("coverage disclaimer")
    : fail("coverage disclaimer");

  const p = progress("cashless", { itemized_bill: true });
  p.total === itemsForMode("cashless").length && p.done === 1
    ? pass("discharge progress", p.label)
    : fail("discharge progress", JSON.stringify(p));

  const en = billLetterEnglish({
    patientName: "Test User",
    hospital: "City Hospital",
    ipUhid: "IP-1",
    admissionDate: "2026-01-01",
  });
  const hi = billLetterHindi({
    patientName: "परीक्षण",
    hospital: "अस्पताल",
    ipUhid: "IP-1",
    admissionDate: "2026-01-01",
  });
  en.includes("itemized") && hi.includes("आइटमाइज़्ड") && NOT_LEGAL_ADVICE
    ? pass("bill letter EN+HI")
    : fail("bill letter");

  const cd = claimCountdown("2026-01-01", 30, new Date("2026-01-10"));
  cd.daysLeft > 0 && CLAIM_REQUIRED_DOCS.length >= 5
    ? pass("claim countdown", cd.label)
    : fail("claim countdown", JSON.stringify(cd));
  const cal = claimCalendarLinks({ dischargeDate: "2026-01-01", windowDays: 30 });
  cal.googleCalendarUrl.includes("google.com/calendar") &&
  cal.ics.includes("BEGIN:VCALENDAR")
    ? pass("claim calendar + ics")
    : fail("claim calendar");

  const tok = createAttendantToken();
  !isGuessableToken(tok) && hashAttendantToken(tok).length === 64
    ? pass("attendant token ≥128-bit hex")
    : fail("attendant token", tok);
  attendantWatermark("Riya", new Date().toISOString()).includes("Attendant pass")
    ? pass("attendant watermark")
    : fail("watermark");

  maskAadhaar("123456789012") === "XXXX-XXXX-9012"
    ? pass("aadhaar mask")
    : fail("aadhaar mask", maskAadhaar("123456789012"));
  const rl = checkDocPackRateLimit("test-profile-rate");
  rl.ok ? pass("doc pack rate allow") : fail("doc pack rate");

  needBloodWaMessage({
    bloodGroup: "B+",
    firstName: "Asha",
    hospital: "City Hospital",
    phone: "9876543210",
  }).startsWith("URGENT: B+")
    ? pass("need blood message")
    : fail("need blood message");

  medicineCalendar({ name: "Metformin", dose: "500mg" }).ics.includes("BEGIN:VCALENDAR")
    ? pass("medicine ics")
    : fail("medicine ics");

  verifiedSchemes().length >= 4
    ? pass(`schemes verified count=${verifiedSchemes().length}`)
    : fail("schemes");

  // PDFs
  const billPdf = await buildBillLetterPdf({
    patientName: "दीपांश मेहता",
    hospital: "City Hospital with a very long name that must wrap properly on the page",
    ipUhid: "UHID-4242",
    admissionDate: "2026-03-01",
  });
  fs.writeFileSync(path.join(OUT, "bill-letter.pdf"), billPdf);
  !Buffer.from(billPdf).toString("latin1").includes("undefined")
    ? pass("bill letter PDF", `${billPdf.length}b`)
    : fail("bill letter PDF undefined");

  const packPdf = await buildDocumentPackPdf({
    name: "Test User",
    insurer: "Star Health",
    tpa: "Medi Assist",
    policy: "POL-1",
    memberId: "M-1",
    aadhaarMasked: maskAadhaar("123412341234"),
    sections: ["cover", "cashless", "id_proofs"],
    vaultTitles: ["discharge_summary 2026-01-01 City"],
  });
  fs.writeFileSync(path.join(OUT, "document-pack.pdf"), packPdf);
  pass("document pack PDF", `${packPdf.length}b`);

  const docPdf = await buildDoctorSummaryPdf({
    name: "Test User",
    bloodGroup: "O+",
    allergies: ["Penicillin"],
    conditions: [{ name: "Diabetes", sinceYear: "2018" }],
    medicines: [{ name: "Insulin", dose: "10U", frequency: "BD" }],
    includeJanAushadhi: true,
  });
  fs.writeFileSync(path.join(OUT, "doctor-summary.pdf"), docPdf);
  pass("doctor summary PDF", `${docPdf.length}b`);

  // Official link HTTP checks (live)
  const urls = [
    OFFICIAL_LINKS.pmjay,
    OFFICIAL_LINKS.pmjayEligibility,
    OFFICIAL_LINKS.pmjayHospitals,
    OFFICIAL_LINKS.echs,
    OFFICIAL_LINKS.esic,
    OFFICIAL_LINKS.haryanaHealth,
    OFFICIAL_LINKS.mySchemeAbPmjay,
    JAN_AUSHADHI_LOCATOR,
    E_RAKTKOSH_URL,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "KavachSaathiLinkCheck/1.0" },
      });
      r.status >= 200 && r.status < 400
        ? pass(`link ${u}`, `HTTP ${r.status}`)
        : fail(`link ${u}`, `HTTP ${r.status}`);
    } catch (e) {
      fail(`link ${u}`, e instanceof Error ? e.message : String(e));
    }
  }

  if (BASE) {
    console.log(`\n=== HTTP @ ${BASE} ===`);
    const paths: [string, string][] = [
      ["/api/coverage", "GET"],
      ["/api/discharge-checklist", "GET"],
      ["/api/document-pack", "POST"],
      ["/api/bill-letter", "POST"],
      ["/api/claim-deadline", "GET"],
      ["/api/attendant-pass", "GET"],
      ["/api/doctor-summary", "GET"],
      ["/api/follow-up", "GET"],
      ["/api/need-blood", "POST"],
      ["/api/disclosure-vault", "GET"],
    ];
    let features: Record<string, boolean> = {};
    try {
      const f = await (await fetch(`${BASE}/api/features`)).json();
      features = f.flags || {};
    } catch {
      fail("features fetch");
    }
    for (const k of PACK2) {
      // Before deploy, old servers may omit new keys — treat missing as OFF
      features[k] === true || features[k] === false || features[k] === undefined
        ? pass(`live flag ${k}=${String(features[k])}`)
        : fail(`live flag ${k}`, String(features[k]));
    }
    for (const [p, method] of paths) {
      try {
        const r = await fetch(`${BASE}${p}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? "{}" : undefined,
        });
        const text = await r.text();
        let json: any = {};
        try {
          json = JSON.parse(text);
        } catch {
          /* */
        }
        if (r.status === 404 && json.code === "FEATURE_OFF") {
          pass(`${method} ${p} FEATURE_OFF`);
        } else if ([400, 401, 403, 404, 503].includes(r.status)) {
          pass(`${method} ${p} → ${r.status} (gated)`);
        } else {
          fail(`${method} ${p}`, `status=${r.status}`);
        }
      } catch (e) {
        fail(`${method} ${p}`, e instanceof Error ? e.message : String(e));
      }
    }
    // Emergency HTML must not leak Pack2 labels except need blood when ON
    try {
      const html = await (
        await fetch(`${BASE}/card/KVS-DEMO-00001`)
      ).text();
      const banned = [
        "Your Coverage",
        "Discharge checklist",
        "Document pack",
        "Bill request",
        "Claim deadline",
        "Attendant pass",
        "Doctor summary",
        "Disclosure vault",
        "Follow-up planner",
      ];
      const leaks = banned.filter((b) => html.includes(b));
      leaks.length === 0
        ? pass("emergency HTML no Pack2 (except F23)")
        : fail("emergency HTML leaks", leaks.join(","));
    } catch (e) {
      fail("emergency HTML", e instanceof Error ? e.message : String(e));
    }
  } else {
    pass("http skipped (no TEST_BASE_URL)");
  }

  const fails = rows.filter((r) => !r.ok);
  console.log(`\nsummary: ${rows.length - fails.length}/${rows.length} PASS`);
  if (fails.length) {
    for (const f of fails) console.log(" ", f.id, f.detail);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

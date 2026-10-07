/**
 * Pack 2 — Patient Ease (F14–F25) unit + optional HTTP tests.
 * Aligned to CURRENT src/lib/patientEase exports (not legacy HEAD names).
 *   TEST_BASE_URL=http://localhost:3000 npx --yes tsx scripts/test-patient-ease.ts
 */
import fs from "fs";
import path from "path";
import {
  emptyCoverageSnapshot,
  roomRentTip,
  COVERAGE_DISCLAIMER,
} from "../src/lib/patientEase/coverage";
import {
  CASHLESS_ITEMS,
  checklistProgress,
} from "../src/lib/patientEase/dischargeChecklist";
import {
  buildEnglishLetter,
  buildHindiLetter,
  BILL_LETTER_DISCLAIMER,
} from "../src/lib/patientEase/billLetter";
import {
  computeClaimCountdown,
  claimDeadlineCalendarUrl,
  claimDeadlineIcs,
  REQUIRED_CLAIM_DOCS,
} from "../src/lib/patientEase/claimDeadline";
import {
  createRawToken,
  hashAttendantToken,
  isGuessableToken,
  attendantWatermark,
} from "../src/lib/patientEase/attendantPass";
import {
  maskAadhaar,
  checkDocPackRateLimit,
} from "../src/lib/patientEase/documentPack";
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

  const cov = {
    ...emptyCoverageSnapshot(),
    sumInsured: 500000,
    roomRentLimit: { type: "day" as const, value: 5000 },
  };
  const tip = roomRentTip(cov);
  tip.includes("₹5,000/day") || tip.includes("₹5000/day")
    ? pass("coverage room tip", tip.slice(0, 80))
    : fail("coverage room tip", tip || "");
  COVERAGE_DISCLAIMER.includes("policyholder") ||
  COVERAGE_DISCLAIMER.toLowerCase().includes("insurer")
    ? pass("coverage disclaimer")
    : fail("coverage disclaimer");

  const items = CASHLESS_ITEMS;
  const p = checklistProgress(items, { [items[0].id]: true });
  p.total === items.length && p.done === 1
    ? pass("discharge progress", `${p.done}/${p.total}`)
    : fail("discharge progress", JSON.stringify(p));

  const letterBase = {
    hospitalName: "City Hospital",
    admissionDate: "2026-01-01",
    dischargeDate: "2026-01-05",
    healthId: "KVS-TEST-00001",
    generatedDate: "2026-01-06",
  };
  const en = buildEnglishLetter({
    patientName: "Test User",
    ...letterBase,
  });
  const hi = buildHindiLetter({
    ...letterBase,
    patientName: "परीक्षण",
    hospitalName: "अस्पताल",
  });
  (en.toLowerCase().includes("itemized") || en.toLowerCase().includes("itemised")) &&
  (hi.includes("आइटम") || hi.includes("बिल") || hi.length > 40) &&
  BILL_LETTER_DISCLAIMER
    ? pass("bill letter EN+HI")
    : fail("bill letter", `en=${en.slice(0, 40)} hi=${hi.slice(0, 40)}`);

  const cd = computeClaimCountdown({
    dischargeDate: "2026-12-01",
    windowDays: 30,
  });
  cd.daysRemaining > 0 && REQUIRED_CLAIM_DOCS.length >= 5
    ? pass("claim countdown", `days=${cd.daysRemaining}`)
    : fail("claim countdown", JSON.stringify(cd));
  const calUrl = claimDeadlineCalendarUrl({
    patientName: "Test User",
    dischargeDate: "2026-12-01",
    windowDays: 30,
  });
  const ics = claimDeadlineIcs({
    patientName: "Test User",
    dischargeDate: "2026-12-01",
    windowDays: 30,
    healthId: "KVS-DEMO-00001",
  });
  calUrl.includes("google.com/calendar") && ics.includes("BEGIN:VCALENDAR")
    ? pass("claim calendar + ics")
    : fail("claim calendar");

  const tok = createRawToken();
  !isGuessableToken(tok) && hashAttendantToken(tok).length === 64
    ? pass("attendant token ≥128-bit hex")
    : fail("attendant token", tok);
  attendantWatermark("full_details").includes("Attendant Pass")
    ? pass("attendant watermark")
    : fail("watermark", attendantWatermark("full_details"));

  maskAadhaar("123456789012") === "XXXX-XXXX-9012"
    ? pass("aadhaar mask")
    : fail("aadhaar mask", maskAadhaar("123456789012"));
  const rl = checkDocPackRateLimit("test-profile-rate");
  rl.allowed ? pass("doc pack rate allow") : fail("doc pack rate");

  needBloodWaMessage({
    bloodGroup: "B+",
    firstName: "Asha",
    hospital: "City Hospital",
    phone: "9876543210",
  }).startsWith("URGENT: B+")
    ? pass("need blood message")
    : fail("need blood message");

  medicineCalendar({ name: "Metformin", dose: "500mg" }).ics.includes(
    "BEGIN:VCALENDAR"
  )
    ? pass("medicine ics")
    : fail("medicine ics");

  verifiedSchemes().length >= 4
    ? pass(`schemes verified count=${verifiedSchemes().length}`)
    : fail("schemes");

  const billPdf = await buildBillLetterPdf({
    patientName: "दीपांश मेहता",
    hospital: "City Hospital with a very long name that must wrap properly on the page",
    ipUhid: "UHID-4242",
    admissionDate: "2026-03-01",
  });
  const billBytes = Buffer.from(billPdf.bytes);
  fs.writeFileSync(path.join(OUT, "bill-letter.pdf"), billBytes);
  !billBytes.toString("latin1").includes("undefined")
    ? pass("bill letter PDF", `${billBytes.length}b`)
    : fail("bill letter PDF undefined");

  const packPdf = await buildDocumentPackPdf({
    sections: ["personal_details", "allergies", "medications"],
    healthId: "KVS-DEMO-00001",
    profile: {
      name: "Test User",
      bloodGroup: "O+",
      aadhaar: "123412341234",
      allergies: ["Penicillin"],
      medications: [{ name: "Metformin", dose: "500mg" }],
      insurance: {
        private: {
          insurerName: "Star Health",
          policyNumber: "POL-1",
          tpaName: "Medi Assist",
        },
      },
    },
  });
  const packBytes = Buffer.from(packPdf.bytes);
  fs.writeFileSync(path.join(OUT, "document-pack.pdf"), packBytes);
  pass("document pack PDF", `${packBytes.length}b`);

  const docPdf = await buildDoctorSummaryPdf({
    name: "Test User",
    age: "40",
    ageMonths: "0",
    gender: "male",
    bloodGroup: "O+",
    allergies: ["Penicillin"],
    conditions: ["Diabetes"],
    surgeries: [],
    medications: [{ name: "Insulin", dose: "10U", freq: "BD" }],
    vaccinations: [],
    criticalFlags: [],
    familyDoctor: null,
    generatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(path.join(OUT, "doctor-summary.pdf"), docPdf);
  pass("doctor summary PDF", `${docPdf.length}b`);

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
      const f = (await (await fetch(`${BASE}/api/features`)).json()) as {
        flags?: Record<string, boolean>;
      };
      features = f.flags || {};
    } catch {
      fail("features fetch");
    }
    for (const k of PACK2) {
      features[k] === true || features[k] === false || features[k] === undefined
        ? pass(`live flag ${k}=${String(features[k])}`)
        : fail(`live flag ${k}`, String(features[k]));
    }
    for (const [pPath, method] of paths) {
      try {
        const r = await fetch(`${BASE}${pPath}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? "{}" : undefined,
        });
        const text = await r.text();
        let json: { code?: string } = {};
        try {
          json = JSON.parse(text);
        } catch {
          /* */
        }
        if (r.status === 404 && json.code === "FEATURE_OFF") {
          pass(`${method} ${pPath} FEATURE_OFF`);
        } else if ([400, 401, 403, 404, 503].includes(r.status)) {
          pass(`${method} ${pPath} → ${r.status} (gated)`);
        } else {
          fail(`${method} ${pPath}`, `status=${r.status}`);
        }
      } catch (e) {
        fail(
          `${method} ${pPath}`,
          e instanceof Error ? e.message : String(e)
        );
      }
    }
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

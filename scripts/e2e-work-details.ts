/**
 * DEMO-only E2E for workDetails (F59).
 * Never touches KVS-2026-* cards. Never logs PIN / secrets / personal phone dumps.
 *
 *   E2E_BASE_URL=https://… npx --yes tsx scripts/e2e-work-details.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = (process.env.E2E_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);
const TEST_PIN = "4242";
const OUT = path.join(
  process.cwd(),
  "exports/features-2026-10/work-details"
);

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(
    `  [${pass ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`
  );
}

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function abortIfNotDemo(db: FirebaseFirestore.Firestore) {
  if (DEMO_HEALTH_ID !== "KVS-DEMO-00001") {
    throw new Error("ABORT: DEMO_HEALTH_ID constant tampered");
  }
  const snap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!snap.exists) throw new Error("ABORT: demo doc missing");
  const d = snap.data()!;
  if (d.isDemo !== true || String(d.health_id) !== DEMO_HEALTH_ID) {
    throw new Error("ABORT: not demo card");
  }
}

function cookieHeader(res: Response): string {
  const raw = (res.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie?.() || [];
  if (raw.length) {
    return raw.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0] : "";
}

async function login(cookieJar: { v: string }) {
  const res = await fetch(`${BASE}/api/profile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: DEMO_HEALTH_ID, pin: TEST_PIN }),
  });
  const c = cookieHeader(res);
  if (c) cookieJar.v = c;
  const data = (await res.json()) as { success?: boolean; error?: string };
  return { ok: res.ok && data.success === true, status: res.status };
}

const SAMPLE_WORK = {
  workType: "job",
  organisationName: "Demo Works Ltd",
  city: "Pune",
  designation: "Technician",
  employerContactName: "Demo HR",
  employerContactPhone: "9876512345",
  employerContactRole: "HR",
  employerContactConsent: true,
  employeeId: "EMP-DEMO-9",
  esicNumber: "ESIC-DEMO-1",
  companyInsurer: "Demo Co Insurer",
  companyPolicyNo: "POL-DEMO-99",
  visibility: {
    organisationName: true,
    city: true,
    employerContact: true,
    designation: false,
  },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("\nE2E workDetails (DEMO only)");
  console.log(`Base: ${BASE}`);
  console.log(`Target: ${DEMO_HEALTH_ID}\n`);

  const db = loadAdmin();
  await abortIfNotDemo(db);
  await resetDemoCard(db);
  await abortIfNotDemo(db);

  // Enable flag for this test run (caller may already have set it)
  await db.collection("config").doc("features").set(
    { workDetails: true, updatedAt: new Date().toISOString(), updatedBy: "e2e-work-details" },
    { merge: true }
  );

  // Consent required
  {
    await resetDemoCard(db);
    const res = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_id: DEMO_HEALTH_ID,
        activation_code: DEMO_ACTIVATION_CODE,
        pin: TEST_PIN,
        full_name: "Demo Work User",
        phone: "9812345678",
        blood_group: "O+",
        city: "Delhi",
        emergency_contacts: [
          { name: "Demo Contact", phone: "9876501234", relation: "Friend" },
        ],
        consents: {
          dataAccurate: true,
          privacyAccepted: true,
          termsAccepted: true,
        },
        requireFullDocs: false,
        workDetails: {
          ...SAMPLE_WORK,
          employerContactConsent: false,
        },
      }),
    });
    const data = (await res.json()) as { error?: string };
    const ok =
      res.status === 400 && /consent/i.test(String(data.error || ""));
    record("consent required to save employer contact", ok, String(res.status));
  }

  // Skip work details — activation still completes
  {
    await resetDemoCard(db);
    const res = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_id: DEMO_HEALTH_ID,
        activation_code: DEMO_ACTIVATION_CODE,
        pin: TEST_PIN,
        full_name: "Demo Work User",
        phone: "9812345678",
        blood_group: "O+",
        city: "Delhi",
        emergency_contacts: [
          { name: "Demo Contact", phone: "9876501234", relation: "Friend" },
        ],
        consents: {
          dataAccurate: true,
          privacyAccepted: true,
          termsAccepted: true,
        },
        requireFullDocs: false,
      }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    record(
      "skip work details — activation completes",
      res.ok && data.success === true,
      data.error || "ok"
    );
  }

  // Add / edit via profile update + persist
  const jar = { v: "" };
  {
    const { ok } = await login(jar);
    record("profile login", ok);
    const patch = await fetch(`${BASE}/api/profile/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: jar.v,
      },
      body: JSON.stringify({ workDetails: SAMPLE_WORK }),
    });
    const pdata = (await patch.json()) as { success?: boolean; error?: string };
    record(
      "add work details via profile update",
      patch.ok && pdata.success === true,
      pdata.error || String(patch.status)
    );

    const me = await fetch(`${BASE}/api/profile/me`, {
      headers: { Cookie: jar.v },
    });
    const meData = (await me.json()) as {
      profile?: { workDetails?: { organisationName?: string; employeeId?: string } };
    };
    const wd = meData.profile?.workDetails;
    record(
      "persist after reload (me)",
      Boolean(wd?.organisationName === "Demo Works Ltd" && wd?.employeeId === "EMP-DEMO-9"),
      wd?.organisationName ? "org ok" : "missing"
    );
  }

  // Public HTML — toggles ON (designation OFF by default)
  {
    const res = await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const hasOrg = /Demo Works Ltd/i.test(html) && /Works at/i.test(html);
    const hasCity = /Pune/i.test(html);
    const noDesignation = !/Technician/i.test(html);
    const noEmpId = !/EMP-DEMO-9/i.test(html);
    const noEsic = !/ESIC-DEMO-1/i.test(html);
    const noPolicy = !/POL-DEMO-99/i.test(html);
    const hasTel = /tel:\+919876512345/.test(html);
    const hasCall = /Call Employer/i.test(html);
    record("public HTML shows org+city", hasOrg && hasCity);
    record("public HTML hides designation (toggle OFF)", noDesignation);
    record("PIN-only fields absent from public HTML", noEmpId && noEsic && noPolicy);
    record("call button tel: link", hasTel && hasCall);
  }

  // Toggles OFF → fields absent
  {
    const patch = await fetch(`${BASE}/api/profile/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: jar.v,
      },
      body: JSON.stringify({
        workDetails: {
          ...SAMPLE_WORK,
          visibility: {
            organisationName: false,
            city: false,
            employerContact: false,
            designation: false,
          },
        },
      }),
    });
    record("set toggles OFF", patch.ok);

    const res = await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const absent =
      !/Demo Works Ltd/i.test(html) &&
      !/Pune/i.test(html) &&
      !/tel:\+919876512345/.test(html) &&
      !/public-work-details/.test(html) &&
      !/EMP-DEMO-9/i.test(html);
    record("toggles OFF → absent from public HTML", absent);

    // RSC / serialized props must not leak PIN-only
    const leak =
      /EMP-DEMO-9|ESIC-DEMO-1|POL-DEMO-99|employeeIdEnc|companyPolicyNo/i.test(
        html
      );
    record("no PIN-only in page payload", !leak);
  }

  // Screenshots (mobile 375)
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Restore toggles ON for public screenshot
    await fetch(`${BASE}/api/profile/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: jar.v,
      },
      body: JSON.stringify({ workDetails: SAMPLE_WORK }),
    });

    // Profile edit
    await page.goto(`${BASE}/my-profile`, { waitUntil: "networkidle" });
    await page.fill('input[name="identifier"], input[type="text"]', DEMO_HEALTH_ID).catch(() => {});
    const inputs = page.locator("input");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const ph = await inputs.nth(i).getAttribute("placeholder").catch(() => "");
      const type = await inputs.nth(i).getAttribute("type").catch(() => "");
      if (/pin|password/i.test(String(type)) || /pin/i.test(String(ph))) {
        await inputs.nth(i).fill(TEST_PIN);
      } else if (i === 0) {
        await inputs.nth(i).fill(DEMO_HEALTH_ID);
      }
    }
    await page.getByRole("button", { name: /log ?in|sign ?in|unlock/i }).click().catch(async () => {
      await page.locator("button").first().click();
    });
    await page.waitForTimeout(2000);
    await page.getByText(/Work details|काम की जानकारी/i).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({
      path: path.join(OUT, "01-profile-edit-work-details.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT, "02-public-work-details-on.png"),
      fullPage: true,
    });

    await fetch(`${BASE}/api/profile/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: jar.v,
      },
      body: JSON.stringify({
        workDetails: {
          ...SAMPLE_WORK,
          visibility: {
            organisationName: false,
            city: false,
            employerContact: false,
            designation: false,
          },
        },
      }),
    });
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT, "03-public-work-details-toggles-off.png"),
      fullPage: true,
    });

    await browser.close();
    record("screenshots written", true, OUT);
  } catch (e) {
    record(
      "screenshots written",
      false,
      e instanceof Error ? e.message : String(e)
    );
  }

  // Leave demo with work details ON toggles for smoke (restore useful state)
  await fetch(`${BASE}/api/profile/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: jar.v,
    },
    body: JSON.stringify({ workDetails: SAMPLE_WORK }),
  }).catch(() => {});

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} passed`
  );
  if (failed.length) {
    console.error("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("OK workDetails e2e\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

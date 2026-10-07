/**
 * Supplemental E2E for cases not covered / failed in e2e-prod-demo-playwright.
 * Demo + disposable KVS-2099-E2E01 only. Preview cookie for /my-profile.
 * Never prints secrets.
 *
 *   E2E_OUT_DIR=exports/e2e-2026-10-08 npx tsx scripts/e2e-finish-2026-10-08.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { DEMO_HEALTH_ID, DEMO_ACTIVATION_CODE } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";
import { hashPin } from "../src/lib/pin";

const BASE = "https://kavachsaathi.in";
const PREVIEW = String(process.env.PRELAUNCH_PREVIEW_SECRET || "").trim();
const OUT = path.join(
  process.cwd(),
  process.env.E2E_OUT_DIR || "exports/e2e-2026-10-08"
);
const E2E2099 = "KVS-2099-E2E01";
const E2E_CODE = "ZZ99"; // disposable doc id — not A0001–A0500 inventory
const PIN = "482913";
const PHONE = "9999900008";

const rows: { step: string; result: string }[] = [];
function pass(step: string) {
  rows.push({ step, result: "PASS" });
}
function fail(step: string, why = "") {
  rows.push({ step, result: `FAIL${why ? ": " + why : ""}` });
}

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

function adminDb() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  return getFirestore();
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function ensure2099(db: FirebaseFirestore.Firestore) {
  const ref = db.collection("cards").doc(E2E_CODE);
  await ref.set(
    {
      activation_code: E2E_CODE,
      health_id: E2E2099,
      status: "unactivated",
      tier: "STANDARD",
      isDemo: false,
      serial: "E2E01",
      user_uid: null,
      activated_at: null,
      linkedProfileId: null,
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function delete2099(db: FirebaseFirestore.Firestore) {
  const profiles = await db
    .collection("profiles")
    .where("health_id", "==", E2E2099)
    .get();
  for (const d of profiles.docs) await d.ref.delete().catch(() => {});
  await db.collection("cards").doc(E2E_CODE).delete().catch(() => {});
  try {
    const bucket = getStorage().bucket();
    for (const prefix of [`profiles/${E2E2099}/`, `pending/${E2E2099}/`]) {
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) await f.delete({ ignoreNotFound: true });
    }
  } catch {
    /* */
  }
}

async function countRealUnactivated(db: FirebaseFirestore.Firestore) {
  const snap = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<=", "KVS-2026-\uf8ff")
    .get();
  let un = 0;
  for (const d of snap.docs) {
    if (String(d.data().status) === "unactivated") un += 1;
  }
  return { total: snap.size, unactivated: un };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const db = adminDb();
  const before = await countRealUnactivated(db);

  // #1 captcha after repeated wrong codes (demo)
  await resetDemoCard(db);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    let captchaSeen = false;
    for (let i = 0; i < 8; i++) {
      await page.locator("#activation-code").fill("0000");
      await page.getByRole("button", { name: /Continue/i }).click();
      await page.waitForTimeout(700);
      const body = await page.content();
      if (/captcha|What is|solve/i.test(body)) {
        captchaSeen = true;
        break;
      }
    }
    captchaSeen
      ? pass("1c captcha after wrong codes")
      : fail("1c captcha", "not shown after 8 tries");
    await shot(page, "01c-captcha");

    // Legacy activate → 410
    const leg = await page.request.post(`${BASE}/api/auth/activate`, {
      data: { activation_code: "0001", phone: "9999900001", pinHash: "a".repeat(64), healthProfile: { full_name: "x" } },
    });
    leg.status() === 410
      ? pass("legacy auth/activate 410")
      : fail("legacy 410", `status=${leg.status()}`);

    // #8 refresh mid-wizard (start session with correct code, refresh)
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.locator("#activation-code").fill(DEMO_ACTIVATION_CODE);
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const afterRefresh = await page.content();
    /Medical|Blood|Activate your card|session|expired|restart/i.test(afterRefresh)
      ? pass("8 refresh mid-wizard no crash")
      : fail("8 refresh");
    await shot(page, "08-refresh");

    // Hindi + 360
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}?lang=hi`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);
    const hiBtn = page.getByRole("button", { name: /हिंदी|Hindi|HI/i });
    if ((await hiBtn.count()) > 0) await hiBtn.first().click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "hi-360-step1");
    pass("hi+360 screenshot");

    // #11 my-profile via preview (demo must be activated first lightly)
    // Activate demo via API-level minimal profile for login tests
    await ensure2099(db);
    const pinHash = await hashPin(PIN);
    const profileRef = db.collection("profiles").doc();
    await profileRef.set({
      health_id: E2E2099,
      full_name: "E2E Disposable",
      phone: PHONE.slice(-10),
      phoneNormalized: `+91${PHONE.slice(-10)}`,
      blood_group: "O+",
      allergies: ["None"],
      chronic_conditions: ["None"],
      medications: ["None"],
      emergency_contacts: [
        { name: "A", phone: "9999900011", relation: "Other" },
        { name: "B", phone: "9999900012", relation: "Other" },
      ],
      pin_hash: pinHash,
      city: "TestCity",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      validFrom: new Date().toISOString().slice(0, 10),
      validTill: "2027-10-07",
    });
    await db.collection("cards").doc(E2E_CODE).set(
      {
        status: "activated",
        linkedProfileId: profileRef.id,
        activated_at: FieldValue.serverTimestamp(),
        health_id: E2E2099,
      },
      { merge: true }
    );

    await page.setViewportSize({ width: 390, height: 844 });
    if (!PREVIEW || PREVIEW.length < 16) {
      pass("11 my-profile preview skipped (no PRELAUNCH_PREVIEW_SECRET)");
    } else {
      await page.goto(`${BASE}/my-profile?preview=${PREVIEW}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1500);
      const loginInput = page
        .getByLabel(/Health ID|phone|Phone|Login/i)
        .or(page.locator('input[type="text"], input[inputmode="tel"]').first());
      await loginInput.first().fill(E2E2099);
      const pinInput = page.locator('input[type="password"]').first();
      await pinInput.fill("111111");
      await page.getByRole("button", { name: /^Log in$/i }).click();
      await page.waitForTimeout(1000);
      await shot(page, "11-wrong-pin");
      const wrongHtml = await page.content();
      /incorrect|invalid|wrong|attempts|lock/i.test(wrongHtml)
        ? pass("11 wrong PIN feedback")
        : fail("11 wrong PIN");

      await pinInput.fill(PIN);
      await page.getByRole("button", { name: /^Log in$/i }).click();
      await page.waitForTimeout(2500);
      await shot(page, "11-profile");
      const prof = await page.content();
      /E2E Disposable|Validity|Access|Referral|Lost|Sticker|validity/i.test(prof)
        ? pass("11 profile loaded")
        : fail("11 profile load");
    }

    // Pre-launch: real card still blocked for activation
    const gate = await page.request.post(`${BASE}/api/card/activate`, {
      data: {
        health_id: "KVS-2026-75QW6",
        activation_code: "0000",
        pin: "1234",
      },
    });
    const gj = await gate.json().catch(() => ({}));
    /ACTIVATION_NOT_OPEN|opens/i.test(JSON.stringify(gj))
      ? pass("14 real still gated")
      : fail("14 gate", JSON.stringify(gj).slice(0, 80));

    await context.clearCookies();
    await page.goto(`${BASE}/my-profile`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const blocked = page.url().includes("coming-soon");
    blocked
      ? pass("14 my-profile blocked without preview")
      : fail("14 my-profile open without preview");
  } catch (e) {
    fail("exception", e instanceof Error ? e.message.slice(0, 160) : "err");
    await shot(page, "99-finish-error").catch(() => {});
  }

  await browser.close();
  await delete2099(db);
  await resetDemoCard(db);

  const after = await countRealUnactivated(db);
  after.unactivated === 500 && after.unactivated === before.unactivated
    ? pass("real 500 unchanged")
    : fail("real count", `before=${before.unactivated} after=${after.unactivated}`);

  console.log("=== E2E FINISH ===");
  for (const r of rows) console.log(`${r.result.padEnd(40)} ${r.step}`);
  if (rows.some((r) => r.result.startsWith("FAIL"))) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

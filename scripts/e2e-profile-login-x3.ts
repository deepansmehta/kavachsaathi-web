/**
 * Production: prove my-profile login + edit (steps 7–8) × 3.
 * One robust activation, then 3 login→edit→public cycles, then reset DEMO.
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page, type BrowserContext } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import bcrypt from "bcryptjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";
import { buildEncryptedDocFields } from "../src/lib/documents";
import { normalizePhone } from "../src/lib/phone";

const BASE = "https://kavachsaathi.in";
const PIN = "482913";
const PHONE = "9999900001";
const OUT = path.join(
  process.cwd(),
  `exports/e2e-profile-x3-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
);

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

function jpegBytes(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
    "base64"
  );
}

async function clearRateLimits(db: ReturnType<typeof getFirestore>) {
  const snap = await db.collection("rate_limits").get();
  for (const d of snap.docs) await d.ref.delete().catch(() => {});
}

/** Seed activated DEMO via Admin (same Storage + enc as UI) — then hit prod login UI ×3 */
async function seedActivatedDemo(db: ReturnType<typeof getFirestore>) {
  await resetDemoCard(db);
  await clearRateLimits(db);
  const cardSnap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!cardSnap.exists || cardSnap.data()?.isDemo !== true) {
    throw new Error("REFUSED: demo missing");
  }

  const bucket = getStorage().bucket();
  const img = jpegBytes();
  const paths = {
    photo: `profiles/${DEMO_HEALTH_ID}/photo.jpg`,
    id1: `profiles/${DEMO_HEALTH_ID}/id1-front.jpg`,
    id2: `profiles/${DEMO_HEALTH_ID}/id2-front.jpg`,
    addr: `profiles/${DEMO_HEALTH_ID}/address-proof.jpg`,
    policy: `profiles/${DEMO_HEALTH_ID}/policy-card.jpg`,
    bond: `profiles/${DEMO_HEALTH_ID}/policy-bond.pdf`,
  };
  const pdf = await PDFDocument.create();
  const pg = pdf.addPage([400, 500]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pg.drawText("SAMPLE", { x: 40, y: 400, size: 12, font, color: rgb(0, 0, 0) });
  const pdfBytes = Buffer.from(await pdf.save());

  await bucket.file(paths.photo).save(img, { contentType: "image/jpeg", resumable: false });
  await bucket.file(paths.id1).save(img, { contentType: "image/jpeg", resumable: false });
  await bucket.file(paths.id2).save(img, { contentType: "image/jpeg", resumable: false });
  await bucket.file(paths.addr).save(img, { contentType: "image/jpeg", resumable: false });
  await bucket.file(paths.policy).save(img, { contentType: "image/jpeg", resumable: false });
  await bucket.file(paths.bond).save(pdfBytes, {
    contentType: "application/pdf",
    resumable: false,
  });

  const enc = buildEncryptedDocFields({
    photoPath: paths.photo,
    idProofs: [
      { type: "pan", number: "ABCDE1234F", frontPath: paths.id1 },
      { type: "driving_licence", number: "HR9920260000001", frontPath: paths.id2 },
    ],
    address: {
      line: "12 Sample Street",
      city: "Fatehabad",
      state: "Haryana",
      pincode: "125050",
    },
    addressProof: {
      sameAsIdIndex: null,
      path: paths.addr,
      type: "utility_bill",
    },
    insurance: {
      coverageType: "private",
      private: {
        insurerName: "Test Insurance Co",
        policyNumber: "POL-DUMMY-0001",
        policyHolderName: "E2E Demo User",
        policyCardPath: paths.policy,
        policyBondPath: paths.bond,
      },
    },
    consents: {
      photoPublic: true,
      docsForAdmission: true,
      dpdpConsent: true,
    },
  });

  const pin_hash = await bcrypt.hash(PIN, 10);
  const phoneNormalized = normalizePhone(PHONE) || PHONE;
  const profileRef = db.collection("profiles").doc();
  await profileRef.set({
    health_id: DEMO_HEALTH_ID,
    full_name: "E2E Demo User",
    phone: PHONE,
    phoneNormalized,
    pin_hash,
    blood_group: "A+",
    city: "Fatehabad",
    allergies: [],
    chronic_conditions: [],
    medications: [],
    emergency_contacts: [
      { name: "EC Person", phone: "9999900002", relation: "Spouse" },
    ],
    photo_url: paths.photo,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    ...enc,
  });

  await db.collection("cards").doc(DEMO_HEALTH_ID).update({
    status: "activated",
    linkedProfileId: profileRef.id,
    activated_at: FieldValue.serverTimestamp(),
  });

  // Confirm Firestore write visible, then poll public view (edge may lag)
  const stored = (await profileRef.get()).data();
  if (
    !(stored?.insurance as { private?: { insurerName?: string } } | undefined)
      ?.private?.insurerName
  ) {
    throw new Error("seed write missing insurance.private.insurerName");
  }

  let ok = false;
  let lastHint = "";
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 800 + i * 200));
    const res = await fetch(`${BASE}/card/${DEMO_HEALTH_ID}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    const html = await res.text();
    const hasIns =
      /Insured with/i.test(html) && /Test Insurance Co/i.test(html);
    const hasPhoto = /ks-photo|GoogleAccessId|X-Goog-/i.test(html);
    const hasName = /E2E Demo User/i.test(html);
    lastHint = `http=${res.status} ins=${hasIns} photo=${hasPhoto} name=${hasName} activate=${/Activate your card/i.test(html)} rate=${/Too many requests/i.test(html)}`;
    if (hasIns && hasPhoto && hasName) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error(`public view missing photo/insurer after seed (${lastHint})`);
  console.log("seed_activated_demo: PASS (photo + insurer on /card)");
}

async function solveCaptcha(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const m = bodyText.match(/(\d+)\s*([+\-×x*\/])\s*(\d+)\s*=\s*\?/);
  if (!m) return false;
  const a = Number(m[1]);
  const op = m[2];
  const b = Number(m[3]);
  const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const field =
    (await page.getByLabel(/^Answer$/i).count()) > 0
      ? page.getByLabel(/^Answer$/i)
      : (await page.getByLabel(/CAPTCHA/i).count()) > 0
        ? page.getByLabel(/CAPTCHA/i)
        : null;
  if (!field) return false;
  await field.first().fill(String(ans));
  return true;
}

async function loginEditPublic(
  context: BrowserContext,
  round: number,
  tag: string
) {
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  try {
    // Warm the function (cold start)
    await page.goto(`${BASE}/my-profile`, { waitUntil: "domcontentloaded" });
    await page.getByLabel(/Health ID or phone/i).waitFor({ state: "visible" });
    await page.getByLabel(/Health ID or phone/i).fill(PHONE);
    await page.getByLabel(/^PIN$/i).fill(PIN);
    await solveCaptcha(page);

    const loginBtn = page.getByRole("button", { name: /^Log in$/i });
    await loginBtn.waitFor({ state: "visible" });

    let lastStatus = 0;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      await solveCaptcha(page);
      const respPromise = page.waitForResponse(
        (r) =>
          r.url().includes("/api/profile/login") &&
          r.request().method() === "POST",
        { timeout: 90000 }
      );
      await loginBtn.click();
      const loginRes = await respPromise;
      lastStatus = loginRes.status();
      const body = await loginRes.json().catch(() => ({} as Record<string, unknown>));
      lastError = String(body.error || "");
      if (body.captchaRequired) {
        await solveCaptcha(page);
        continue;
      }
      if (loginRes.ok()) break;
      if (attempt === 2) {
        throw new Error(`login HTTP ${lastStatus} ${lastError.slice(0, 100)}`);
      }
      await page.waitForTimeout(1500);
    }

    await page.getByRole("button", { name: /Save changes/i }).waitFor({
      state: "visible",
      timeout: 60000,
    });
    await page.screenshot({
      path: path.join(OUT, `${round}-login.png`),
      fullPage: true,
    });

    const input = page.getByPlaceholder(/Type and press Enter/i).first();
    await input.waitFor({ state: "visible" });
    await input.fill(tag);
    await input.press("Enter");
    await page.getByText(new RegExp(`^${tag}$`, "i")).first().waitFor({
      state: "visible",
      timeout: 10000,
    });

    const savePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/profile/update") &&
        r.request().method() === "PATCH",
      { timeout: 60000 }
    );
    await page.getByRole("button", { name: /Save changes/i }).click();
    const saveRes = await savePromise;
    if (!saveRes.ok()) throw new Error(`save HTTP ${saveRes.status()}`);
    await page.screenshot({
      path: path.join(OUT, `${round}-saved.png`),
      fullPage: true,
    });

    // Poll public view until edit is visible (CDN/SSR may lag briefly)
    let publicOk = false;
    for (let i = 0; i < 6; i++) {
      await page.goto(
        `${BASE}/card/${DEMO_HEALTH_ID}?t=${Date.now()}&r=${round}`,
        { waitUntil: "domcontentloaded" }
      );
      const html = await page.content();
      const hasTag = new RegExp(tag, "i").test(html);
      const hasIns = /Insured with:/i.test(html);
      const hasPhoto = /ks-photo|GoogleAccessId|X-Goog-/i.test(html);
      if (hasTag && hasIns && hasPhoto) {
        publicOk = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!publicOk) {
      throw new Error("public view missing tag/Insured/photo after save");
    }
    await page.getByText(new RegExp(tag, "i")).first().waitFor({
      state: "visible",
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(OUT, `${round}-public.png`),
      fullPage: true,
    });
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const db = adminDb();
  const browser = await chromium.launch({ headless: true });
  const results: string[] = [];

  try {
    await seedActivatedDemo(db);
    for (let round = 1; round <= 3; round++) {
      await clearRateLimits(db);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      try {
        await loginEditPublic(context, round, `PeanutR${round}`);
        results.push(`round ${round}: PASS`);
        console.log(results[results.length - 1]);
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 180) : "err";
        results.push(`round ${round}: FAIL ${msg}`);
        console.log(results[results.length - 1]);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await resetDemoCard(db);
    try {
      const [files] = await getStorage()
        .bucket()
        .getFiles({ prefix: `profiles/${DEMO_HEALTH_ID}/` });
      for (const f of files) await f.delete({ ignoreNotFound: true });
    } catch {
      /* */
    }
    const card = (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data();
    const profiles = await db
      .collection("profiles")
      .where("health_id", "==", DEMO_HEALTH_ID)
      .get();
    console.log(
      card?.status === "unactivated" && profiles.empty
        ? "demo_final: unactivated_empty PASS"
        : `demo_final: FAIL status=${card?.status} profiles=${profiles.size}`
    );
  }

  console.log("screenshot_dir=" + OUT);
  console.log("=== PROFILE LOGIN ×3 ===");
  for (const r of results) console.log(r);
  const pass = results.filter((r) => r.includes(": PASS")).length;
  console.log(`summary: ${pass}/3 PASS`);
  if (pass < 3) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

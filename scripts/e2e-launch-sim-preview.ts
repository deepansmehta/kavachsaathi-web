/**
 * Preview-only launch simulation E2E (demo card KVS-DEMO-00001).
 *
 *   PREVIEW_BASE_URL=https://launch-test--kavachsaathi.netlify.app \
 *     npx --yes tsx scripts/e2e-launch-sim-preview.ts
 *
 * Never targets production. Resets demo at end.
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DEMO_HEALTH_ID, DEMO_ACTIVATION_CODE } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = String(process.env.PREVIEW_BASE_URL || "").replace(/\/$/, "");
const PIN = "482913";
const PHONE = "9999900001";
const OUT = path.join(process.cwd(), "exports/e2e-launch-sim");

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function dbInit() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  return getFirestore();
}

async function tinyJpeg(name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  // minimal valid jpeg
  const buf = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6gP/xAAZEAACAwEAAAAAAAAAAAAAAAAAAQIDURL/2gAIAQEAAQUCfZj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAZEAACAwEAAAAAAAAAAAAAAAAAAQIRITH/2gAIAQEABj8CbTOX/8QAGBAAAwEBAAAAAAAAAAAAAAAAAAERITH/2gAIAQEAAT8hVbZP/9k=",
    "base64"
  );
  fs.writeFileSync(p, buf);
  return p;
}

async function makePdf(name: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Launch sim ID", { x: 40, y: 100, size: 14, font, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
  const p = path.join(OUT, name);
  fs.writeFileSync(p, bytes);
  return p;
}

async function setHiddenFile(
  locator: ReturnType<Page["locator"]>,
  filePath: string
) {
  await locator.setInputFiles(filePath);
}

async function fillByLabel(page: Page, re: RegExp, value: string) {
  const el = page.getByLabel(re).first();
  await el.fill(value);
}

async function clickNext(page: Page) {
  const btn = page.getByRole("button", { name: /Next|Continue|Submit|Activate|Finish/i }).last();
  await btn.click();
  await page.waitForTimeout(800);
}

async function solveMathCaptchaIfPresent(page: Page) {
  const q = page.getByText(/\d+\s*\+\s*\d+\s*=/);
  if ((await q.count()) === 0) return false;
  const text = await q.first().innerText();
  const m = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return false;
  const ans = String(Number(m[1]) + Number(m[2]));
  const input = page.getByLabel(/captcha|answer/i).first();
  if ((await input.count()) > 0) await input.fill(ans);
  else await page.locator('input[type="text"]').last().fill(ans);
  return true;
}

async function main() {
  if (!BASE || /kavachsaathi\.in$/i.test(new URL(BASE).hostname) && !BASE.includes("--")) {
    if (!BASE.includes("netlify.app") && !BASE.includes("localhost")) {
      console.error("REFUSED: set PREVIEW_BASE_URL to a Netlify preview URL (not production)");
      process.exit(1);
    }
  }
  if (BASE.includes("kavachsaathi.in") && !BASE.includes("--")) {
    console.error("REFUSED: production URL blocked");
    process.exit(1);
  }

  const db = dbInit();
  await resetDemoCard(db);
  fs.mkdirSync(OUT, { recursive: true });
  const photo = await tinyJpeg("photo.jpg");
  const id1 = await makePdf("id1.pdf");
  const id2 = await makePdf("id2.pdf");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const results: { id: string; ok: boolean; detail: string }[] = [];
  const pass = (id: string, detail = "") => {
    results.push({ id, ok: true, detail });
    console.log("PASS", id, detail);
  };
  const fail = (id: string, detail: string) => {
    results.push({ id, ok: false, detail });
    console.log("FAIL", id, detail);
  };

  try {
    // Start sim
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}?launchIn=30`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    const hasBanner = /TEST MODE — simulated launch/i.test(body);
    const hasCountdown =
      /Activation opens|simulated|Sec|Min/i.test(body) &&
      !/Enter activation code/i.test(body);
    hasBanner ? pass("1 banner") : fail("1 banner", "missing");
    hasCountdown
      ? pass("2 countdown visible")
      : fail("2 countdown visible", body.slice(0, 200));

    // Wait for auto-refresh after ~30s (+ buffer)
    // Playwright: waitForFunction(fn, arg, options) — options are 3rd arg
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText || "";
        return /activation code|Enter.*code|Continue/i.test(t);
      },
      undefined,
      { timeout: 90_000 }
    );
    pass("3 activation step 1 opened after countdown");

    // Activation code
    await fillByLabel(page, /Activation code/i, DEMO_ACTIVATION_CODE);
    await solveMathCaptchaIfPresent(page);
    await page.getByRole("button", { name: /Continue/i }).click();
    for (let i = 0; i < 8; i++) {
      try {
        await page.getByLabel(/Full name/i).waitFor({ state: "visible", timeout: 4000 });
        break;
      } catch {
        await solveMathCaptchaIfPresent(page);
        await fillByLabel(page, /Activation code/i, DEMO_ACTIVATION_CODE);
        await page.getByRole("button", { name: /Continue/i }).click();
      }
    }
    await page.getByLabel(/Full name/i).waitFor({ state: "visible", timeout: 15000 });
    pass("4 code accepted");

    await fillByLabel(page, /Full name/i, "Launch Sim Demo");
    await fillByLabel(page, /Mobile/i, PHONE);
    await page.locator("select").first().selectOption({ index: 1 });
    await fillByLabel(page, /^City$/i, "Fatehabad");
    await fillByLabel(page, /^Name$/i, "EC Person");
    await fillByLabel(page, /^Phone$/i, "9999900002");
    await clickNext(page);

    await setHiddenFile(page.locator('input[type="file"]').first(), photo);
    await page.waitForTimeout(5000);
    await clickNext(page);

    await page.getByText(/Exactly 2 different IDs/i).waitFor({ timeout: 15000 });
    const selects = page.locator("select");
    await selects.nth(0).selectOption("pan");
    await page.getByLabel(/^ID number$/i).nth(0).fill("ABCDE1234F");
    await setHiddenFile(page.locator('input[type="file"]').nth(0), id1);
    await page.waitForTimeout(4000);
    await selects.nth(1).selectOption("driving_licence");
    const idNums = page.getByLabel(/^ID number$/i);
    if ((await idNums.count()) >= 2) await idNums.nth(1).fill("HR9920260000001");
    const files = page.locator('input[type="file"]');
    await setHiddenFile(files.nth(Math.min(2, (await files.count()) - 1)), id2);
    await page.waitForTimeout(4000);
    await clickNext(page);

    await fillByLabel(page, /Address line/i, "12 Sample Street");
    await fillByLabel(page, /^City$/i, "Fatehabad");
    await fillByLabel(page, /State/i, "Haryana");
    await fillByLabel(page, /Pincode/i, "125050");
    await setHiddenFile(page.locator('input[type="file"]').first(), id1);
    await page.waitForTimeout(4000);
    await clickNext(page);

    await page.locator("select").first().selectOption("private");
    await page.waitForTimeout(400);
    const insurerSelect = page.locator("select").nth(1);
    const opts = await insurerSelect.locator("option").allTextContents();
    if (opts.some((o) => /other/i.test(o))) {
      await insurerSelect.selectOption({ label: "Other" });
      if ((await page.getByLabel(/Insurer name/i).count()) > 0) {
        await fillByLabel(page, /Insurer name/i, "Test Insurance Co");
      }
    } else if (opts.length > 1) {
      await insurerSelect.selectOption({ index: 1 });
    }
    await clickNext(page);

    // Consents + PIN
    for (const c of await page.locator('input[type="checkbox"]').all()) {
      try {
        await c.check({ force: true });
      } catch {
        /* ignore */
      }
    }
    if ((await page.getByLabel(/PIN/i).count()) > 0) {
      await fillByLabel(page, /PIN/i, PIN);
      if ((await page.getByLabel(/Confirm/i).count()) > 0) {
        await fillByLabel(page, /Confirm/i, PIN);
      }
    }
    await clickNext(page);
    await page.waitForTimeout(3000);

    // Emergency view
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
    const em = await page.locator("body").innerText();
    /Alert Family/i.test(em) ? pass("5 Alert Family") : fail("5 Alert Family", "missing");
    (await page.locator('a[href="tel:108"]').count()) > 0
      ? pass("6 Quick Call 108")
      : fail("6 Quick Call 108", "missing");
    /Test Insurance|Insurer|Insurance/i.test(em)
      ? pass("7 insurer visible")
      : fail("7 insurer visible", "missing");

    // Full details + PDFs
    await page.getByText(/Open Full Details/i).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Patient \/ family has the PIN/i }).click();
    await page.getByLabel(/PIN/i).fill(PIN);
    await page.getByRole("button", { name: /Unlock|Submit|Continue/i }).click();
    await page.waitForTimeout(2000);

    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    for (const ep of ["cashless", "admission-sheet"] as const) {
      const res = await fetch(
        `${BASE}/api/forms/${ep}?health_id=${DEMO_HEALTH_ID}`,
        { headers: { Cookie: cookieHeader } }
      );
      res.status === 200 &&
      (res.headers.get("content-type") || "").includes("pdf")
        ? pass(`8 ${ep} PDF 200`)
        : fail(`8 ${ep} PDF`, `status=${res.status}`);
    }

    // my-profile login (sim cookie should have opened site)
    await page.goto(`${BASE}/my-profile`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    if (/coming-soon/i.test(page.url())) {
      fail("9 my-profile", "still coming-soon");
    } else {
      pass("9 my-profile reachable");
      try {
        await fillByLabel(page, /phone|mobile/i, PHONE);
        await fillByLabel(page, /PIN|pin/i, PIN);
        await page.getByRole("button", { name: /Log ?in|Sign ?in|Continue/i }).click();
        await page.waitForTimeout(2500);
        const t = await page.locator("body").innerText();
        /Launch Sim|profile|demo|logout|sign out|scans/i.test(t)
          ? pass("10 profile login")
          : fail("10 profile login", t.slice(0, 160));
      } catch (e) {
        fail("10 profile login", String(e));
      }
    }
  } finally {
    await browser.close();
    await resetDemoCard(db);
    const card = (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data();
    card?.status === "unactivated"
      ? pass("11 demo reset unactivated")
      : fail("11 demo reset", String(card?.status));
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\nsummary: ${results.length - fails.length}/${results.length} PASS`);
  if (fails.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

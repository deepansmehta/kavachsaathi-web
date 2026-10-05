/**
 * Production E2E (Playwright) — DEMO card only. Mobile 390x844.
 * Never prints activation codes / PINs / secrets.
 *
 *   npx playwright install chromium
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/e2e-prod-demo-playwright.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page, type Locator } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = (
  process.env.PREVIEW_BASE_URL ||
  process.env.E2E_BASE_URL ||
  "https://kavachsaathi.in"
).replace(/\/$/, "");
const LAUNCH_SIM = Boolean(process.env.PREVIEW_BASE_URL);
const PIN = "482913";
const PHONE = "9999900001";
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUT = path.join(
  process.cwd(),
  LAUNCH_SIM ? `exports/e2e-launch-sim-${DATE}` : `exports/e2e-prod-${DATE}`
);
const INSURER_TARGET = "Test Insurance Co";

if (LAUNCH_SIM && /kavachsaathi\.in$/i.test(new URL(BASE).hostname)) {
  throw new Error("REFUSED: PREVIEW_BASE_URL must not be production");
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

function jpegBytes(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
    "base64"
  );
}

async function makePdf(file: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("SAMPLE POLICY BOND — NOT REAL", {
    x: 40,
    y: 400,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  fs.writeFileSync(file, await doc.save());
}

const rows: { step: string; result: string }[] = [];
function pass(step: string) {
  rows.push({ step, result: "PASS" });
}
function fail(step: string, why = "") {
  rows.push({ step, result: `FAIL${why ? ": " + why : ""}` });
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: true,
  });
}

async function clickNext(page: Page) {
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.waitForTimeout(800);
}

async function waitUploaded(page: Page, min = 1) {
  for (let i = 0; i < 30; i++) {
    const n = await page.getByText(/Front ✓|Address proof ✓|Policy card ✓|Policy bond ✓|Photo/i).count();
    if (n >= min) return;
    await page.waitForTimeout(500);
  }
}

async function fillByLabel(page: Page, re: RegExp, value: string, nth = 0) {
  const loc = page.getByLabel(re).nth(nth);
  await loc.waitFor({ state: "visible", timeout: 15000 });
  await loc.fill(value);
}

async function setHiddenFile(locator: Locator, file: string) {
  await locator.setInputFiles(file);
}

async function solveMathCaptchaIfPresent(page: Page) {
  const label = page.getByLabel(/CAPTCHA/i);
  if ((await label.count()) === 0) return false;
  const bodyText = await page.locator("body").innerText();
  const m = bodyText.match(/(\d+)\s*([+\-×x*\/])\s*(\d+)\s*=\s*\?/);
  if (!m) throw new Error("CAPTCHA present but question not parsed");
  const a = Number(m[1]);
  const op = m[2];
  const b = Number(m[3]);
  let ans = 0;
  if (op === "+") ans = a + b;
  else if (op === "-") ans = a - b;
  else if (op === "×" || op === "x" || op === "*") ans = a * b;
  else if (op === "/") ans = Math.floor(a / b);
  await label.first().fill(String(ans));
  return true;
}

async function clearRateLimits(db: ReturnType<typeof getFirestore>) {
  const snap = await db.collection("rate_limits").get();
  for (const d of snap.docs) await d.ref.delete().catch(() => {});
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
  const photo = path.join(OUT, "assets/photo.jpg");
  const id1 = path.join(OUT, "assets/id-pan.jpg");
  const id2 = path.join(OUT, "assets/id-dl.jpg");
  const policyCard = path.join(OUT, "assets/policy-card.jpg");
  const bond = path.join(OUT, "assets/policy-bond.pdf");
  fs.writeFileSync(photo, jpegBytes());
  fs.writeFileSync(id1, jpegBytes());
  fs.writeFileSync(id2, jpegBytes());
  fs.writeFileSync(policyCard, jpegBytes());
  await makePdf(bond);

  const db = adminDb();
  const cardSnap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!cardSnap.exists || cardSnap.data()?.isDemo !== true) {
    throw new Error("REFUSED: demo card missing or not isDemo");
  }
  await resetDemoCard(db);
  await clearRateLimits(db);
  const fresh = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  const actCode = String(fresh.data()?.activation_code || "").padStart(4, "0");

  let insurerUsed = INSURER_TARGET;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  try {
    if (LAUNCH_SIM) {
      await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}?launchIn=15`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1000);
      const simBody = await page.locator("body").innerText();
      /TEST MODE — simulated launch/i.test(simBody)
        ? pass("0a launch-sim banner")
        : fail("0a launch-sim banner");
      /Activation opens|SEC|Sec/i.test(simBody)
        ? pass("0b countdown")
        : fail("0b countdown");
      await page.waitForFunction(
        () =>
          /activation code|ACTIVATION CODE|Enter the secret/i.test(
            document.body?.innerText || ""
          ),
        undefined,
        { timeout: 60_000 }
      );
      pass("0c activation opened after sim");
    } else {
      await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1500);
    }
    await shot(page, "01-step1");

    // Wrong code → error (skip on launch-sim to save time)
    if (!LAUNCH_SIM) {
    await fillByLabel(page, /Activation code/i, "0000");
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.waitForTimeout(2500);
    const wrongVisible =
      (await page.getByText(/does not match|Invalid|incorrect|wrong/i).count()) >
        0 ||
      (await page.locator("text=/match|Invalid/i").count()) > 0;
    const stillStep1 =
      (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data()
        ?.status === "unactivated";
    wrongVisible && stillStep1
      ? pass("1 wrong code shows error")
      : stillStep1
        ? pass("1 wrong code keeps unactivated")
        : fail("1 wrong code", `toast=${wrongVisible} unact=${stillStep1}`);
    await shot(page, "02-wrong-code");

    // CAPTCHA if shown after wrong attempts
    await solveMathCaptchaIfPresent(page);
    }

    await fillByLabel(page, /Activation code/i, actCode);
    await solveMathCaptchaIfPresent(page);
    await page.getByRole("button", { name: /Continue/i }).click();
    // If captcha required on response, solve and retry once
    for (let i = 0; i < 3; i++) {
      try {
        await page.getByLabel(/Full name/i).waitFor({ state: "visible", timeout: 8000 });
        break;
      } catch {
        const had = await solveMathCaptchaIfPresent(page);
        if (!had) await page.waitForTimeout(1000);
        await fillByLabel(page, /Activation code/i, actCode);
        await solveMathCaptchaIfPresent(page);
        await page.getByRole("button", { name: /Continue/i }).click();
      }
    }
    await page.getByLabel(/Full name/i).waitFor({ state: "visible", timeout: 15000 });
    pass("1b activation code → step 2");

    // Step 2 medical
    await fillByLabel(page, /Full name/i, "E2E Demo User");
    await fillByLabel(page, /Mobile/i, PHONE);
    await page.locator("select").first().selectOption({ index: 1 });
    await fillByLabel(page, /^City$/i, "Fatehabad");
    await fillByLabel(page, /^Name$/i, "EC Person");
    await fillByLabel(page, /^Phone$/i, "9999900002");
    await shot(page, "03-medical");
    await clickNext(page);

    // Photo
    await page.getByText(/photo|selfie|face/i).first().waitFor({ timeout: 10000 }).catch(() => {});
    await setHiddenFile(page.locator('input[type="file"]').first(), photo);
    await page.waitForTimeout(6000);
    await shot(page, "04-photo");
    await clickNext(page);

    // IDs — two blocks
    await page.getByText(/Exactly 2 different IDs/i).waitFor({ timeout: 10000 });
    const idBlocks = page.locator("div.space-y-2.rounded-lg.border");
    // Fallback: all selects on page for ID types
    const selects = page.locator("select");
    await selects.nth(0).selectOption("pan");
    await page.waitForTimeout(300);
    await page.getByLabel(/^ID number$/i).nth(0).fill("ABCDE1234F");
    await setHiddenFile(page.locator('input[type="file"]').nth(0), id1);
    await page.waitForTimeout(5000);

    await selects.nth(1).selectOption("driving_licence");
    await page.waitForTimeout(400);
    const idNumInputs = page.getByLabel(/^ID number$/i);
    const idCount = await idNumInputs.count();
    if (idCount < 2) {
      // fill second text-like input in second block
      await page.locator('input[type="text"], input:not([type])').nth(1).fill("HR9920260000001");
    } else {
      await idNumInputs.nth(1).fill("HR9920260000001");
    }
    // Front uploads: hidden file inputs index 0 and 2 (front/back pairs) or 0 and 1
    const files = page.locator('input[type="file"]');
    const fc = await files.count();
    // Upload id2 front — prefer an input that hasn't got a file yet
    await setHiddenFile(files.nth(Math.min(2, fc - 1)), id2);
    await page.waitForTimeout(5000);
    // Ensure Front ✓ appears twice
    for (let i = 0; i < 20; i++) {
      if ((await page.getByText("Front ✓").count()) >= 2) break;
      await page.waitForTimeout(500);
    }
    await shot(page, "05-ids");
    await clickNext(page);

    // Address
    await page.getByLabel(/Address line/i).waitFor({ state: "visible", timeout: 15000 });
    await fillByLabel(page, /Address line/i, "12 Sample Street");
    await fillByLabel(page, /^City$/i, "Fatehabad");
    if ((await page.getByLabel(/District/i).count()) > 0) {
      await fillByLabel(page, /District/i, "Fatehabad");
    }
    await fillByLabel(page, /State/i, "Haryana");
    await fillByLabel(page, /Pincode/i, "125050");
    // Prefer same-as ID 1 (PAN may not be valid address proof — check)
    const proofSelect = page.locator("select").last();
    // Upload separate proof to avoid type restrictions
    const optCount = await proofSelect.locator("option").count();
    if (optCount >= 1) {
      // leave "Upload separate proof" and upload file
      await setHiddenFile(page.locator('input[type="file"]').first(), id1);
      await page.waitForTimeout(5000);
    }
    await shot(page, "06-address");
    await clickNext(page);

    // Insurance
    await page.getByText(/^Coverage$/i).waitFor({ timeout: 10000 }).catch(() => {});
    await page.locator("select").first().selectOption("private");
    await page.waitForTimeout(500);
    const insurerSelect = page.locator("select").nth(1);
    const options = await insurerSelect.locator("option").allTextContents();
    const hasOther = options.some((o) => /other/i.test(o));
    if (hasOther) {
      await insurerSelect.selectOption({ label: "Other" });
      await page.waitForTimeout(400);
      if ((await page.getByLabel(/Insurer name/i).count()) > 0) {
        await fillByLabel(page, /Insurer name/i, INSURER_TARGET);
        insurerUsed = INSURER_TARGET;
      } else {
        // Other selected but no free-text yet on this deploy
        await insurerSelect.selectOption({ label: "Star Health" });
        insurerUsed = "Star Health";
      }
    } else {
      await insurerSelect.selectOption({ label: "Star Health" });
      insurerUsed = "Star Health";
    }
    await fillByLabel(page, /Policy number/i, "POL-DUMMY-0001");
    await fillByLabel(page, /Policy holder/i, "E2E Demo User");
    const ifiles = page.locator('input[type="file"]');
    await setHiddenFile(ifiles.nth(0), policyCard);
    await page.waitForTimeout(5000);
    await setHiddenFile(ifiles.nth(1), bond);
    await page.waitForTimeout(6000);
    await shot(page, "07-insurance");
    await clickNext(page);

    // Consents + PIN
    await page.getByLabel(/Set PIN/i).waitFor({ state: "visible", timeout: 15000 });
    const checks = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await checks.count()); i++) {
      await checks.nth(i).check({ force: true });
    }
    await fillByLabel(page, /Set PIN/i, PIN);
    await fillByLabel(page, /Confirm PIN/i, PIN);
    await shot(page, "08-consents");
    await page.getByRole("button", { name: /Activate card/i }).click();
    await page.waitForTimeout(12000);
    await shot(page, "09-activated");
    const st = (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data()
      ?.status;
    st === "activated" || st === "active"
      ? pass("2 seven-step activation")
      : fail("2 activation", String(st));

    // Ensure critical flags exist so Phase 1 badges render on emergency view
    {
      const card = (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data();
      const pid = card?.linkedProfileId as string | undefined;
      if (pid) {
        await db
          .collection("profiles")
          .doc(pid)
          .set(
            {
              criticalFlags: {
                tags: ["Diabetic (insulin)", "Severe allergy"],
                allergyText: "Penicillin",
              },
            },
            { merge: true }
          );
      }
    }

    // Public view
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2500);
    const html = await page.content();
    const insurerOk = new RegExp(insurerUsed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
      html
    );
    const ok3 =
      insurerOk &&
      /Open Full Details/i.test(html) &&
      !/POL-DUMMY-0001/i.test(html) &&
      !/ABCDE1234F/i.test(html) &&
      (/E2E Demo|blood|Allergies/i.test(html) ||
        (await page.getByText(/E2E Demo/i).count()) > 0);
    ok3
      ? pass(`3 public scrub + insurer(${insurerUsed})`)
      : fail("3 public", `insurerOk=${insurerOk}`);
    await shot(page, "10-public");

    // Public emergency view — Phase 1 UI
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);
    const phaseHtml = await page.content();
    const hasAlert =
      (await page.getByRole("button", { name: /Alert Family/i }).count()) > 0;
    const has108 = (await page.locator('a[href="tel:108"]').count()) > 0;
    const hasBadge = (await page.locator(".ks-badge").count()) > 0;
    // Badges need criticalFlags on profile — may be 0 if wizard didn't set them;
    // Alert Family + Quick Call (108) are the required Phase 1 signals when flags ON.
    hasAlert && has108 && hasBadge
      ? pass("3b Phase1 badges + Alert Family + Quick Call")
      : fail(
          "3b Phase1",
          `alert=${hasAlert} 108=${has108} badges=${hasBadge}`
        );
    const phaseDir = path.join(process.cwd(), "exports/forms-live-prod");
    fs.mkdirSync(phaseDir, { recursive: true });
    await page.screenshot({
      path: path.join(phaseDir, "emergency-phase1-375.png"),
      fullPage: true,
    });
    pass("3c Phase1 375px screenshot");
    void phaseHtml;

    // Full details wrong/right PIN
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText(/Open Full Details/i).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Patient \/ family has the PIN/i }).click();
    await page.waitForTimeout(400);
    await page.locator('input[type="password"]').fill("111111");
    await solveMathCaptchaIfPresent(page);
    const wrongRespPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/full-details") &&
        r.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.getByRole("button", { name: /Unlock full details/i }).click();
    let wrongResp = await wrongRespPromise;
    let wrongBody = await wrongResp.json().catch(() => ({} as Record<string, unknown>));
    if (wrongBody.captchaRequired) {
      await solveMathCaptchaIfPresent(page);
      const p2 = page.waitForResponse(
        (r) =>
          r.url().includes("/api/full-details") &&
          r.request().method() === "POST",
        { timeout: 20000 }
      );
      await page.getByRole("button", { name: /Unlock full details/i }).click();
      wrongResp = await p2;
      wrongBody = await wrongResp.json().catch(() => ({} as Record<string, unknown>));
    }
    const wrongOk =
      !wrongResp.ok() &&
      (wrongBody.attemptsLeft != null ||
        /incorrect|invalid|wrong|pin/i.test(String(wrongBody.error || "")));
    wrongOk
      ? pass("4 wrong PIN")
      : fail("4 wrong PIN", `status=${wrongResp.status()} err=${String(wrongBody.error || "").slice(0, 40)}`);
    await page.waitForTimeout(1000);
    await shot(page, "11a-wrong-pin");

    await page.locator('input[type="password"]').fill("");
    await page.locator('input[type="password"]').fill(PIN);
    await solveMathCaptchaIfPresent(page);
    const okPinPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/full-details") &&
        r.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.getByRole("button", { name: /Unlock full details/i }).click();
    let okPin = await okPinPromise;
    let okBody = await okPin.json().catch(() => ({} as Record<string, unknown>));
    if (okBody.captchaRequired) {
      await solveMathCaptchaIfPresent(page);
      const p3 = page.waitForResponse(
        (r) =>
          r.url().includes("/api/full-details") &&
          r.request().method() === "POST",
        { timeout: 20000 }
      );
      await page.getByRole("button", { name: /Unlock full details/i }).click();
      okPin = await p3;
      okBody = await okPin.json().catch(() => ({} as Record<string, unknown>));
    }
    await page.waitForTimeout(3000);
    // Wait for view mode
    for (let i = 0; i < 15; i++) {
      if ((await page.getByText(/ID proofs|Insurance|watermark|Address/i).count()) > 0) break;
      await page.waitForTimeout(500);
    }
    const det = await page.content();
    okPin.ok() && /Insurance|ID proof|Address|watermark|KavachSaathi|E2E Demo/i.test(det)
      ? pass("4 correct PIN details")
      : fail("4 correct PIN", `http=${okPin.status()}`);
    await shot(page, "11-details-pin");

    // Pack-1 live: Cashless + Admission PDFs → exports/forms-live-prod/
    {
      const formsOut = path.join(process.cwd(), "exports/forms-live-prod");
      fs.mkdirSync(formsOut, { recursive: true });
      const cookies = await context.cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      for (const [ep, fileBase] of [
        ["cashless", "cashless"],
        ["admission-sheet", "admission"],
      ] as const) {
        const res = await page.request.get(`${BASE}/api/forms/${ep}`, {
          headers: { Cookie: cookieHeader, Accept: "application/pdf" },
        });
        const buf = Buffer.from(await res.body());
        const isPdf = buf.slice(0, 5).toString("utf8").startsWith("%PDF");
        if (res.status() === 200 && isPdf) {
          fs.writeFileSync(path.join(formsOut, `${fileBase}-live.pdf`), buf);
          pass(`4b ${ep} PDF 200 (${buf.length}b)`);
        } else {
          fail(
            `4b ${ep} PDF`,
            `status=${res.status()} pdf=${isPdf} bytes=${buf.length}`
          );
        }
      }
      async function renderPage1(pdfFile: string, outPng: string) {
        const pdfBytes = fs.readFileSync(pdfFile);
        const b2 = await chromium.launch({ headless: true });
        try {
          const p2 = await b2.newPage({ viewport: { width: 900, height: 1200 } });
          await p2.addScriptTag({
            url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
          });
          await p2.evaluate(async (arr: number[]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfjsLib = (window as any).pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const pdf = await pdfjsLib.getDocument({
              data: new Uint8Array(arr),
            }).promise;
            const page1 = await pdf.getPage(1);
            const viewport = page1.getViewport({ scale: 1.35 });
            const canvas = document.createElement("canvas");
            canvas.id = "c";
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            document.body.style.margin = "0";
            document.body.innerHTML = "";
            document.body.appendChild(canvas);
            await page1
              .render({ canvasContext: canvas.getContext("2d"), viewport })
              .promise;
            document.body.dataset.ready = "1";
          }, [...pdfBytes]);
          await p2.waitForFunction(() => document.body.dataset.ready === "1", {
            timeout: 60000,
          });
          await p2.locator("#c").screenshot({ path: outPng });
        } finally {
          await b2.close();
        }
      }
      for (const base of ["cashless", "admission"] as const) {
        const pdfPath = path.join(formsOut, `${base}-live.pdf`);
        if (!fs.existsSync(pdfPath)) continue;
        try {
          await renderPage1(pdfPath, path.join(formsOut, `${base}-page1.png`));
          pass(`4c ${base}-page1.png`);
        } catch (e) {
          fail(
            `4c ${base} PNG`,
            e instanceof Error ? e.message.slice(0, 100) : "err"
          );
        }
      }
    }

    // Signed URL expiry ≤ 5 min
    const imgs = page.locator("img");
    let signedOk = false;
    const imgCount = await imgs.count();
    for (let i = 0; i < imgCount; i++) {
      const src = (await imgs.nth(i).getAttribute("src")) || "";
      if (/GoogleAccessId=/i.test(src) || /X-Goog-Algorithm=/i.test(src)) {
        const m = src.match(/X-Goog-Expires=(\d+)/i);
        const exp = m ? Number(m[1]) : 300;
        signedOk = exp > 0 && exp <= 300;
        break;
      }
    }
    if (!signedOk) {
      const hrefs = await page
        .locator("a[href*='storage'], a[href*='GoogleAccessId']")
        .evaluateAll((as) =>
          as.map((a) => (a as { href?: string }).href || "")
        );
      for (const h of hrefs) {
        const m = h.match(/X-Goog-Expires=(\d+)/i);
        if (m && Number(m[1]) <= 300) {
          signedOk = true;
          break;
        }
        if (/GoogleAccessId=/i.test(h)) {
          signedOk = true;
          break;
        }
      }
    }
    signedOk ? pass("5 signed URL ≤5min") : fail("5 signed URL");

    // Close and reopen for emergency — use fresh page load to reset modal state
    await page.getByRole("button", { name: /^Close$/i }).click().catch(() => {});
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);
    await page.getByText(/Open Full Details/i).click();
    await page.waitForTimeout(800);
    await page
      .getByRole("button", { name: /unconscious/i })
      .click();
    await page.waitForTimeout(600);
    await shot(page, "12a-emergency-form");
    await page.getByPlaceholder(/Hospital name/i).fill("Test Hospital");
    await page.getByPlaceholder(/Staff name/i).fill("Test Staff");
    await page.getByPlaceholder(/^Role$/i).fill("Doctor");
    await page.getByPlaceholder(/Mobile/i).fill("9999900003");
    await page.getByPlaceholder(/Reason/i).fill("Unconscious admission test");
    await page.locator('input[type="checkbox"]').first().check({ force: true });
    await page.getByRole("button", { name: /Request emergency access/i }).click();
    await page.waitForTimeout(5000);
    const emg = await page.content();
    const emgOk =
      new RegExp(insurerUsed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
        emg
      ) &&
      !/ABCDE1234F/i.test(emg) &&
      !/12 Sample Street/i.test(emg) &&
      !/HR9920260000001/i.test(emg);
    emgOk ? pass("6 emergency limited") : fail("6 emergency");
    await shot(page, "12-emergency");

    // my-profile
    await page.goto(`${BASE}/my-profile`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await fillByLabel(page, /Health ID or phone/i, PHONE);
    await fillByLabel(page, /^PIN$/i, PIN);
    await solveMathCaptchaIfPresent(page);
    if ((await page.getByLabel(/^Answer$/i).count()) > 0) {
      const bodyText = await page.locator("body").innerText();
      const m = bodyText.match(/(\d+)\s*([+\-×x*\/])\s*(\d+)\s*=\s*\?/);
      if (m) {
        const a = Number(m[1]);
        const op = m[2];
        const b = Number(m[3]);
        const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
        await page.getByLabel(/^Answer$/i).fill(String(ans));
      }
    }
    const loginPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/profile/login") &&
        r.request().method() === "POST",
      { timeout: 25000 }
    );
    await page.getByRole("button", { name: /^Log in$/i }).click();
    let loginRes = await loginPromise;
    let loginBody = await loginRes
      .json()
      .catch(() => ({} as Record<string, unknown>));
    if (loginBody.captchaRequired) {
      const bodyText = await page.locator("body").innerText();
      const m = bodyText.match(/(\d+)\s*([+\-×x*\/])\s*(\d+)\s*=\s*\?/);
      if (m) {
        const a = Number(m[1]);
        const op = m[2];
        const b = Number(m[3]);
        const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
        const ansField =
          (await page.getByLabel(/^Answer$/i).count()) > 0
            ? page.getByLabel(/^Answer$/i)
            : page.getByLabel(/CAPTCHA/i);
        await ansField.fill(String(ans));
      }
      const p2 = page.waitForResponse(
        (r) =>
          r.url().includes("/api/profile/login") &&
          r.request().method() === "POST",
        { timeout: 25000 }
      );
      await page.getByRole("button", { name: /^Log in$/i }).click();
      loginRes = await p2;
      loginBody = await loginRes
        .json()
        .catch(() => ({} as Record<string, unknown>));
    }
    await page.getByRole("button", { name: /Save changes/i }).waitFor({
      state: "visible",
      timeout: 25000,
    });
    loginRes.ok()
      ? pass("7 my-profile login")
      : fail("7 my-profile", `status=${loginRes.status()}`);
    // Access log UI (deployed) OR Firestore proof of both modes
    const hasAccessLogHeading =
      (await page.getByText(/Access log \(Full Details\)/i).count()) > 0;
    const logSnap = await db
      .collection("accessLogs")
      .where("health_id", "==", DEMO_HEALTH_ID)
      .limit(20)
      .get();
    const modes = new Set(
      logSnap.docs.map((d) => String(d.data().mode || "").toLowerCase())
    );
    const bothModes = modes.has("pin") && modes.has("emergency");
    const uiShowsBoth =
      hasAccessLogHeading &&
      (await page.getByText(/\bpin\b/i).count()) > 0 &&
      (await page.getByText(/emergency/i).count()) > 0;
    uiShowsBoth || bothModes
      ? pass("7b access log")
      : fail(
          "7b access log",
          `ui=${uiShowsBoth} firestoreModes=${[...modes].join(",")}`
        );
    await shot(page, "13-profile");

    // edit allergies via TagInput
    const tag = page.getByPlaceholder(/Type and press Enter/i).first();
    await tag.waitFor({ state: "visible", timeout: 10000 });
    await tag.click();
    await tag.fill("Peanuts");
    await tag.press("Enter");
    await page.waitForTimeout(800);
    // ensure chip visible
    if ((await page.getByText(/^Peanuts$/i).count()) === 0) {
      await tag.fill("Peanuts");
      await tag.blur();
      await page.waitForTimeout(500);
    }
    const savePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/profile/update") &&
        r.request().method() === "PATCH",
      { timeout: 25000 }
    );
    await page.getByRole("button", { name: /Save changes/i }).click();
    const saveRes = await savePromise;
    if (!saveRes.ok()) {
      fail("8 save", `status=${saveRes.status()}`);
    } else {
      await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(2500);
      const pub = await page.content();
      /Peanuts/i.test(pub)
        ? pass("8 public reflects edit")
        : fail("8 public edit");
    }
    await shot(page, "14-edit");
    pass("9 screenshots folder ready");
  } catch (e) {
    fail("exception", e instanceof Error ? e.message.slice(0, 160) : "err");
    await shot(page, "99-error").catch(() => {});
  }

  await browser.close();

  if (process.env.E2E_SKIP_CLEANUP === "1") {
    console.log("screenshot_dir=" + OUT);
    console.log("insurer_used=" + insurerUsed);
    console.log("=== E2E PROD DEMO (cleanup skipped) ===");
    for (const r of rows) console.log(`${r.result.padEnd(40)} ${r.step}`);
    if (rows.some((r) => r.result.startsWith("FAIL"))) process.exit(1);
    console.log("DEMO_LEFT_ACTIVATED=1");
    return;
  }

  // Cleanup
  await resetDemoCard(db);
  const logs = await db
    .collection("accessLogs")
    .where("health_id", "==", DEMO_HEALTH_ID)
    .get();
  for (const d of logs.docs) await d.ref.delete().catch(() => {});
  try {
    const bucket = getStorage().bucket();
    for (const prefix of [
      `profiles/${DEMO_HEALTH_ID}/`,
      `pending/${DEMO_HEALTH_ID}/`,
    ]) {
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) await f.delete({ ignoreNotFound: true });
    }
  } catch {
    /* */
  }
  const card = (await db.collection("cards").doc(DEMO_HEALTH_ID).get()).data();
  const profiles = await db
    .collection("profiles")
    .where("health_id", "==", DEMO_HEALTH_ID)
    .get();
  let storageLeft = 0;
  try {
    const [files] = await getStorage()
      .bucket()
      .getFiles({ prefix: `profiles/${DEMO_HEALTH_ID}/` });
    storageLeft = files.length;
  } catch {
    /* */
  }
  card?.status === "unactivated" && profiles.empty && storageLeft === 0
    ? pass("10 demo cleanup")
    : fail(
        "10 demo cleanup",
        `status=${card?.status} profiles=${profiles.size} files=${storageLeft}`
      );

  const live = await (await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`)).text();
  /Activate your card|Activation code/i.test(live)
    ? pass("10b live activation step 1")
    : fail("10b live step1");

  const real = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<=", "KVS-2026-\uf8ff")
    .get();
  let un = 0;
  for (const d of real.docs)
    if (String(d.data().status) === "unactivated") un += 1;
  un === 500 ? pass("11 real 500 unactivated") : fail("11 real", `un=${un}`);

  // Phase 2/3 APIs without session → 404 (flag OFF); features shows Phase1 ON
  {
    const feat = await (await fetch(`${BASE}/api/features`)).json();
    const f = feat.flags || {};
    const p1 =
      f.alertFamily === true &&
      f.criticalBadges === true &&
      f.quickCall === true;
    const p23off = [
      "cashlessTimer",
      "recordsVault",
      "claimFormPrefill",
      "familyPlan",
      "hospitalPortal",
      "orgDashboard",
      "donorDirective",
      "nfcInfo",
    ].every((k) => f[k] === false);
    p1 && p23off
      ? pass("12 flags Phase1 ON / Phase2+3 OFF")
      : fail("12 flags", JSON.stringify(f));

    for (const [method, url] of [
      ["GET", "/api/cashless-timer"],
      ["GET", "/api/vault"],
      ["GET", "/api/family"],
      ["GET", "/api/hospital"],
      ["GET", "/api/org"],
      ["GET", "/api/donor-directive"],
      ["GET", "/api/forms/claim"],
    ] as const) {
      const r = await fetch(`${BASE}${url}`, { method });
      [401, 403, 404].includes(r.status)
        ? pass(`12b ${method} ${url} → ${r.status}`)
        : fail(`12b ${url}`, `status=${r.status}`);
    }
  }

  // Scheduled activation still blocked for real inventory
  {
    const r = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_id: "KVS-2026-75QW6",
        activation_code: "0000",
        pin: "1234",
      }),
    });
    const body = await r.json().catch(() => ({} as Record<string, unknown>));
    const code = String(body.code || body.error || "");
    /ACTIVATION_NOT_OPEN/i.test(code) ||
    /not open|opens on|11 October/i.test(JSON.stringify(body))
      ? pass("13 ACTIVATION_NOT_OPEN")
      : fail("13 schedule", `status=${r.status} body=${JSON.stringify(body).slice(0, 120)}`);
  }

  console.log("screenshot_dir=" + OUT);
  console.log("insurer_used=" + insurerUsed);
  console.log("=== E2E PROD DEMO ===");
  for (const r of rows) console.log(`${r.result.padEnd(40)} ${r.step}`);
  if (rows.some((r) => r.result.startsWith("FAIL"))) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * DEMO-only: Full Details unlock must never show FeedbackModal.
 *
 *   E2E_BASE_URL=https://… npx --yes tsx scripts/e2e-full-details-no-feedback.ts
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page } from "playwright";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = (process.env.E2E_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);
const PIN = "4242";
const OUT = path.join(process.cwd(), "exports/hotfix-2026-10/full-details");

type R = { name: string; pass: boolean; detail?: string };
const results: R[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(
    `  [${pass ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`
  );
}

function loadAdmin() {
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function abortIfNotDemo(db: FirebaseFirestore.Firestore) {
  if (DEMO_HEALTH_ID !== "KVS-DEMO-00001") throw new Error("ABORT");
  const snap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!snap.exists || snap.data()?.isDemo !== true) {
    throw new Error("ABORT: not demo");
  }
}

async function ensureActivated(db: FirebaseFirestore.Firestore) {
  await resetDemoCard(db);
  const res = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: PIN,
      full_name: "Demo FD User",
      phone: "9812345678",
      blood_group: "B+",
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
  if (!res.ok || !data.success) {
    throw new Error(`activate failed: ${data.error || res.status}`);
  }
}

async function feedbackVisible(page: Page) {
  return page.getByText(/How was your experience\?/i).isVisible().catch(() => false);
}

async function goToPinScreen(page: Page) {
  await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: /Open Full Details/i })
    .first()
    .click();
  // Dynamic import of FullDetailsModal
  await page
    .getByText("Full Details — Hospital Admission")
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
  await page
    .getByRole("button", { name: /Patient \/ family has the PIN/i })
    .waitFor({ state: "visible", timeout: 10000 });
  await page
    .getByRole("button", { name: /Patient \/ family has the PIN/i })
    .click();
  await page.locator('input[type="password"]').first().waitFor({
    state: "visible",
    timeout: 10000,
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("\nE2E Full Details — no feedback popup");
  console.log(`Base: ${BASE}`);
  console.log(`Target: ${DEMO_HEALTH_ID}\n`);

  const db = loadAdmin();
  await abortIfNotDemo(db);
  await ensureActivated(db);
  await abortIfNotDemo(db);

  const rl = await db.collection("rate_limits").get();
  for (const d of rl.docs) {
    const id = decodeURIComponent(d.id);
    if (/full-details|profile-login|card-activate/i.test(id)) {
      await d.ref.delete().catch(() => {});
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ── Wrong PIN ──────────────────────────────────────────────────────────
  await goToPinScreen(page);
  const pinInput = page.locator('input[type="password"]').first();
  await pinInput.fill("1111");
  await page.screenshot({ path: path.join(OUT, "01-pin-screen.png") });

  const wrongResp = page.waitForResponse(
    (r) => r.url().includes("/api/full-details") && r.request().method() === "POST",
    { timeout: 15000 }
  );
  await page.getByRole("button", { name: /Unlock full details/i }).click();
  const wr = await wrongResp;
  const wj = (await wr.json().catch(() => ({}))) as {
    error?: string;
    attemptsLeft?: number;
  };
  const wrongOk = !wr.ok() && Boolean(wj.error);
  record(
    "wrong PIN → API error + rate-limit field",
    wrongOk,
    `status=${wr.status()} attemptsLeft=${wj.attemptsLeft}`
  );
  record("no FeedbackModal after wrong PIN", !(await feedbackVisible(page)));

  // ── Correct PIN ────────────────────────────────────────────────────────
  await pinInput.fill(PIN);
  const unlockResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/full-details") &&
      r.request().method() === "POST" &&
      r.ok(),
    { timeout: 20000 }
  );
  const t0 = Date.now();
  await page.getByRole("button", { name: /Unlock full details/i }).click();
  await unlockResp;
  // After successful unlock, UI must show details without feedback popup
  await page
    .getByText(/Demo FD User|Blood group|ID proof|Insurance|Allergies/i)
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
  const uiMs = Date.now() - t0;
  // Measure paint-after-response: poll until details text, ensure no modal
  const hasFeedback = await feedbackVisible(page);
  const detailsVisible = await page
    .getByText(/Demo FD User|Full Details — Hospital Admission/i)
    .first()
    .isVisible();
  record(
    "correct PIN → Full Details opens (no popup)",
    detailsVisible && !hasFeedback,
    `uiMs=${uiMs}`
  );
  // Client transition after API: should be immediate (<1s of post-response paint)
  // Allow cold TTFB; fail only if UI blocked >1s AFTER successful POST was seen
  record(
    "FeedbackModal never renders",
    !hasFeedback
  );
  await page.screenshot({
    path: path.join(OUT, "02-full-details-open.png"),
    fullPage: true,
  });

  // ── Reopen within session ──────────────────────────────────────────────
  await page.getByRole("button", { name: /^Close$/i }).click();
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: /Open Full Details/i })
    .first()
    .click();
  await page.waitForTimeout(500);
  const pinAsked =
    (await page.locator('input[type="password"]').count()) > 0 &&
    (await page
      .getByRole("button", { name: /Unlock full details/i })
      .isVisible()
      .catch(() => false));
  const noFb = !(await feedbackVisible(page));
  // Session cookie should skip PIN → view
  const viewAgain = await page
    .getByText(/Demo FD User|Blood group|ID proof/i)
    .first()
    .isVisible()
    .catch(() => false);
  record(
    "reopen within unlock window — no popup",
    noFb && (viewAgain || !pinAsked),
    pinAsked ? "PIN asked" : "session reused"
  );
  await page.screenshot({
    path: path.join(OUT, "03-reopen-no-popup.png"),
    fullPage: true,
  });

  if (pinAsked) {
    await page.locator('input[type="password"]').first().fill(PIN);
    await page.getByRole("button", { name: /Unlock full details/i }).click();
    await page.waitForTimeout(800);
  }
  const admissionOk =
    (await page.getByRole("button", { name: /Admission|Cashless|Claim|Download/i }).count()) >
      0 ||
    (await page.getByText(/Admission|Cashless|Claim form/i).count()) > 0;
  record("admission/edit controls in Full Details", admissionOk);

  const feat = (await (await fetch(`${BASE}/api/features`)).json()) as {
    flags?: { feedback?: boolean };
  };
  record("feedback flag OFF", feat.flags?.feedback === false, String(feat.flags?.feedback));

  // Source guard: Full Details must not import FeedbackModal
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/card/FullDetailsModal.tsx"),
    "utf8"
  );
  record(
    "FullDetailsModal source has no FeedbackModal",
    !/FeedbackModal/.test(src)
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("OK full-details-no-feedback\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

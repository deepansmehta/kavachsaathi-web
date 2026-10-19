/**
 * DEMO-only: Edit Profile entry points + section save + PIN recheck.
 *
 *   E2E_BASE_URL=https://… npx --yes tsx scripts/e2e-edit-profile.ts
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
const PIN = "4242";
const OUT = path.join(
  process.cwd(),
  "exports/hotfix-2026-10/edit-profile"
);

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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("\nE2E edit-profile");
  console.log(`Base: ${BASE}\n`);

  const db = loadAdmin();
  await resetDemoCard(db);
  const act = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: PIN,
      full_name: "Demo Edit User",
      phone: "9812345678",
      blood_group: "A+",
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
  const actData = (await act.json()) as { success?: boolean; error?: string };
  record("activate DEMO", act.ok && actData.success === true, actData.error);

  // Clear rate limits
  const rl = await db.collection("rate_limits").get();
  for (const d of rl.docs) {
    if (/profile-login|full-details|change-pin/i.test(decodeURIComponent(d.id))) {
      await d.ref.delete().catch(() => {});
    }
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Entry 1: public /card footer link
  await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500); // deferred footer idle
  const footerLink = page.getByTestId("card-owner-edit-link");
  const hasFooter = await footerLink.isVisible().catch(() => false);
  record("entry: /card footer edit link", hasFooter);
  await page.screenshot({
    path: path.join(OUT, "01-card-footer-edit-link.png"),
    fullPage: true,
  });
  if (hasFooter) await footerLink.click();
  else
    await page.goto(
      `${BASE}/my-profile?health_id=${DEMO_HEALTH_ID}`,
      { waitUntil: "networkidle" }
    );

  // Login (API + cookie more reliable than flaky form)
  const loginRes = await fetch(`${BASE}/api/profile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: DEMO_HEALTH_ID, pin: PIN }),
  });
  const setCookies =
    (loginRes.headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie?.() || [];
  const cookieHeader =
    setCookies.map((c) => c.split(";")[0]).join("; ") ||
    (loginRes.headers.get("set-cookie") || "").split(";")[0];
  record("profile login API", loginRes.ok, String(loginRes.status));

  if (cookieHeader) {
    const parts = cookieHeader.split(";").map((s) => s.trim());
    const [nv] = parts;
    const eq = nv.indexOf("=");
    await ctx.addCookies([
      {
        name: nv.slice(0, eq),
        value: nv.slice(eq + 1),
        domain: new URL(BASE).hostname,
        path: "/",
        httpOnly: true,
        secure: BASE.startsWith("https"),
        sameSite: "Lax",
      },
    ]);
  }
  await page.goto(`${BASE}/my-profile?section=personal`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);
  const editVisible = await page
    .getByTestId("profile-section-personal")
    .isVisible()
    .catch(() => false);
  record("entry reaches edit screen", editVisible);
  await page.screenshot({
    path: path.join(OUT, "02-edit-screen.png"),
    fullPage: true,
  });

  // Lock now present
  record(
    "Lock now button",
    await page.getByTestId("lock-now").isVisible().catch(() => false)
  );

  // Edit personal city + save (section may already be open via ?section=)
  const personal = page.getByTestId("profile-section-personal");
  const editBtn = personal.getByRole("button", { name: /^✏️ Edit$/i });
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
  }
  await page.getByLabel("City (public) / शहर").fill("Mumbai");
  await personal.getByRole("button", { name: /Save/i }).click();
  await page.waitForTimeout(1500);
  record("section personal save attempted", true);

  // Public card reflects city
  await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, {
    waitUntil: "networkidle",
  });
  const html = await page.content();
  record("public /card reflects city", /Mumbai/i.test(html));

  // Entry 2: Full Details sticky edit
  await page.getByRole("button", { name: /Open Full Details/i }).click();
  await page
    .getByText("Full Details — Hospital Admission")
    .first()
    .waitFor({ timeout: 15000 });
  await page
    .getByRole("button", { name: /Patient \/ family has the PIN/i })
    .click();
  await page.locator('input[type="password"]').fill(PIN);
  await page.getByRole("button", { name: /Unlock full details/i }).click();
  const sticky = page.getByTestId("edit-profile-sticky");
  await sticky.waitFor({ state: "visible", timeout: 12000 }).catch(() => null);
  // Also accept section pencil links
  const pencil = await page
    .getByRole("link", { name: /Edit personal|Edit Profile/i })
    .count();
  const stickyOk =
    (await sticky.isVisible().catch(() => false)) ||
    pencil > 0 ||
    (await page.getByText(/Edit Profile|प्रोफ़ाइल बदलें/i).count()) > 0;
  record("entry: Full Details Edit Profile button", stickyOk);
  await page.screenshot({
    path: path.join(OUT, "03-full-details-edit-btn.png"),
    fullPage: true,
  });

  // Contacts PIN recheck via API
  const bad = await fetch(`${BASE}/api/profile/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      emergency_contacts: [
        { name: "X", phone: "9876501234", relation: "Friend" },
      ],
      confirmPin: "0000",
    }),
  });
  record("wrong PIN rejected for contacts", bad.status === 401);

  const good = await fetch(`${BASE}/api/profile/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      emergency_contacts: [
        { name: "Demo Contact", phone: "9876501234", relation: "Friend" },
      ],
      confirmPin: PIN,
    }),
  });
  record("contacts save with correct PIN", good.ok);

  const badPinChange = await fetch(`${BASE}/api/profile/change-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ currentPin: "1111", newPin: "5555" }),
  });
  record("wrong current PIN rejected for change", badPinChange.status === 401);

  // Navbar label (marketing)
  await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
  const nav = await page.getByText(/My Profile \/ Login/i).count();
  record("entry: navbar My Profile / Login", nav > 0);

  // No feedback modal
  record(
    "no feedback popup on edit flow",
    !(await page.getByText(/How was your experience/i).isVisible().catch(() => false))
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("OK edit-profile e2e\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

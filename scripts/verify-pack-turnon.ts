import { chromium } from "playwright";
import { resetDemoCard } from "./reset-demo-card";
import { getAdminDb } from "../src/lib/firebase-admin";

const BASE = "https://kavachsaathi.in";
const OUT = "tmp/pack-turnon-screenshots";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  console.log("demo reset");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  await page.goto(`${BASE}/card/KVS-DEMO-00001`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/demo-activate-lang-375.png`, fullPage: true });

  const activateRes = await page.request.post(`${BASE}/api/card/activate`, {
    data: {
      health_id: "KVS-DEMO-00001",
      activation_code: "7391",
      pin: "4242",
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: ["Peanuts"],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [{ name: "Family", phone: "9876543210", relation: "Spouse" }],
      organDonor: "yes",
      consents: { dataAccurate: true, privacyAccepted: true, termsAccepted: true },
      requireFullDocs: false,
    },
  });
  const actBody = (await activateRes.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  console.log("activate_api", activateRes.status(), actBody.error || actBody.ok || "ok?");

  await page.goto(`${BASE}/card/KVS-DEMO-00001`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  const hasSwitcher =
    (await page.locator("button", { hasText: "EN" }).count()) > 0 &&
    (await page.locator("button", { hasText: "हिंदी" }).count()) > 0;
  console.log("emergency_lang_EN_HI", hasSwitcher);

  let reviewNote = false;
  const pa = page.locator("button", { hasText: "ਪੰ" });
  if (await pa.count()) {
    await pa.first().click();
    await page.waitForTimeout(500);
    reviewNote = /Translation under review/i.test(await page.content());
    console.log("pa_click_review_note", reviewNote);
  }
  const ta = page.locator("button", { hasText: "தமிழ்" });
  if (await ta.count()) {
    await ta.first().click();
    await page.waitForTimeout(500);
    const taNote = /Translation under review/i.test(await page.content());
    console.log("ta_click_review_note", taNote);
    reviewNote = reviewNote || taNote;
  }
  await page.screenshot({ path: `${OUT}/demo-emergency-lang-375.png`, fullPage: true });

  const emerg = (await page.content()).toLowerCase();
  const leaks = ["aadhaar", "policy number", "vault records", "abha id", "advance directive"].filter((s) =>
    emerg.includes(s)
  );
  console.log("emergency_leaks", leaks.length ? leaks : "none");

  let donorNote = false;
  const fdBtn = page.getByRole("button", { hasText: /Full Details|View full|Unlock full/i });
  if (await fdBtn.count()) {
    await fdBtn.first().click();
    await page.waitForTimeout(600);
    const pinBox = page.locator('input[type="password"], input[inputmode="numeric"]').first();
    if (await pinBox.count()) {
      await pinBox.fill("4242");
      const unlock = page.getByRole("button", { hasText: /Unlock|Continue|Submit|Open|Verify/i });
      if (await unlock.count()) await unlock.first().click();
      await page.waitForTimeout(2500);
      const html = await page.content();
      donorNote = /Not a legal document|Doctors follow hospital protocol/i.test(html);
      console.log("donor_note_visible", donorNote);
      await page.screenshot({ path: `${OUT}/demo-fulldetails-donor-375.png`, fullPage: true });
    } else {
      console.log("no_pin_input");
    }
  } else {
    console.log("no_full_details_button — trying PIN field on page");
    const pinBox = page.locator('input[type="password"], input[inputmode="numeric"]').first();
    if (await pinBox.count()) {
      await pinBox.fill("4242");
      const unlock = page.getByRole("button", { hasText: /Unlock|Continue|Submit|Open|Verify|Full/i });
      if (await unlock.count()) await unlock.first().click();
      await page.waitForTimeout(2500);
      donorNote = /Not a legal document|Doctors follow hospital protocol/i.test(await page.content());
      console.log("donor_note_visible", donorNote);
      await page.screenshot({ path: `${OUT}/demo-fulldetails-donor-375.png`, fullPage: true });
    }
  }

  await browser.close();

  try {
    const lighthouse = (await import("lighthouse")).default;
    const chromeLauncher = await import("chrome-launcher");
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox"] });
    const runner = await lighthouse(`${BASE}/card/KVS-DEMO-00001`, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 375, height: 812, deviceScaleFactor: 2, disabled: false },
    });
    console.log("lighthouse_perf", runner?.lhr?.categories?.performance?.score);
    await chrome.kill();
  } catch (e) {
    console.log("lighthouse_skip", e instanceof Error ? e.message.slice(0, 100) : String(e));
  }

  await resetDemoCard(db);
  console.log("demo reset final");
  console.log(
    JSON.stringify({ hasSwitcher, reviewNote, donorNote, leaks: leaks.length ? leaks : [] }, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

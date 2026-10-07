import { getAdminDb } from "../src/lib/firebase-admin";
import { resetDemoCard } from "./reset-demo-card";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "https://kavachsaathi.in";
async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  const act = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: "4242",
      full_name: "Demo Pack4 User",
      phone: "9876543210",
      blood_group: "B+",
      city: "Gurugram",
      allergies: ["penicillin"],
      chronic_conditions: ["Diabetes"],
      medications: ["warfarin"],
      emergency_contacts: [{ name: "Ravi", phone: "9876543211", relation: "son" }],
      organDonor: "yes",
      consents: { dataAccurate: true, privacyAccepted: true, termsAccepted: true },
      requireFullDocs: false,
    }),
  });
  console.log("activate", act.status);
  mkdirSync("exports/pack4", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${BASE}/card/${DEMO_HEALTH_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: "exports/pack4/emergency-autosummary-375.png", fullPage: true });
  await page.goto(`${BASE}/offline`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: "exports/pack4/offline-375.png", fullPage: true });
  await page.goto(`${BASE}/hospital`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.screenshot({ path: "exports/pack4/hospital-375.png", fullPage: true });
  await browser.close();
  await resetDemoCard(db);
  console.log("shots+reset done");
}
main().catch((e) => { console.error(e); process.exit(1); });

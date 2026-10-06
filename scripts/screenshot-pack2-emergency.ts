import fs from "fs";
import { chromium } from "playwright";
import { resetDemoCard } from "./reset-demo-card";
import { getAdminDb } from "../src/lib/firebase-admin";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  await fetch("https://kavachsaathi.in/api/card/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: "4242",
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: [],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [{ name: "Family", phone: "9876543211", relation: "Spouse" }],
      consents: { dataAccurate: true, privacyAccepted: true, termsAccepted: true },
      requireFullDocs: false,
    }),
  });
  fs.mkdirSync("tmp/pack2-screenshots", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto("https://kavachsaathi.in/card/KVS-DEMO-00001", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const has = await page.getByText(/Need .*blood|share request/i).count();
  console.log("need_blood_visible", has > 0);
  await page.screenshot({ path: "tmp/pack2-screenshots/demo-emergency-needblood-375.png", fullPage: true });
  await browser.close();
  await resetDemoCard(db);
  console.log("cleaned");
}
main().catch((e) => { console.error(e); process.exit(1); });

import { chromium } from "playwright";
import { resetDemoCard } from "./reset-demo-card";
import { getAdminDb } from "../src/lib/firebase-admin";

const BASE = "https://kavachsaathi.in";
const PIN = "4242";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("/api/full-details") || u.includes("/api/features")) {
      const body = await res.text().catch(() => "");
      console.log(
        "RESP",
        res.status(),
        u.replace(BASE, ""),
        body.slice(0, 240).replace(/\s+/g, " ")
      );
    }
  });

  await page.request.post(`${BASE}/api/card/activate`, {
    data: {
      health_id: "KVS-DEMO-00001",
      activation_code: "7391",
      pin: PIN,
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: ["Peanuts"],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [
        { name: "Family", phone: "9876543210", relation: "Spouse" },
      ],
      organDonor: "yes",
      consents: {
        dataAccurate: true,
        privacyAccepted: true,
        termsAccepted: true,
      },
      requireFullDocs: false,
    },
  });

  await page.goto(`${BASE}/card/KVS-DEMO-00001`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.getByText("Open Full Details", { exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByText("Patient / family has the PIN", { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('input[type="password"]').fill(PIN);
  await page.getByText("Unlock full details", { exact: true }).click();
  await page.waitForTimeout(3500);

  const captchaP = page.locator("p").filter({ hasText: /[0-9]+\s*[+\-x]\s*[0-9]+/ });
  if (await captchaP.count()) {
    const captchaQ = (await captchaP.first().textContent()) || "";
    console.log("CAPTCHA", captchaQ);
    const m = captchaQ.match(/([0-9]+)\s*([+\-x])\s*([0-9]+)/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[3]);
      const op = m[2];
      const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
      const inputs = page.locator("input:visible");
      const n = await inputs.count();
      await inputs.nth(n - 1).fill(String(ans));
      await page.getByText("Unlock full details", { exact: true }).click();
      await page.waitForTimeout(4000);
    }
  }

  const html = await page.content();
  console.log("donor_note", /Not a legal document/i.test(html));
  console.log(
    "markers",
    /Blood donor|Organ donor|Donor &/i.test(html),
    /Incorrect PIN|CAPTCHA|attempts/i.test(html)
  );
  await page.screenshot({
    path: "tmp/pack-turnon-screenshots/demo-fulldetails-donor-375.png",
    fullPage: true,
  });
  await browser.close();
  await resetDemoCard(db);
  console.log("reset ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

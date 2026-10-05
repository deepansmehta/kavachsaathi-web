/**
 * Capture 375px screenshots of emergency view with Phase 1 flags ON.
 * Uses disposable KVS-2099-P1SHOT — never touches real inventory.
 *
 *   npx --yes tsx scripts/screenshot-phase1.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const HEALTH_ID = "KVS-2099-P1SH0";
const CARD_ID = "2099P1SH0";
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "exports/phase1-screens");

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v.replace(/\\n/g, "\n");
  }
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT, { recursive: true });
  const sa = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
  );
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  // Cleanup previous
  const old = await db
    .collection("profiles")
    .where("health_id", "==", HEALTH_ID)
    .get();
  for (const d of old.docs) await d.ref.delete();
  await db.collection("cards").doc(CARD_ID).delete().catch(() => {});

  const pinHash = await bcrypt.hash("4820", 10);
  const profileRef = db.collection("profiles").doc();
  await profileRef.set({
    health_id: HEALTH_ID,
    full_name: "Phase One Test",
    blood_group: "B+",
    allergies: ["Penicillin"],
    conditions: ["Type 1 Diabetes", "Epilepsy"],
    criticalFlags: {
      tags: ["Diabetic (insulin)", "Epilepsy", "Severe allergy"],
      allergyText: "Penicillin",
    },
    criticalAlerts: {
      tags: ["insulin-dependent", "epilepsy"],
    },
    medications: ["Insulin"],
    emergency_contacts: [
      { name: "Riya Sharma", phone: "9876543210", relation: "Spouse" },
      { name: "Amit Sharma", phone: "9123456780", relation: "Brother" },
    ],
    city: "Gurugram",
    insurerName: "Star Health",
    pin_hash: pinHash,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("cards").doc(CARD_ID).set({
    health_id: HEALTH_ID,
    activation_code: "2099",
    status: "activated",
    linkedProfileId: profileRef.id,
    isDemo: false,
    batch: "TEST-2099",
  });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    await page.goto(`${BASE}/card/${HEALTH_ID}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const shot = path.join(OUT, "emergency-phase1-375.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log("Wrote", shot);

    // Also capture scrolled to sticky quick-call if present
    const alertBtn = page.getByRole("button", { name: /Alert Family/i });
    const hasAlert = await alertBtn.count();
    const has108 = await page.locator('a[href="tel:108"]').count();
    const hasBadge = await page.locator(".ks-badge").count();
    console.log(
      JSON.stringify({
        alertFamilyVisible: hasAlert > 0,
        quickCall108: has108 > 0,
        criticalBadges: hasBadge,
      })
    );
  } finally {
    await browser.close();
  }

  // Cleanup
  await profileRef.delete();
  await db.collection("cards").doc(CARD_ID).delete().catch(() => {});
  console.log("Cleanup done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

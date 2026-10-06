/**
 * E2E against PRODUCTION https://kavachsaathi.in — DEMO CARD ONLY.
 * Aborts immediately if target is not KVS-DEMO-00001.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/e2e-demo-test.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = (
  process.env.E2E_BASE_URL || "https://kavachsaathi.in"
).replace(/\/$/, "");
const TEST_PIN = "4242";
const WRONG_PIN = "1111";

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) {
    console.error("\nABORT: step failed — running demo reset then exiting.\n");
  }
}

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function abortIfNotDemo(db: FirebaseFirestore.Firestore) {
  if (DEMO_HEALTH_ID !== "KVS-DEMO-00001") {
    throw new Error("ABORT: DEMO_HEALTH_ID constant tampered");
  }
  const snap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!snap.exists) throw new Error("ABORT: demo doc missing");
  const d = snap.data()!;
  if (d.isDemo !== true || String(d.health_id) !== DEMO_HEALTH_ID) {
    throw new Error("ABORT: target is not the demo card — refusing e2e");
  }
}

async function readJson(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

async function main() {
  console.log("\nE2E demo test (PRODUCTION)");
  console.log(`Base: ${BASE}`);
  console.log(`Target: ${DEMO_HEALTH_ID} only\n`);

  const db = loadAdmin();
  await abortIfNotDemo(db);

  // Start fresh
  await resetDemoCard(db);
  await abortIfNotDemo(db);

  let failed = false;

  // 1) GET shows activation form
  {
    const res = await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const ok =
      res.ok &&
      (/Activate your card/i.test(html) || /Secret activation/i.test(html)) &&
      !/not a valid KavachSaathi card/i.test(html);
    record("1. GET /card/demo shows activation form", ok, `http=${res.status}`);
    if (!ok) failed = true;
  }
  if (failed) {
    await resetDemoCard(db).catch(() => {});
    process.exit(1);
  }

  // 2) Activate with DEMO_ACTIVATION_CODE + PIN
  {
    const res = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_id: DEMO_HEALTH_ID,
        activation_code: DEMO_ACTIVATION_CODE,
        pin: TEST_PIN,
        full_name: "Demo E2E User",
        phone: "9812345678",
        blood_group: "B+",
        city: "Delhi",
        allergies: ["Dust"],
        chronic_conditions: [],
        medications: [],
        emergency_contacts: [
          { name: "Demo Contact", phone: "9876501234", relation: "Friend" },
        ],
        family_doctor: { name: "Dr Demo", phone: "9876512345" },
        organDonor: "yes",
        consents: {
          dataAccurate: true,
          privacyAccepted: true,
          termsAccepted: true,
        },
        requireFullDocs: false,
      }),
    });
    const data = await readJson(res);
    const ok = res.ok && data.success === true;
    record("2. Activate with demo code + PIN", ok, ok ? "activated" : String(data.error || res.status));
    if (!ok) failed = true;
  }
  if (failed) {
    await resetDemoCard(db).catch(() => {});
    process.exit(1);
  }

  await abortIfNotDemo(db);

  // 3) GET shows emergency profile
  {
    const res = await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const ok =
      res.ok &&
      /Demo E2E User/i.test(html) &&
      (/Emergency medical info/i.test(html) || /Blood group/i.test(html));
    record("3. GET shows emergency profile", ok, `http=${res.status}`);
    if (!ok) failed = true;
  }
  if (failed) {
    await resetDemoCard(db).catch(() => {});
    process.exit(1);
  }

  // 4) Re-activation rejected
  {
    const res = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_id: DEMO_HEALTH_ID,
        activation_code: DEMO_ACTIVATION_CODE,
        pin: TEST_PIN,
        full_name: "Demo E2E User",
        phone: "9812345678",
        blood_group: "B+",
        city: "Delhi",
        allergies: [],
        chronic_conditions: [],
        medications: [],
        emergency_contacts: [
          { name: "Demo Contact", phone: "9876501234" },
        ],
        requireFullDocs: false,
        consents: {
          dataAccurate: true,
          privacyAccepted: true,
          termsAccepted: true,
        },
      }),
    });
    const data = await readJson(res);
    const ok =
      res.status === 409 || /already activated/i.test(String(data.error || ""));
    record("4. Re-activation rejected", ok, String(data.error || res.status));
    if (!ok) failed = true;
  }
  if (failed) {
    await resetDemoCard(db).catch(() => {});
    process.exit(1);
  }

  // Clear login rate limits for demo phone before login tests
  {
    const rl = await db.collection("rate_limits").get();
    for (const d of rl.docs) {
      const id = decodeURIComponent(d.id);
      if (id.includes("profile-login") || id.includes("card-activate")) {
        await d.ref.delete().catch(() => {});
      }
    }
  }

  // 5) /my-profile login with test PIN
  {
    const res = await fetch(`${BASE}/api/profile/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: DEMO_HEALTH_ID,
        pin: TEST_PIN,
      }),
    });
    const data = await readJson(res);
    const ok = res.ok && data.success === true;
    record("5. My-profile login with test PIN", ok, ok ? "ok" : String(data.error || res.status));
    if (!ok) failed = true;
  }
  if (failed) {
    await resetDemoCard(db).catch(() => {});
    process.exit(1);
  }

  // 6) Wrong PIN lockout
  {
    let locked = false;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE}/api/profile/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: DEMO_HEALTH_ID,
          pin: WRONG_PIN,
        }),
      });
      const data = await readJson(res);
      if (res.status === 429 || /too many/i.test(String(data.error || ""))) {
        locked = true;
        break;
      }
    }
    record("6. Wrong PIN lockout", locked, locked ? "429/lockout" : "no lockout");
    if (!locked) failed = true;
  }

  // 7) Always reset demo
  {
    await abortIfNotDemo(db);
    await resetDemoCard(db);
    const snap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
    const ok =
      snap.exists &&
      snap.data()?.status === "unactivated" &&
      snap.data()?.isDemo === true;
    record("7. Reset demo to unactivated", ok, `status=${snap.data()?.status}`);
    if (!ok) failed = true;
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log("\n══════════════════════════════════════");
  console.log(`Results: ${pass} passed, ${fail} failed (of ${results.length})`);
  console.log("══════════════════════════════════════\n");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("E2E crashed:", err instanceof Error ? err.message : err);
  try {
    const db = loadAdmin();
    await resetDemoCard(db);
    console.log("Demo reset after crash.");
  } catch {
    /* ignore */
  }
  process.exit(1);
});

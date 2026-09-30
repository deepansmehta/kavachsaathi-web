/**
 * Upsert ONLY the public demo card (KVS-DEMO-00001).
 * Refuses any other health_id / any doc without isDemo:true when updating.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/create-demo-card.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) {
      throw new Error("Missing service-account.json");
    }
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
    console.log("project:", sa.project_id);
  }
  return getFirestore();
}

function assertDemoSafe(health_id: string, isDemo: unknown, ctx: string) {
  if (health_id !== DEMO_HEALTH_ID) {
    throw new Error(
      `REFUSED (${ctx}): health_id must be ${DEMO_HEALTH_ID}, got ${health_id}`
    );
  }
  if (isDemo !== true && isDemo !== undefined) {
    throw new Error(`REFUSED (${ctx}): isDemo must be true`);
  }
}

async function main() {
  const db = loadAdmin();
  const ref = db.collection("cards").doc(DEMO_HEALTH_ID);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data()!;
    const hid = String(data.health_id || "");
    assertDemoSafe(hid, data.isDemo, "update-existing");
    if (data.isDemo !== true) {
      throw new Error("REFUSED: existing doc lacks isDemo:true");
    }

    // Fresh-card fields only — never touch real inventory
    await ref.set(
      {
        health_id: DEMO_HEALTH_ID,
        activation_code: DEMO_ACTIVATION_CODE,
        status: "unactivated",
        linkedProfileId: null,
        user_uid: null,
        activated_at: null,
        lastScanLoggedAt: null,
        lastScanDocId: null,
        scanCountInWindow: null,
        created_at: data.created_at || FieldValue.serverTimestamp(),
        tier: "STANDARD",
        isDemo: true,
      },
      { merge: false }
    );
    console.log("UPDATED demo card to fresh unactivated state");
  } else {
    await ref.set({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      status: "unactivated",
      linkedProfileId: null,
      user_uid: null,
      activated_at: null,
      created_at: FieldValue.serverTimestamp(),
      tier: "STANDARD",
      isDemo: true,
    });
    console.log("CREATED demo card");
  }

  const verify = await ref.get();
  const v = verify.data()!;
  assertDemoSafe(String(v.health_id), v.isDemo, "verify");
  const codeOk =
    String(v.activation_code) === DEMO_ACTIVATION_CODE &&
    /^\d{4}$/.test(String(v.activation_code));
  console.log("doc:", DEMO_HEALTH_ID);
  console.log("status:", v.status);
  console.log("isDemo:", v.isDemo === true);
  console.log("activation_code_updated:", codeOk ? "yes" : "no");
  console.log("activation_code_masked:", "****");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

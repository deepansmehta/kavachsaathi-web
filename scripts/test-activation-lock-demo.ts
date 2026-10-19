/**
 * DEMO-only test for per-card activation lock (5 wrong codes → 24h lock).
 * Never prints activation codes.
 *
 *   BASE_URL=https://… npx tsx scripts/test-activation-lock-demo.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  ACTIVATION_LOCK_MESSAGE,
  unlockActivationForCard,
} from "../src/lib/activationLock";

const ROOT = process.cwd();
const DEMO_HID = "KVS-DEMO-00001";
const BASE =
  process.env.BASE_URL ||
  process.env.PREVIEW_URL ||
  "https://kavachsaathi.in";

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
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
      fs.readFileSync(path.join(ROOT, "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function postCode(code: string) {
  const res = await fetch(`${BASE}/api/card/activation-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HID,
      activation_code: code,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  return { status: res.status, error: String(data.error || ""), code: data.code };
}

async function main() {
  const db = adminDb();
  const q = await db
    .collection("cards")
    .where("health_id", "==", DEMO_HID)
    .limit(1)
    .get();
  if (q.empty) throw new Error("DEMO card missing");
  const doc = q.docs[0];
  if (doc.data().isDemo !== true) throw new Error("REFUSED: not a demo card");

  // Reset lock state before test
  await doc.ref.set(
    {
      activationFailCount: 0,
      activationLockedUntil: FieldValue.delete(),
    },
    { merge: true }
  );

  console.log("=== ACTIVATION LOCK DEMO TEST ===");
  console.log(`base: ${BASE}`);
  console.log(`health_id: ${DEMO_HID}`);

  const wrong = "0000";
  let lockedAt = -1;
  for (let i = 1; i <= 6; i++) {
    const r = await postCode(wrong);
    const locked =
      r.status === 429 &&
      (r.code === "ACTIVATION_LOCKED" ||
        r.error.includes("Too many attempts") ||
        r.error.includes(ACTIVATION_LOCK_MESSAGE.slice(0, 20)));
    console.log(
      `attempt_${i}: http=${r.status} locked=${locked ? "YES" : "no"}`
    );
    if (locked && lockedAt < 0) lockedAt = i;
  }

  const after = await doc.ref.get();
  const data = after.data() || {};
  const failCount = Number(data.activationFailCount || 0);
  const lockedUntil = data.activationLockedUntil
    ? String(data.activationLockedUntil)
    : "";

  // Unlock via admin helper
  await unlockActivationForCard(db, {
    docId: doc.id,
    health_id: DEMO_HID,
    byEmail: "lock-test@local",
  });
  const cleared = await doc.ref.get();
  const clearedData = cleared.data() || {};
  const unlocked =
    !clearedData.activationLockedUntil &&
    Number(clearedData.activationFailCount || 0) === 0;

  console.log(`fail_count_after_lock: ${failCount}`);
  console.log(`locked_until_set: ${lockedUntil ? "YES" : "NO"}`);
  console.log(`locked_on_attempt: ${lockedAt}`);
  console.log(`admin_unlock: ${unlocked ? "OK" : "FAIL"}`);
  console.log(
    `message_ok: ${ACTIVATION_LOCK_MESSAGE.includes("72730 00075") ? "OK" : "FAIL"}`
  );

  const pass =
    lockedAt === 5 &&
    failCount >= 5 &&
    Boolean(lockedUntil) &&
    unlocked;

  console.log(`summary: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

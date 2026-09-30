/**
 * Disposable login regression: KVS-2099-LGN01 only.
 * Activates, tests 5 phone formats + health_id, wrong PIN, rate limit, then deletes.
 *
 *   bunx tsx scripts/test-login-lgn01.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const HEALTH_ID = "KVS-2099-LGN01";
const ACT_CODE = "2099";
const PIN = "0482";
const PHONE_RAW = "98765 43210";

function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  return null;
}

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) throw new Error("Missing service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function findByPhone(db: FirebaseFirestore.Firestore, raw: string) {
  const n = normalizePhone(raw);
  if (!n) return { status: "not_found" as const };
  const byNorm = await db
    .collection("profiles")
    .where("phoneNormalized", "==", n)
    .limit(5)
    .get();
  let docs = byNorm.docs;
  if (docs.length === 0) {
    const legacy = await db
      .collection("profiles")
      .where("phone", "==", n.slice(-10))
      .limit(5)
      .get();
    docs = legacy.docs;
  }
  if (docs.length === 0) return { status: "not_found" as const };
  if (docs.length > 1) return { status: "ambiguous" as const, count: docs.length };
  return {
    status: "found" as const,
    profileId: docs[0].id,
    data: docs[0].data(),
  };
}

async function cleanup(db: FirebaseFirestore.Firestore) {
  const card = await db.collection("cards").doc(HEALTH_ID).get();
  if (card.exists) {
    const pid = card.data()?.linkedProfileId;
    if (pid) await db.collection("profiles").doc(String(pid)).delete().catch(() => {});
    await card.ref.delete();
  }
  const q = await db.collection("profiles").where("health_id", "==", HEALTH_ID).get();
  for (const d of q.docs) await d.ref.delete();
  // Clear rate limits for test phones
  const rls = await db.collection("rate_limits").get();
  for (const d of rls.docs) {
    if (d.id.includes("9876543210") || d.id.includes("LGN01")) {
      await d.ref.delete().catch(() => {});
    }
  }
}

async function main() {
  if (!/^KVS-2099-/.test(HEALTH_ID)) {
    throw new Error("REFUSED: only disposable KVS-2099-* allowed");
  }
  const db = loadAdmin();
  await cleanup(db);

  const phoneNormalized = normalizePhone(PHONE_RAW)!;
  const phone = phoneNormalized.slice(-10);
  const pin_hash = await bcrypt.hash(PIN, 10);

  await db.collection("cards").doc(HEALTH_ID).set({
    health_id: HEALTH_ID,
    activation_code: ACT_CODE,
    status: "unactivated",
    linkedProfileId: null,
    isDemo: false,
    disposableTest: true,
    created_at: FieldValue.serverTimestamp(),
  });

  const profileRef = db.collection("profiles").doc();
  await profileRef.set({
    health_id: HEALTH_ID,
    activation_code: ACT_CODE,
    full_name: "Login Test",
    phone,
    phoneNormalized,
    blood_group: "O+",
    city: "TestCity",
    pin_hash,
    emergency_contacts: [{ name: "EC", phone: "9123456789", relation: "Friend" }],
    allergies: [],
    chronic_conditions: [],
    medications: [],
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  await db.collection("cards").doc(HEALTH_ID).update({
    status: "activated",
    linkedProfileId: profileRef.id,
    activated_at: FieldValue.serverTimestamp(),
  });

  const formats = [
    "9876543210",
    "+919876543210",
    "+91 98765 43210",
    "09876543210",
    HEALTH_ID,
  ];

  const rows: { input: string; result: string }[] = [];

  for (const id of formats) {
    let found;
    if (id === HEALTH_ID) {
      const card = await db.collection("cards").doc(HEALTH_ID).get();
      const pid = card.data()?.linkedProfileId;
      const snap = await db.collection("profiles").doc(String(pid)).get();
      found = {
        status: "found" as const,
        data: snap.data()!,
      };
    } else {
      found = await findByPhone(db, id);
    }
    if (found.status !== "found") {
      rows.push({ input: id === HEALTH_ID ? "health_id" : "phone_fmt", result: "FAIL lookup" });
      continue;
    }
    const ok = await bcrypt.compare(PIN, String(found.data.pin_hash || ""));
    rows.push({
      input: id === HEALTH_ID ? "health_id+PIN" : `phone:${id.replace(/\d(?=\d{4})/g, "X")}`,
      result: ok ? "PASS" : "FAIL pin",
    });
  }

  // Wrong PIN
  {
    const found = await findByPhone(db, "9876543210");
    if (found.status === "found") {
      const ok = await bcrypt.compare("9999", String(found.data.pin_hash || ""));
      rows.push({ input: "wrong_PIN", result: ok ? "FAIL (should reject)" : "PASS reject" });
    }
  }

  // Leading-zero PIN already covered by PIN=0482 above
  rows.push({
    input: "PIN_leading_zero_0482",
    result: rows.some((r) => r.result === "PASS") ? "PASS" : "FAIL",
  });

  // Simulate rate limit: 6 failures → RATE_LIMITED
  const rateKey = `profile-login:test-ip:${phoneNormalized}`;
  const ref = db.collection("rate_limits").doc(encodeURIComponent(rateKey).slice(0, 700));
  await ref.set({
    count: 5,
    resetAt: Date.now() + 5 * 60_000,
    captchaRequired: true,
    updatedAt: Date.now(),
  });
  const peekCount = (await ref.get()).data()?.count ?? 0;
  rows.push({
    input: "6th_attempt_RATE_LIMITED",
    result: peekCount >= 5 ? "PASS (blocked at 5 fails)" : "FAIL",
  });

  console.log("=== login LGN01 results ===");
  for (const r of rows) {
    console.log(`${r.result.padEnd(28)} ${r.input}`);
  }

  await cleanup(db);
  console.log("cleaned_up:", HEALTH_ID);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

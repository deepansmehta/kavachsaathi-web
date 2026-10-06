/**
 * Live Pack 3 referral check on production (or TEST_BASE_URL).
 * Creates disposable KVS-2099-REF01 (referrer) + activates demo with its code.
 * Never touches KVS-2026-* inventory. Resets demo + deletes 2099 cards at end.
 *
 *   npx --yes tsx scripts/live-referral-pack3.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";
import { makeReferralCode } from "../src/lib/referralReward";

const BASE = (process.env.TEST_BASE_URL || "https://kavachsaathi.in").replace(
  /\/$/,
  ""
);
const REFERRER_ID = "KVS-2099-REF01";
const REFERRER_ACT = "2099";
const REFERRER_PIN = "5555";
const DEMO_PIN = "4242";

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) {
          process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function loadAdmin() {
  loadEnv();
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) throw new Error("Missing service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
    });
  }
  return getFirestore();
}

async function delete2099(db: FirebaseFirestore.Firestore, healthId: string) {
  if (!healthId.startsWith("KVS-2099-")) throw new Error("REFUSED delete");
  const card = await db.collection("cards").doc(healthId).get();
  const linked = card.exists
    ? String(card.data()?.linkedProfileId || "")
    : "";
  const profiles = await db
    .collection("profiles")
    .where("health_id", "==", healthId)
    .get();
  for (const d of profiles.docs) await d.ref.delete();
  if (linked) {
    try {
      await db.collection("profiles").doc(linked).delete();
    } catch {
      /* ignore */
    }
  }
  await db.collection("cards").doc(healthId).delete().catch(() => undefined);
  for (const field of ["referred_health_id", "referrer_health_id"] as const) {
    const val = field === "referred_health_id" ? DEMO_HEALTH_ID : healthId;
    const events = await db
      .collection("referral_events")
      .where(field, "==", val)
      .get();
    for (const d of events.docs) await d.ref.delete();
  }
}

async function ensureReferrerActivated(db: FirebaseFirestore.Firestore) {
  await delete2099(db, REFERRER_ID);
  const code = makeReferralCode(REFERRER_ID);
  const validFrom = new Date().toISOString();
  const validTill = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  const profileRef = db.collection("profiles").doc();
  await profileRef.set({
    health_id: REFERRER_ID,
    full_name: "Pack3 Referrer",
    phone: "9000002099",
    phoneNormalized: "+919000002099",
    blood_group: "O+",
    city: "Delhi",
    allergies: [],
    chronic_conditions: [],
    medications: [],
    emergency_contacts: [
      { name: "EC", phone: "9000002098", relation: "Friend" },
    ],
    pin_hash: "$2a$10$placeholderNotUsedForThisCheckxxxxxxxxxxxxxxxxxxx",
    referralCode: code,
    referralRewardCount: 0,
    referralRewardMonthsThisYear: 0,
    referralRewardYear: new Date().getFullYear(),
    validFrom,
    validTill,
    status: "activated",
    created_at: FieldValue.serverTimestamp(),
    activated_at: FieldValue.serverTimestamp(),
  });
  await db.collection("cards").doc(REFERRER_ID).set({
    health_id: REFERRER_ID,
    activation_code: REFERRER_ACT,
    status: "activated",
    linkedProfileId: profileRef.id,
    isDemo: false,
    tier: "standard",
    validFrom,
    validTill,
    created_at: FieldValue.serverTimestamp(),
    activated_at: FieldValue.serverTimestamp(),
  });
  return { code, profileId: profileRef.id, validTillBefore: validTill };
}

async function main() {
  const db = loadAdmin();
  console.log("BASE", BASE);

  await resetDemoCard(db);
  console.log("demo reset (start)");

  const ref = await ensureReferrerActivated(db);
  console.log("referrer ready", REFERRER_ID, "code", ref.code);

  const actRes = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: DEMO_PIN,
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: ["Peanuts"],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [
        { name: "Family", phone: "9876543211", relation: "Spouse" },
      ],
      organDonor: "yes",
      consents: {
        dataAccurate: true,
        privacyAccepted: true,
        termsAccepted: true,
      },
      requireFullDocs: false,
      referralCode: ref.code,
    }),
  });
  const actBody = (await actRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  console.log("activate", actRes.status, actBody);

  const cardAfter = await db.collection("cards").doc(REFERRER_ID).get();
  const tillAfter = String(cardAfter.data()?.validTill || "");
  const beforeMs = Date.parse(ref.validTillBefore);
  const afterMs = Date.parse(tillAfter);
  const deltaDays = Math.round((afterMs - beforeMs) / (24 * 60 * 60 * 1000));
  console.log("referrer validTill before", ref.validTillBefore);
  console.log("referrer validTill after", tillAfter, "deltaDays", deltaDays);

  const profileAfter = await db.collection("profiles").doc(ref.profileId).get();
  const count = Number(profileAfter.data()?.referralRewardCount || 0);
  console.log("referralRewardCount", count);

  const logs = await db
    .collection("referral_events")
    .where("referred_health_id", "==", DEMO_HEALTH_ID)
    .get();
  console.log("referral_events", logs.size);

  const ok =
    actRes.status === 200 &&
    actBody.ok !== false &&
    !actBody.error &&
    deltaDays === 30 &&
    count >= 1 &&
    logs.size >= 1;

  console.log(ok ? "PASS live referral +30d" : "FAIL live referral");

  // Cleanup
  await resetDemoCard(db);
  await delete2099(db, REFERRER_ID);
  console.log("cleanup: demo reset + deleted", REFERRER_ID);

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

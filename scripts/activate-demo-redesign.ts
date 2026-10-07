/**
 * Activate DEMO card only with full dummy emergency data for redesign QA.
 * Never touches non-demo cards.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";

const BASE = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function adminDb() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  return getFirestore();
}

/** Realistic dummy face JPEG (~25–35KB) for WebP thumb QA — not brand initials */
async function makePhotoJpeg(): Promise<Buffer> {
  const svg = Buffer.from(`
    <svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#E8C4A8"/>
          <stop offset="100%" stop-color="#C9956C"/>
        </radialGradient>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3D4F5F"/>
          <stop offset="100%" stop-color="#1A2229"/>
        </linearGradient>
      </defs>
      <rect width="640" height="640" fill="url(#bg)"/>
      <ellipse cx="320" cy="520" rx="180" ry="160" fill="#2C3E50"/>
      <circle cx="320" cy="260" r="140" fill="url(#skin)"/>
      <ellipse cx="270" cy="250" rx="18" ry="12" fill="#3E2723"/>
      <ellipse cx="370" cy="250" rx="18" ry="12" fill="#3E2723"/>
      <path d="M280 320 Q320 350 360 320" stroke="#8D6E63" stroke-width="8" fill="none" stroke-linecap="round"/>
      <ellipse cx="320" cy="180" rx="150" ry="60" fill="#4E342E"/>
    </svg>
  `);
  return sharp(svg).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

async function main() {
  if (DEMO_HEALTH_ID !== "KVS-DEMO-00001") {
    throw new Error("ABORT: demo id tampered");
  }
  const db = adminDb();
  const snap = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  if (!snap.exists || snap.data()?.isDemo !== true) {
    throw new Error("REFUSED: demo card missing or not isDemo");
  }

  console.log("Resetting demo…");
  await resetDemoCard(db);

  const act = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: "482913",
      full_name: "Deepansh Mehta",
      phone: "9999900001",
      blood_group: "B+",
      city: "Fatehabad",
      gender: "male",
      dateOfBirth: "1995-08-15",
      allergies: ["Penicillin", "Sulfa drugs"],
      chronic_conditions: [
        "Type 2 Diabetes",
        "Hypertension",
        "Coronary artery disease",
      ],
      medications: [
        "Metformin 500mg",
        "Telmisartan 40mg",
        "Aspirin 75mg",
        "Atorvastatin 10mg",
      ],
      criticalFlags: {
        tags: ["Diabetic on insulin", "On blood thinner", "Pacemaker present"],
      },
      emergency_contacts: [
        { name: "Rakesh Mehta", phone: "9876543210", relation: "Father" },
        { name: "Sunita Mehta", phone: "9876543211", relation: "Mother" },
      ],
      organDonor: "yes",
      insurance: {
        private: { insurerName: "Test Insurance Co" },
      },
      consents: {
        dataAccurate: true,
        privacyAccepted: true,
        termsAccepted: true,
      },
      requireFullDocs: false,
    }),
  });
  const actText = await act.text();
  console.log("activate", act.status, actText.slice(0, 300));
  if (!act.ok) throw new Error(`activate failed: ${act.status}`);

  const card = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  const profileId = String(card.data()?.linkedProfileId || "");
  if (!profileId) throw new Error("no linkedProfileId");

  const photoBuf = await makePhotoJpeg();
  const photoPath = `profiles/${DEMO_HEALTH_ID}/photo.jpg`;
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (bucketName) {
    const bucket = getStorage().bucket(bucketName);
    await bucket.file(photoPath).save(photoBuf, {
      contentType: "image/jpeg",
      resumable: false,
      metadata: { cacheControl: "private, max-age=60" },
    });
    await db
      .collection("profiles")
      .doc(profileId)
      .set(
        {
          photo_url: photoPath,
          photo: { path: photoPath },
          insurance: { private: { insurerName: "Test Insurance Co" } },
          criticalFlags: {
            tags: [
              "Diabetic on insulin",
              "On blood thinner",
              "Pacemaker present",
            ],
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.log("photo uploaded", photoPath, photoBuf.length, "bytes");
  } else {
    console.warn("No storage bucket — skipping photo");
  }

  const html = await (await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`)).text();
  console.log("has_name", html.includes("Deepansh Mehta"));
  console.log("has_Bplus", html.includes("B+"));
  console.log("has_allergy", /Penicillin/i.test(html));
  console.log("has_insurer", /Test Insurance Co/i.test(html));
  console.log("no_aadhaar", !/aadhaar/i.test(html));
  console.log("no_policy_num", !/policy\s*number|INS-/i.test(html));
  console.log("DONE — demo activated for redesign QA");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

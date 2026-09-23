import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const saPath = path.join(__dirname, "..", "service-account.json");
const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));

if (!getApps().length) {
  initializeApp({ credential: cert(sa as any) });
}

const db = getFirestore();

function healthId() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "KVS-2026-";
  for (let i = 0; i < 5; i++) id += c[Math.floor(Math.random() * c.length)];
  return id;
}

async function seed() {
  const batch = db.batch();
  for (let i = 1; i <= 100; i++) {
    const code = String(i).padStart(4, "0");
    batch.set(db.collection("cards").doc(code), {
      activation_code: code,
      health_id: healthId(),
      tier: "STANDARD",
      status: "available",
      user_uid: null,
      activated_at: null,
      created_at: new Date(),
    });
  }
  await batch.commit();
  console.log("✅ 100 cards seeded!");
}

seed().catch(console.error);

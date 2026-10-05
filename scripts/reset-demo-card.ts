/**
 * Reset ONLY the demo card KVS-DEMO-00001.
 * Refuses any card without isDemo: true.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/reset-demo-card.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";

function loadAdmin() {
  // Load .env.local for Storage bucket if present
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) {
          process.env[m[1].trim()] = m[2].trim();
        }
      }
    }
  } catch {
    /* ignore */
  }
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) {
      throw new Error("Missing service-account.json");
    }
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    const bucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      ...(bucket ? { storageBucket: bucket } : {}),
    });
    console.log("project:", sa.project_id);
  }
  return getFirestore();
}

async function deleteQuery(
  db: FirebaseFirestore.Firestore,
  col: string,
  field: string,
  value: string
) {
  const snap = await db.collection(col).where(field, "==", value).get();
  let n = 0;
  for (const d of snap.docs) {
    await d.ref.delete();
    n += 1;
  }
  return n;
}

export async function resetDemoCard(db: FirebaseFirestore.Firestore) {
  const ref = db.collection("cards").doc(DEMO_HEALTH_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("FAIL: demo card doc missing — run create-demo-card.ts first");
  }

  const data = snap.data()!;
  if (data.isDemo !== true) {
    throw new Error(
      "REFUSED: card is not marked isDemo:true — refusing to reset (safety)"
    );
  }

  const health_id = String(data.health_id || "");
  if (health_id !== DEMO_HEALTH_ID) {
    throw new Error("REFUSED: health_id is not the sole allowed demo id");
  }

  const profileId = data.linkedProfileId as string | undefined;
  if (profileId) {
    await db.collection("profiles").doc(profileId).delete().catch(() => {});
  }

  const profiles = await db
    .collection("profiles")
    .where("health_id", "==", health_id)
    .get();
  for (const d of profiles.docs) {
    await d.ref.delete().catch(() => {});
  }

  const scansDeleted = await deleteQuery(db, "scans", "healthId", health_id);
  let accessLogs = 0;
  let grants = 0;
  try {
    accessLogs = await deleteQuery(db, "accessLogs", "healthId", health_id);
  } catch {
    /* optional */
  }
  try {
    grants = await deleteQuery(db, "grants", "healthId", health_id);
  } catch {
    /* optional */
  }

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
      isDemo: true,
      tier: data.tier || "STANDARD",
      created_at: data.created_at || null,
    },
    { merge: false }
  );

  // Storage cleanup if bucket configured
  let storageDeleted = 0;
  try {
    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      const { getStorage } = await import("firebase-admin/storage");
      const bucket = getStorage().bucket(bucketName);
      for (const prefix of [
        `profiles/${DEMO_HEALTH_ID}/`,
        `pending/${DEMO_HEALTH_ID}/`,
      ]) {
        const [files] = await bucket.getFiles({ prefix });
        for (const f of files) {
          await f.delete({ ignoreNotFound: true }).catch(() => {});
          storageDeleted += 1;
        }
      }
    }
  } catch {
    /* bucket may not exist yet */
  }

  return { scansDeleted, accessLogs, grants, storageDeleted };
}

async function main() {
  const db = loadAdmin();
  await resetDemoCard(db);
  console.log("Demo card reset OK — status: unactivated");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

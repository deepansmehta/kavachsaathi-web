/**
 * Admin-triggered cleanup of pending/ uploads older than 24h.
 *   npx tsx scripts/cleanup-pending-uploads.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) throw new Error("Missing service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    const bucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      ...(bucket ? { storageBucket: bucket } : {}),
    });
  }
}

async function main() {
  loadAdmin();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    console.log("No FIREBASE_STORAGE_BUCKET — nothing to clean");
    return;
  }
  const bucket = getStorage().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: "pending/" });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const f of files) {
    const updated = new Date(f.metadata.updated || f.metadata.timeCreated || 0).getTime();
    if (updated && updated < cutoff) {
      await f.delete({ ignoreNotFound: true }).catch(() => {});
      deleted += 1;
    }
  }
  console.log(`cleanup-pending: deleted=${deleted} scanned=${files.length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

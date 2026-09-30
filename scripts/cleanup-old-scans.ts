/**
 * Optional cleanup: delete scan docs older than 180 days.
 * Not auto-run — invoke manually:
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/cleanup-old-scans.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const DAYS = 180;

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (fs.existsSync(saPath)) {
      const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
      initializeApp({ credential: cert(sa) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      });
    } else {
      throw new Error("Missing service-account.json or FIREBASE_SERVICE_ACCOUNT_KEY");
    }
  }
  return getFirestore(getApps()[0] as App);
}

async function main() {
  const db = loadAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  const cutoffTs = Timestamp.fromDate(cutoff);

  console.log(`Deleting scans with scannedAt < ${cutoff.toISOString()}…`);
  let deleted = 0;
  // Paginate in batches of 400
  for (;;) {
    const snap = await db
      .collection("scans")
      .where("scannedAt", "<", cutoffTs)
      .limit(400)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`  deleted ${deleted}…`);
  }
  console.log(`Done. Removed ${deleted} old scan(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

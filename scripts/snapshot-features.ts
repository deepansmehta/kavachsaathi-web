/**
 * Snapshot / restore Firestore config/features.
 *   npx --yes tsx scripts/snapshot-features.ts
 *   npx --yes tsx scripts/snapshot-features.ts --restore tmp/feature-flags-snapshot-XXXX.json
 */
import fs from "fs";
import path from "path";
import { getAdminDb } from "../src/lib/firebase-admin";
import { FEATURE_KEYS, type FeatureKey } from "../src/lib/features/flags";

async function main() {
  const args = process.argv.slice(2);
  const restoreIdx = args.indexOf("--restore");
  const db = getAdminDb();
  const ref = db.collection("config").doc("features");

  if (restoreIdx >= 0) {
    const file = args[restoreIdx + 1];
    if (!file || !fs.existsSync(file)) {
      console.error("Usage: --restore <snapshot.json>");
      process.exit(1);
    }
    const snap = JSON.parse(fs.readFileSync(file, "utf8"));
    const data = snap.data || snap;
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedBy: "snapshot-restore",
      restoredFrom: file,
    };
    for (const k of FEATURE_KEYS) {
      if (typeof data[k] === "boolean") patch[k] = data[k];
    }
    await ref.set(patch, { merge: true });
    console.log("RESTORED from", file);
    console.log(JSON.stringify(patch, null, 2));
    return;
  }

  const doc = await ref.get();
  const data = doc.exists ? doc.data() || {} : {};
  const outDir = path.join(process.cwd(), "tmp");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `feature-flags-snapshot-${Date.now()}.json`
  );
  const payload = {
    snappedAt: new Date().toISOString(),
    exists: doc.exists,
    data,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log("SNAPSHOT", outPath);
  console.log(JSON.stringify(data, null, 2));

  // Also write a stable path for rollback docs
  const stable = path.join(outDir, "feature-flags-snapshot-latest.json");
  fs.writeFileSync(stable, JSON.stringify(payload, null, 2));
  console.log("STABLE", stable);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

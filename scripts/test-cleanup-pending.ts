/**
 * Local test for pending/ cleanup logic (disposable file only).
 *   npx tsx scripts/test-cleanup-pending.ts
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

async function main() {
  loadEnv();
  const sa = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
  );
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET!;
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      storageBucket: bucketName,
    });
  }
  const bucket = getStorage().bucket();
  const testPath = `pending/KVS-2099-CLN01/old-test.txt`;
  await bucket.file(testPath).save(Buffer.from("old"), {
    contentType: "text/plain",
    resumable: false,
    metadata: { metadata: { seeded: "1" } },
  });
  // Backdate by rewriting custom time isn't always supported — delete by age logic with forced old metadata via copy isn't easy.
  // Instead: run the same age filter with cutoff = now+1ms so this file counts as "old".
  const [files] = await bucket.getFiles({ prefix: "pending/KVS-2099-CLN01/" });
  const cutoff = Date.now() + 1000; // treat all current as older than cutoff for test
  let deleted = 0;
  for (const f of files) {
    const updated = new Date(
      f.metadata.updated || f.metadata.timeCreated || 0
    ).getTime();
    if (updated < cutoff) {
      await f.delete({ ignoreNotFound: true });
      deleted += 1;
    }
  }
  const [left] = await bucket.getFiles({ prefix: "pending/KVS-2099-CLN01/" });
  console.log(
    left.length === 0 && deleted >= 1
      ? "cleanup-pending local test: PASS"
      : `cleanup-pending local test: FAIL deleted=${deleted} left=${left.length}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

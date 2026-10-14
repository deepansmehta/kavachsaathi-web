/**
 * Apply cors.json to the production Firebase Storage bucket.
 * Usage:
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *     scripts/apply-storage-cors.ts
 *   RESTORE=1 … scripts/apply-storage-cors.ts   # restore docs/ops backup
 */
import * as fs from "fs";
import * as path from "path";
import { Storage } from "@google-cloud/storage";

const BUCKET = "kavachsaathi.firebasestorage.app";
const BACKUP =
  "docs/ops/storage-cors-before-safety-batch-20261014.json";

async function main() {
  const sa = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
  );
  const restore = process.env.RESTORE === "1";
  const corsPath = restore
    ? path.join(process.cwd(), BACKUP)
    : path.join(process.cwd(), "cors.json");
  const cors = JSON.parse(fs.readFileSync(corsPath, "utf8"));

  const storage = new Storage({
    credentials: sa,
    projectId: sa.project_id,
  });
  const bucket = storage.bucket(BUCKET);

  const [before] = await bucket.getMetadata();
  console.log(
    "before_origins",
    JSON.stringify(before.cors?.[0]?.origin || [])
  );

  await bucket.setCorsConfiguration(cors);

  const [after] = await bucket.getMetadata();
  console.log(
    "after_origins",
    JSON.stringify(after.cors?.[0]?.origin || [])
  );
  console.log(restore ? "CORS_RESTORED" : "CORS_APPLIED", BUCKET);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

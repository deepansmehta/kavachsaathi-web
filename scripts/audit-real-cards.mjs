/**
 * Audit KVS-2026-* unactivated count + updatedAt fingerprint.
 *   node scripts/audit-real-cards.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

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

loadEnv();

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  const saPath = path.join(process.cwd(), "service-account.json");
  if (!fs.existsSync(saPath)) {
    console.error("missing service-account.json");
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}

const db = getFirestore();
const snap = await db
  .collection("cards")
  .where("health_id", ">=", "KVS-2026-")
  .where("health_id", "<=", "KVS-2026-\uf8ff")
  .get();

let un = 0;
const updatedAts = [];
for (const d of snap.docs) {
  const x = d.data();
  if (String(x.status) === "unactivated") un += 1;
  const u = x.updatedAt || x.updated_at;
  if (u && typeof u.toMillis === "function") updatedAts.push(u.toMillis());
}
const fp = updatedAts.sort((a, b) => a - b).join(",") || "none";
const outDir = path.join(process.cwd(), "exports", "launch-reveal");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "card-audit.json");
const prevPath = path.join(outDir, "card-audit-prev-fp.txt");
const prev = fs.existsSync(prevPath)
  ? fs.readFileSync(prevPath, "utf8").trim()
  : null;
const sha = crypto.createHash("sha256").update(fp).digest("hex").slice(0, 16);
const payload = {
  at: new Date().toISOString(),
  total: snap.size,
  unactivated: un,
  updatedFingerprintSha16: sha,
  fingerprintUnchanged: prev ? prev === fp : null,
};
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
if (!prev) fs.writeFileSync(prevPath, fp);
console.log(JSON.stringify(payload, null, 2));
if (un !== 500 || snap.size !== 500) {
  console.error("FAIL: expected 500/500 unactivated");
  process.exit(1);
}
if (prev && prev !== fp) {
  console.error("FAIL: updatedAt fingerprint changed");
  process.exit(1);
}
console.log("PASS card audit 500/500 fingerprint ok");

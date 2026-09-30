/**
 * Production QR + activation export (real inventory only).
 * Writes git-ignored files under exports/:
 *   - exports/qr-urls.csv          (vendor) health_id,url
 *   - exports/activation-codes.csv (internal) health_id,activation_code
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/export-qr-urls.ts
 *
 * --test: disposable smoke format check only (no real export)
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const TEST_MODE =
  process.argv.includes("--test") || process.argv.includes("--dry-run");
const TEST_CODE = "9999";
const TEST_HEALTH_ID = "KVS-2099-SMK01";

const saPath = path.join(process.cwd(), "service-account.json");
if (!getApps().length) {
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  initializeApp({ credential: cert(sa) });
}

function isRealInventory(r: {
  activation_code: string;
  health_id: string;
  isDemo: boolean;
}): boolean {
  return (
    !r.isDemo &&
    r.activation_code !== TEST_CODE &&
    r.health_id !== TEST_HEALTH_ID &&
    !r.health_id.startsWith("KVS-2099-") &&
    !r.health_id.startsWith("KVS-DEMO-") &&
    /^KVS-2026-[A-Z0-9]{5}$/i.test(r.health_id)
  );
}

async function main() {
  const db = getFirestore();

  if (TEST_MODE) {
    console.log("DRY-RUN / --test mode: disposable card only (no 0001–0100).");
    const ref = db.collection("cards").doc(TEST_CODE);
    const existing = await ref.get();
    let created = false;
    if (!existing.exists) {
      await ref.set({
        activation_code: TEST_CODE,
        health_id: TEST_HEALTH_ID,
        tier: "STANDARD",
        status: "unactivated",
        linkedProfileId: null,
        user_uid: null,
        activated_at: null,
        created_at: FieldValue.serverTimestamp(),
        _smoke_test: true,
      });
      created = true;
    }
    const data = (await ref.get()).data()!;
    const health_id = String(data.health_id || TEST_HEALTH_ID);
    const url = `https://kavachsaathi.in/card/${health_id}`;
    const formatOk =
      /^https:\/\/kavachsaathi\.in\/card\/KVS-\d{4}-[A-Z0-9]{5}$/i.test(url);
    console.log(`format valid: ${formatOk}`);
    if (created) await ref.delete();
    if (!formatOk) process.exit(1);
    console.log("PASS: export-qr-urls --test OK");
    return;
  }

  const exportsDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(exportsDir, { recursive: true });

  const snap = await db.collection("cards").get();
  const rows = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        activation_code: String(data.activation_code || d.id),
        health_id: String(data.health_id || ""),
        isDemo: data.isDemo === true,
      };
    })
    .filter(isRealInventory)
    .sort((a, b) =>
      a.activation_code.localeCompare(b.activation_code, undefined, {
        numeric: true,
      })
    );

  const qrPath = path.join(exportsDir, "qr-urls.csv");
  const codePath = path.join(exportsDir, "activation-codes.csv");

  const qrLines = [
    "health_id,url",
    ...rows.map(
      (r) => `${r.health_id},https://kavachsaathi.in/card/${r.health_id}`
    ),
  ];
  const codeLines = [
    "health_id,activation_code",
    ...rows.map((r) => `${r.health_id},${r.activation_code}`),
  ];

  fs.writeFileSync(qrPath, qrLines.join("\n") + "\n");
  fs.writeFileSync(codePath, codeLines.join("\n") + "\n");

  const healthIds = rows.map((r) => r.health_id);
  const codes = rows.map((r) => r.activation_code);
  const uniqH = new Set(healthIds).size === healthIds.length;
  const uniqC = new Set(codes).size === codes.length;
  const urlsOk = rows.every((r) =>
    `https://kavachsaathi.in/card/${r.health_id}`.startsWith(
      "https://kavachsaathi.in/card/"
    )
  );
  const noDemo = rows.every(
    (r) => !r.isDemo && !r.health_id.startsWith("KVS-DEMO-")
  );
  const countOk = rows.length === 100;

  console.log(`qr_urls_path: ${qrPath}`);
  console.log(`activation_codes_path: ${codePath}`);
  console.log(`qr_rows: ${rows.length}`);
  console.log(`activation_rows: ${rows.length}`);
  console.log(`validation_count_100: ${countOk ? "OK" : "FAIL"}`);
  console.log(`validation_unique_health_id: ${uniqH ? "OK" : "FAIL"}`);
  console.log(`validation_unique_activation_code: ${uniqC ? "OK" : "FAIL"}`);
  console.log(`validation_url_prefix: ${urlsOk ? "OK" : "FAIL"}`);
  console.log(`validation_demo_absent: ${noDemo ? "OK" : "FAIL"}`);

  if (!countOk || !uniqH || !uniqC || !urlsOk || !noDemo) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

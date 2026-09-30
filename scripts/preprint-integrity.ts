/**
 * Pre-print integrity + backup (read-only on real cards).
 * Prints counts / OK|FAIL only — never activation codes or PII.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadAdmin() {
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function main() {
  const db = loadAdmin();
  const snap = await db.collection("cards").get();

  const real = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => {
      const h = String((d as { health_id?: string }).health_id || "");
      return /^KVS-2026-[A-Z0-9]{5}$/i.test(h);
    }) as Array<{
    id: string;
    health_id?: string;
    activation_code?: string;
    status?: string;
    isDemo?: boolean;
  }>;

  const demo = snap.docs.filter((d) => {
    const data = d.data();
    return (
      data.isDemo === true || String(data.health_id || "").startsWith("KVS-DEMO-")
    );
  });

  const healthIds = real.map((r) => String(r.health_id || "").toUpperCase());
  const codes = real.map((r) =>
    String(r.activation_code || r.id).padStart(4, "0").slice(0, 4)
  );

  const countOk = real.length === 100;
  const allUnactivated = real.every(
    (r) => String(r.status || "unactivated").toLowerCase() === "unactivated"
  );
  const uniqHealth = new Set(healthIds).size === healthIds.length;
  const uniqCodes = new Set(codes).size === codes.length;
  const expectedCodes = new Set(
    Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(4, "0"))
  );
  const codesAre0001to0100 =
    codes.every((c) => expectedCodes.has(c)) &&
    codes.length === 100 &&
    new Set(codes).size === 100;
  const noneIsDemo = real.every((r) => r.isDemo !== true);
  const demoNotInInventory = demo.every((d) => {
    const h = String(d.data().health_id || "");
    return !/^KVS-2026-/i.test(h);
  });

  console.log("--- REAL CARD INTEGRITY ---");
  console.log(`kvs_2026_count: ${real.length} ${countOk ? "OK" : "FAIL"}`);
  console.log(
    `all_unactivated: ${allUnactivated ? "OK" : "FAIL"} (count_unactivated=${real.filter((r) => String(r.status).toLowerCase() === "unactivated").length})`
  );
  console.log(`unique_health_id: ${uniqHealth ? "OK" : "FAIL"}`);
  console.log(`unique_activation_code: ${uniqCodes ? "OK" : "FAIL"}`);
  console.log(
    `codes_cover_0001_0100: ${codesAre0001to0100 ? "OK" : "FAIL"}`
  );
  console.log(`none_isDemo: ${noneIsDemo ? "OK" : "FAIL"}`);
  console.log(`demo_docs_count: ${demo.length}`);
  console.log(
    `demo_excluded_from_2026_inventory: ${demoNotInInventory && noneIsDemo ? "OK" : "FAIL"}`
  );

  // Backup entire cards collection
  const backupDir = path.join(process.cwd(), "exports", "backup");
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `cards-backup-${ts}.json`);
  const payload = snap.docs.map((d) => ({
    docId: d.id,
    ...d.data(),
    // serialize timestamps
    _serialized: true,
  }));
  // Convert Firestore Timestamps to ISO for JSON
  const jsonSafe = JSON.parse(
    JSON.stringify(payload, (_k, v) => {
      if (v && typeof v === "object" && typeof v.toDate === "function") {
        return v.toDate().toISOString();
      }
      if (v && typeof v === "object" && v._seconds !== undefined) {
        return new Date(v._seconds * 1000).toISOString();
      }
      return v;
    })
  );
  fs.writeFileSync(backupPath, JSON.stringify(jsonSafe, null, 2));
  console.log("--- BACKUP ---");
  console.log(`backup_path: ${backupPath}`);
  console.log(`backup_record_count: ${jsonSafe.length}`);

  const ok =
    countOk &&
    allUnactivated &&
    uniqHealth &&
    uniqCodes &&
    codesAre0001to0100 &&
    noneIsDemo;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

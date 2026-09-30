/**
 * Backfill phoneNormalized on ACTIVATED profiles only.
 * Dry-run by default; pass --apply to write.
 *
 *   bunx tsx scripts/backfill-phone-normalized.ts
 *   bunx tsx scripts/backfill-phone-normalized.ts --apply
 *
 * Never prints full phone numbers — counts only.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  return null;
}

function loadAdmin() {
  if (!getApps().length) {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (!fs.existsSync(saPath)) throw new Error("Missing service-account.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = loadAdmin();

  const activatedCards = await db
    .collection("cards")
    .where("status", "in", ["activated", "active"])
    .get();

  const profileIds = new Set<string>();
  for (const c of activatedCards.docs) {
    const pid = c.data().linkedProfileId;
    if (typeof pid === "string" && pid) profileIds.add(pid);
  }

  // Also profiles that already have health_id (activated path)
  const profilesSnap = await db.collection("profiles").get();

  let scanned = 0;
  let already = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let skippedInvalid = 0;
  let skippedNoPhone = 0;

  for (const doc of profilesSnap.docs) {
    scanned += 1;
    const data = doc.data();
    // Only activated profiles: must be linked from an activated card OR have pin_hash
    const linked = profileIds.has(doc.id);
    const hasPin = Boolean(data.pin_hash);
    if (!linked && !hasPin) continue;

    if (data.phoneNormalized && typeof data.phoneNormalized === "string") {
      already += 1;
      continue;
    }

    const n = normalizePhone(String(data.phone || ""));
    if (!n) {
      if (!data.phone) skippedNoPhone += 1;
      else skippedInvalid += 1;
      continue;
    }

    wouldUpdate += 1;
    if (apply) {
      await doc.ref.update({ phoneNormalized: n });
      updated += 1;
    }
  }

  console.log("backfill-phone-normalized");
  console.log("mode:", apply ? "APPLY" : "DRY-RUN");
  console.log("profiles_scanned:", scanned);
  console.log("already_had_phoneNormalized:", already);
  console.log("would_update:", wouldUpdate);
  console.log("updated:", updated);
  console.log("skipped_no_phone:", skippedNoPhone);
  console.log("skipped_invalid_phone:", skippedInvalid);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

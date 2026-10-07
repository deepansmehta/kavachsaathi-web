/**
 * Cleanup rehearsal cards KVS-2099-REH* only.
 * Refuses KVS-2026-* and KVS-DEMO-*.
 *
 *   npx tsx scripts/cleanup-rehearsal.ts --dry-run
 *   npx tsx scripts/cleanup-rehearsal.ts --apply
 *
 * Prints counts only — no codes/PINs/secrets.
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

const DRY = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

const ALLOWED = new Set(["KVS-2099-REH01", "KVS-2099-REH02"]);

function loadAdmin() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim();
      }
    }
  }
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    const bucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
      ...(bucket ? { storageBucket: bucket } : {}),
    });
  }
  return getFirestore();
}

function assertAllowed(id: string) {
  const hid = id.toUpperCase();
  if (hid.startsWith("KVS-2026-") || hid.startsWith("KVS-DEMO-")) {
    throw new Error(`REFUSED: hard guard blocked ${hid.slice(0, 12)}…`);
  }
  if (!hid.startsWith("KVS-2099-REH")) {
    throw new Error(`REFUSED: only KVS-2099-REH* allowed`);
  }
  if (!ALLOWED.has(hid)) {
    throw new Error(`REFUSED: ${hid} not in allow-list`);
  }
}

async function deleteQuery(
  db: FirebaseFirestore.Firestore,
  col: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await db.collection(col).where(field, "==", value).get();
  let n = 0;
  for (const d of snap.docs) {
    if (APPLY) await d.ref.delete();
    n += 1;
  }
  return n;
}

async function countStorage(prefixes: string[]): Promise<number> {
  try {
    const bucket = getStorage().bucket();
    let n = 0;
    for (const prefix of prefixes) {
      const [files] = await bucket.getFiles({ prefix });
      n += files.length;
      if (APPLY) {
        for (const f of files) {
          await f.delete({ ignoreNotFound: true }).catch(() => {});
        }
      }
    }
    return n;
  } catch {
    return 0;
  }
}

async function main() {
  if (!DRY && !APPLY) {
    console.error("Use --dry-run or --apply");
    process.exit(1);
  }
  const db = loadAdmin();
  console.log(DRY ? "DRY-RUN" : "APPLY");

  let cards = 0;
  let profiles = 0;
  let storage = 0;
  let accessLogs = 0;
  let scans = 0;
  let stickers = 0;
  let referrals = 0;
  let rateLimits = 0;
  let users = 0;
  let auth = 0;

  for (const health_id of ALLOWED) {
    assertAllowed(health_id);
    const cardSnap = await db.collection("cards").doc(health_id).get();
    if (!cardSnap.exists) {
      console.log(`${health_id}: card_missing`);
      continue;
    }
    const card = cardSnap.data()!;
    if (card.isRehearsal !== true) {
      throw new Error(`REFUSED: ${health_id} missing isRehearsal:true`);
    }
    cards += 1;
    const linked = card.linkedProfileId
      ? String(card.linkedProfileId)
      : null;
    const uid = card.user_uid ? String(card.user_uid) : null;

    profiles += await deleteQuery(db, "profiles", "health_id", health_id);
    if (linked) {
      const p = await db.collection("profiles").doc(linked).get();
      if (p.exists) {
        profiles += 1;
        if (APPLY) await p.ref.delete();
      }
    }

    storage += await countStorage([
      `profiles/${health_id}/`,
      `pending/${health_id}/`,
    ]);

    for (const field of ["healthId", "health_id"]) {
      accessLogs += await deleteQuery(db, "accessLogs", field, health_id);
      scans += await deleteQuery(db, "scans", field, health_id);
      stickers += await deleteQuery(db, "stickerOrders", field, health_id);
    }
    for (const field of ["referredHealthId", "referrerHealthId", "health_id"]) {
      referrals += await deleteQuery(db, "referral_events", field, health_id);
    }

    const rl = await db.collection("rate_limits").get();
    for (const d of rl.docs) {
      if (decodeURIComponent(d.id).includes(health_id)) {
        rateLimits += 1;
        if (APPLY) await d.ref.delete();
      }
    }

    if (uid) {
      const u = await db.collection("users").doc(uid).get();
      if (u.exists) {
        users += 1;
        if (APPLY) await u.ref.delete();
      }
      try {
        await getAuth().getUser(uid);
        auth += 1;
        if (APPLY) await getAuth().deleteUser(uid);
      } catch {
        /* */
      }
    }

    if (APPLY) await cardSnap.ref.delete();
  }

  console.log(
    [
      `cards=${cards}`,
      `profiles=${profiles}`,
      `storageFiles=${storage}`,
      `accessLogs=${accessLogs}`,
      `scans=${scans}`,
      `stickerOrders=${stickers}`,
      `referral_events=${referrals}`,
      `rate_limits=${rateLimits}`,
      `users_docs=${users}`,
      `auth_users=${auth}`,
    ].join(" ")
  );

  if (APPLY) {
    const real = await db
      .collection("cards")
      .where("health_id", ">=", "KVS-2026-")
      .where("health_id", "<=", "KVS-2026-\uf8ff")
      .get();
    let un = 0;
    for (const d of real.docs) {
      if (String(d.data().status) === "unactivated") un += 1;
    }
    console.log(`real_unactivated_count=${un}`);
    if (un !== 500) {
      throw new Error(`FAIL: expected 500 unactivated real cards, got ${un}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * ONE-TIME factory reset for owner-approved real cards A0001 + A0002 only.
 * Refuses any other health_id. Never prints activation codes or PINs.
 *
 *   npx tsx scripts/reset-real-cards-once.ts --dry-run
 *   npx tsx scripts/reset-real-cards-once.ts --apply
 *
 * Disabled after 2026-10-08 IST (hard exit).
 */
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const SCRIPT_EXPIRES_MS = Date.parse("2026-10-09T00:00:00+05:30");

/** Exactly two allow-listed production cards (serial A0001 / A0002). */
const ALLOWED: Readonly<
  Record<
    string,
    { serial: string; activationDocId: string }
  >
> = {
  "KVS-2026-75QW6": { serial: "A0001", activationDocId: "0001" },
  "KVS-2026-2QTUT": { serial: "A0002", activationDocId: "0002" },
};

const DRY = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

/** Owner one-time apply completed 2026-10-07 — keep false unless emergency override. */
const APPLY_PERMANENTLY_DISABLED =
  process.env.RESET_REAL_CARDS_UNLOCK !== "1";

function guardExpiry() {
  if (Date.now() >= SCRIPT_EXPIRES_MS) {
    console.error("REFUSED: script expired (owner window closed).");
    process.exit(1);
  }
}

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
  return getFirestore();
}

async function countQuery(
  db: FirebaseFirestore.Firestore,
  col: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await db.collection(col).where(field, "==", value).get();
  return snap.size;
}

async function countReferralEvents(
  db: FirebaseFirestore.Firestore,
  healthId: string
): Promise<number> {
  let n = 0;
  for (const field of ["referredHealthId", "referrerHealthId", "health_id"]) {
    try {
      n += await countQuery(db, "referral_events", field, healthId);
    } catch {
      /* optional index */
    }
  }
  return n;
}

async function countRateLimitsForCard(
  db: FirebaseFirestore.Firestore,
  healthId: string
): Promise<number> {
  const snap = await db.collection("rate_limits").get();
  let n = 0;
  for (const d of snap.docs) {
    const id = decodeURIComponent(d.id);
    if (id.includes(healthId)) n += 1;
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
    }
    return n;
  } catch {
    return 0;
  }
}

type DryRunLine = {
  serial: string;
  status: string;
  profileDoc: number;
  storageFiles: number;
  accessLogs: number;
  stickerOrders: number;
  sessionsRateLimits: number;
};

async function planReset(
  db: FirebaseFirestore.Firestore,
  healthId: string
): Promise<DryRunLine> {
  const meta = ALLOWED[healthId];
  const cardSnap = await db
    .collection("cards")
    .doc(meta.activationDocId)
    .get();
  if (!cardSnap.exists) throw new Error(`Card doc missing for ${meta.serial}`);
  const card = cardSnap.data()!;
  if (String(card.health_id) !== healthId) {
    throw new Error(`REFUSED: ${meta.serial} health_id mismatch on card doc`);
  }
  if (String(card.serial || "") !== meta.serial) {
    throw new Error(`REFUSED: ${meta.serial} serial mismatch`);
  }

  const profilesByHealth = await countQuery(db, "profiles", "health_id", healthId);
  const profilesByLink =
    card.linkedProfileId != null
      ? (await db.collection("profiles").doc(String(card.linkedProfileId)).get())
          .exists
        ? 1
        : 0
      : 0;
  const profileDoc = Math.max(profilesByHealth, profilesByLink);

  const storageFiles = await countStorage([
    `profiles/${healthId}/`,
    `pending/${healthId}/`,
  ]);

  let accessLogs = 0;
  for (const field of ["healthId", "health_id"]) {
    accessLogs += await countQuery(db, "accessLogs", field, healthId);
  }

  let stickerOrders = 0;
  for (const field of ["healthId", "health_id"]) {
    stickerOrders += await countQuery(db, "stickerOrders", field, healthId);
  }

  const sessionsRateLimits = await countRateLimitsForCard(db, healthId);

  return {
    serial: meta.serial,
    status: String(card.status || "unknown"),
    profileDoc,
    storageFiles,
    accessLogs,
    stickerOrders,
    sessionsRateLimits,
  };
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
    await d.ref.delete();
    n += 1;
  }
  return n;
}

async function applyReset(
  db: FirebaseFirestore.Firestore,
  healthId: string,
  template: FirebaseFirestore.DocumentData
) {
  const meta = ALLOWED[healthId];
  const cardRef = db.collection("cards").doc(meta.activationDocId);
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists) throw new Error("Card missing");
  const card = cardSnap.data()!;
  const activation_code = String(card.activation_code || meta.activationDocId);

  const linked = card.linkedProfileId
    ? String(card.linkedProfileId)
    : null;
  if (linked) {
    await db.collection("profiles").doc(linked).delete().catch(() => {});
  }
  await deleteQuery(db, "profiles", "health_id", healthId);

  for (const col of ["accessLogs", "stickerOrders", "scans", "grants"]) {
    for (const field of ["healthId", "health_id"]) {
      await deleteQuery(db, col, field, healthId).catch(() => 0);
    }
  }

  for (const field of ["referredHealthId", "referrerHealthId", "health_id"]) {
    await deleteQuery(db, "referral_events", field, healthId).catch(() => 0);
  }

  const rlSnap = await db.collection("rate_limits").get();
  for (const d of rlSnap.docs) {
    const id = decodeURIComponent(d.id);
    if (id.includes(healthId)) await d.ref.delete();
  }

  try {
    const bucket = getStorage().bucket();
    for (const prefix of [`profiles/${healthId}/`, `pending/${healthId}/`]) {
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) {
        await f.delete({ ignoreNotFound: true }).catch(() => {});
      }
    }
  } catch {
    /* storage optional */
  }

  await cardRef.set(
    {
      activation_code,
      health_id: healthId,
      serial: meta.serial,
      batch: card.batch ?? template.batch ?? 1,
      tier: card.tier ?? template.tier ?? "STANDARD",
      status: "unactivated",
      user_uid: null,
      activated_at: null,
      linkedProfileId: null,
      validFrom: null,
      validTill: null,
      created_at: card.created_at ?? template.created_at ?? FieldValue.serverTimestamp(),
    },
    { merge: false }
  );
}

async function snapshotRealCardTimestamps(
  db: FirebaseFirestore.Firestore,
  excludeDocIds: Set<string>
): Promise<Map<string, string>> {
  const snap = await db.collection("cards").get();
  const m = new Map<string, string>();
  for (const d of snap.docs) {
    if (excludeDocIds.has(d.id)) continue;
    const data = d.data();
    if (data.isDemo === true) continue;
    const hid = String(data.health_id || "");
    if (!hid.startsWith("KVS-2026-")) continue;
    const ts =
      data.updated_at?.toDate?.()?.toISOString?.() ||
      data.created_at?.toDate?.()?.toISOString?.() ||
      JSON.stringify(data.updated_at ?? data.created_at ?? "");
    m.set(d.id, ts);
  }
  return m;
}

async function main() {
  guardExpiry();
  if (!DRY && !APPLY) {
    console.error("Use --dry-run or --apply");
    process.exit(1);
  }

  const db = loadAdmin();
  const templateSnap = await db.collection("cards").doc("0003").get();
  if (!templateSnap.exists) throw new Error("Template card 0003 missing");
  const template = templateSnap.data()!;

  console.log(DRY ? "DRY-RUN" : "APPLY");
  for (const healthId of Object.keys(ALLOWED)) {
    const line = await planReset(db, healthId);
    console.log(
      [
        `serial=${line.serial}`,
        `status=${line.status}`,
        `profileDoc=${line.profileDoc}`,
        `storageFiles=${line.storageFiles}`,
        `accessLogs=${line.accessLogs}`,
        `stickerOrders=${line.stickerOrders}`,
        `sessionsRateLimits=${line.sessionsRateLimits}`,
      ].join(" ")
    );
  }

  if (DRY) return;

  if (APPLY_PERMANENTLY_DISABLED) {
    console.error(
      "REFUSED: one-time apply completed. --dry-run only, or RESET_REAL_CARDS_UNLOCK=1 before 2026-10-09."
    );
    process.exit(1);
  }

  const exclude = new Set(
    Object.values(ALLOWED).map((m) => m.activationDocId)
  );
  const before = await snapshotRealCardTimestamps(db, exclude);

  for (const healthId of Object.keys(ALLOWED)) {
    await applyReset(db, healthId, template);
    console.log(`reset OK ${ALLOWED[healthId].serial} → unactivated`);
  }

  const after = await snapshotRealCardTimestamps(db, exclude);
  let drift = 0;
  for (const [docId, ts] of before) {
    if (after.get(docId) !== ts) drift += 1;
  }
  if (drift > 0) {
    throw new Error(`FAIL: ${drift} other real cards changed timestamps`);
  }

  let unactivated = 0;
  const all = await db.collection("cards").get();
  for (const d of all.docs) {
    const x = d.data();
    if (x.isDemo === true) continue;
    if (!String(x.health_id || "").startsWith("KVS-2026-")) continue;
    if (String(x.status) === "unactivated" || String(x.status) === "available") {
      unactivated += 1;
    }
  }
  console.log(`real_unactivated_count=${unactivated}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

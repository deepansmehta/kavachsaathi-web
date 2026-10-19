/**
 * Create KavachSaathi card sets 06–07 (serials A0501–A0700 / docs 0501–0700).
 *
 * Dry-run by default (counts + fingerprint only — never prints activation codes).
 * Write:  --apply
 *
 *   npx tsx scripts/create-card-batches-06-07.ts
 *   npx tsx scripts/create-card-batches-06-07.ts --apply
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  type Firestore,
  type WriteBatch,
} from "firebase-admin/firestore";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const BASE_URL = "https://kavachsaathi.in";

/** Same alphabet as scripts/seed-cards.ts / create-card-batches.ts — no I/O/0/1 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const RANGE_START = 501;
const RANGE_END = 700; // inclusive
const EXPECTED_NEW = RANGE_END - RANGE_START + 1; // 200
const EXPECTED_TOTAL_KVS = 700;

type CardPlan = {
  docId: string;
  health_id: string;
  serial: string;
  batch: number;
  setLabel: string;
  action: "create" | "exists";
};

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

function adminDb(): Firestore {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(ROOT, "service-account.json"), "utf8")
    );
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
    });
  }
  return getFirestore();
}

function padCode(n: number): string {
  return String(n).padStart(4, "0");
}

function serialFor(n: number): string {
  return `A${padCode(n)}`;
}

function batchFor(n: number): number {
  if (n <= 600) return 6;
  return 7;
}

function setLabelFor(batch: number): string {
  return `SET ${String(batch).padStart(2, "0")}`;
}

function fingerprintIds(ids: string[]): string {
  return crypto
    .createHash("sha256")
    .update([...ids].sort().join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function randomHealthId(used: Set<string>): string {
  for (let attempt = 0; attempt < 20_000; attempt++) {
    let suffix = "";
    for (let i = 0; i < 5; i++) {
      suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    const id = `KVS-2026-${suffix}`;
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  throw new Error("Failed to generate unique health_id");
}

function isWeakCode(code: string): boolean {
  if (!/^\d{4}$/.test(code)) return true;
  if (code === "0000" || code === "1234" || code === "0123" || code === "9876") {
    return true;
  }
  if (/^(\d)\1{3}$/.test(code)) return true; // 1111, 2222, …
  // sequential ascending/descending
  const digits = code.split("").map(Number);
  let asc = true;
  let desc = true;
  for (let i = 1; i < 4; i++) {
    if (digits[i] !== (digits[i - 1] + 1) % 10) asc = false;
    if (digits[i] !== (digits[i - 1] + 9) % 10) desc = false;
  }
  if (asc || desc) return true;
  // simple pairs / repeats
  if (code.slice(0, 2) === code.slice(2) || code[0] === code[2] && code[1] === code[3]) {
    return true;
  }
  return false;
}

function randomActivationCode(
  used: Set<string>,
  cardNumber: string
): string {
  for (let attempt = 0; attempt < 50_000; attempt++) {
    const code = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    if (code === cardNumber) continue;
    if (isWeakCode(code)) continue;
    if (used.has(code)) continue;
    used.add(code);
    return code;
  }
  throw new Error("Failed to generate unique activation code");
}

async function commitInChunks(
  db: Firestore,
  ops: Array<(b: WriteBatch) => void>
) {
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) op(batch);
    await batch.commit();
  }
}

async function main() {
  const db = adminDb();
  const snap = await db.collection("cards").get();

  const byDoc = new Map<string, Record<string, unknown>>();
  const usedHealth = new Set<string>();
  const usedCodes = new Set<string>();
  let demoOk = false;
  let existingKvs2026 = 0;

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    byDoc.set(d.id, data);
    const hid = String(data.health_id || "").toUpperCase();
    if (hid) usedHealth.add(hid);
    if (/^KVS-2026-/.test(hid)) existingKvs2026 += 1;
    const code = String(data.activation_code || d.id)
      .padStart(4, "0")
      .slice(0, 4);
    if (/^\d{4}$/.test(code)) usedCodes.add(code);
    if (hid === "KVS-DEMO-00001" && data.isDemo === true) demoOk = true;
  }

  // Refuse if existing 0001–0500 inventory is missing / wrong count
  if (existingKvs2026 < 500) {
    throw new Error(
      `REFUSED: expected ≥500 existing KVS-2026-* cards, found ${existingKvs2026}`
    );
  }

  const plans: CardPlan[] = [];
  const writeOps: Array<(b: WriteBatch) => void> = [];
  /** Codes allocated for new creates — never logged */
  const newCodesByDoc = new Map<string, string>();

  for (let n = RANGE_START; n <= RANGE_END; n++) {
    const docId = padCode(n);
    const serial = serialFor(n);
    const batch = batchFor(n);
    const setLabel = setLabelFor(batch);
    const existing = byDoc.get(docId);

    if (existing) {
      const hid = String(existing.health_id || "").toUpperCase();
      if (existing.isDemo === true || hid.startsWith("KVS-DEMO")) {
        throw new Error(`REFUSED: ${docId} is demo — abort`);
      }
      if (!/^KVS-2026-[A-Z0-9]{5}$/.test(hid)) {
        throw new Error(`REFUSED: ${docId} has unexpected health_id`);
      }
      plans.push({
        docId,
        health_id: hid,
        serial: String(existing.serial || serial),
        batch: Number(existing.batch) || batch,
        setLabel,
        action: "exists",
      });
      continue;
    }

    const health_id = randomHealthId(usedHealth);
    const activation_code = randomActivationCode(usedCodes, docId);
    newCodesByDoc.set(docId, activation_code);
    plans.push({
      docId,
      health_id,
      serial,
      batch,
      setLabel,
      action: "create",
    });
    writeOps.push((b) =>
      b.set(db.collection("cards").doc(docId), {
        activation_code,
        health_id,
        serial,
        batch,
        tier: "STANDARD",
        status: "unactivated",
        paymentStatus: "prepaid",
        isDemo: false,
        user_uid: null,
        activated_at: null,
        created_at: FieldValue.serverTimestamp(),
      })
    );
  }

  const createCount = plans.filter((p) => p.action === "create").length;
  const existsCount = plans.filter((p) => p.action === "exists").length;
  const byBatch: Record<number, number> = { 6: 0, 7: 0 };
  for (const p of plans) byBatch[p.batch] = (byBatch[p.batch] || 0) + 1;

  const plannedIds = plans.map((p) => p.health_id);
  const plannedFp = fingerprintIds(plannedIds);

  console.log("=== CREATE CARD BATCHES SET 06–07 ===");
  console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`alphabet: ${ALPHABET}`);
  console.log(`demo_present: ${demoOk ? "OK" : "FAIL"}`);
  console.log(`existing_kvs_2026: ${existingKvs2026}`);
  console.log(`planned_range: ${padCode(RANGE_START)}–${padCode(RANGE_END)}`);
  console.log(`actions_create: ${createCount}`);
  console.log(`actions_exists: ${existsCount}`);
  console.log(
    `per_set: 06=${byBatch[6] || 0} 07=${byBatch[7] || 0}`
  );
  console.log(`firestore_ops: ${writeOps.length}`);
  console.log(`planned_id_fingerprint: ${plannedFp}`);
  console.log(`expected_new: ${EXPECTED_NEW}`);
  console.log(`expected_total_after: ${EXPECTED_TOTAL_KVS}`);

  if (!APPLY) {
    console.log("dry_run: no Firestore writes");
    console.log("re-run with --apply to write");
    return;
  }

  if (!demoOk) throw new Error("REFUSED: demo card missing before apply");
  if (createCount === 0 && existsCount === EXPECTED_NEW) {
    console.log("apply: all 200 docs already exist — verify only");
  } else if (createCount !== EXPECTED_NEW && existsCount + createCount !== EXPECTED_NEW) {
    throw new Error(
      `REFUSED: unexpected plan create=${createCount} exists=${existsCount}`
    );
  }

  if (writeOps.length) {
    await commitInChunks(db, writeOps);
    console.log("firestore_write: OK");
  } else {
    console.log("firestore_write: SKIP (nothing to create)");
  }

  // Verify — counts + fingerprint only (never codes)
  const after = await db.collection("cards").get();
  const kvsIds: string[] = [];
  const newDocs: Array<{ docId: string; health_id: string; batch: number; serial: string }> =
    [];
  const codesSeen = new Set<string>();
  let codeDupes = 0;
  let idDupes = 0;
  const idSeen = new Set<string>();
  let prepaidNew = 0;
  let unactivatedNew = 0;

  for (const d of after.docs) {
    const data = d.data();
    const hid = String(data.health_id || "").toUpperCase();
    if (!/^KVS-2026-/.test(hid)) continue;
    if (idSeen.has(hid)) idDupes += 1;
    idSeen.add(hid);
    kvsIds.push(hid);

    const code = String(data.activation_code || d.id)
      .padStart(4, "0")
      .slice(0, 4);
    if (codesSeen.has(code)) codeDupes += 1;
    codesSeen.add(code);

    const n = Number(d.id);
    if (n >= RANGE_START && n <= RANGE_END) {
      newDocs.push({
        docId: d.id,
        health_id: hid,
        batch: Number(data.batch) || batchFor(n),
        serial: String(data.serial || serialFor(n)),
      });
      if (data.paymentStatus === "prepaid") prepaidNew += 1;
      if (String(data.status || "").toLowerCase() === "unactivated") {
        unactivatedNew += 1;
      }
    }
  }

  const set6 = newDocs.filter((d) => d.batch === 6).length;
  const set7 = newDocs.filter((d) => d.batch === 7).length;
  const fp = fingerprintIds(kvsIds);

  console.log("=== VERIFY (counts only — no codes) ===");
  console.log(`created_or_present_new: ${newDocs.length}`);
  console.log(`total_kvs_2026: ${kvsIds.length}`);
  console.log(`duplicate_health_ids: ${idDupes}`);
  console.log(`duplicate_activation_codes: ${codeDupes}`);
  console.log(`set06_count: ${set6}`);
  console.log(`set07_count: ${set7}`);
  console.log(`new_prepaid: ${prepaidNew}`);
  console.log(`new_unactivated: ${unactivatedNew}`);
  console.log(`id_fingerprint: ${fp}`);
  console.log(`base_url_pattern: ${BASE_URL}/card/<health_id>`);

  const pass =
    newDocs.length === EXPECTED_NEW &&
    kvsIds.length === EXPECTED_TOTAL_KVS &&
    idDupes === 0 &&
    codeDupes === 0 &&
    set6 === 100 &&
    set7 === 100 &&
    prepaidNew === EXPECTED_NEW &&
    unactivatedNew === EXPECTED_NEW;

  console.log(`summary: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);

  // Write a local inventory index WITHOUT codes for print script handoff? No —
  // print script will re-read from Firestore securely into gitignored CSVs.
  void newCodesByDoc;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

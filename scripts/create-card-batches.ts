/**
 * Create KavachSaathi card batches 2–5 (codes 0101–0500) + backfill batch-1 serial/batch.
 *
 * Dry-run by default (counts only — never prints activation codes).
 * Write:  --apply
 *
 *   ./node_modules/.bin/ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/create-card-batches.ts
 *   ... scripts/create-card-batches.ts --apply
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import QRCode from "qrcode";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const BASE_URL = "https://kavachsaathi.in";

/** Same alphabet as scripts/seed-cards.ts (batch 1) — no I/O/0/1 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type CardPlan = {
  docId: string;
  activation_code: string;
  health_id: string;
  serial: string;
  batch: number;
  action: "create" | "backfill" | "exists";
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
  if (n <= 100) return 1;
  if (n <= 200) return 2;
  if (n <= 300) return 3;
  if (n <= 400) return 4;
  return 5;
}

function randomHealthId(used: Set<string>): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
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

function batchDir(batch: number): string {
  return path.join(ROOT, "exports", `batch-${String(batch).padStart(2, "0")}`);
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

async function writeExports(
  cards: Array<{
    serial: string;
    batch: number;
    health_id: string;
    activation_code: string;
  }>
) {
  const real = [...cards].sort((a, b) =>
    a.serial.localeCompare(b.serial, undefined, { numeric: true })
  );

  const masterPath = path.join(ROOT, "exports", "all-cards-master.csv");
  fs.mkdirSync(path.dirname(masterPath), { recursive: true });
  const masterLines = [
    "serial,batch,health_id,activation_code,url",
    ...real.map(
      (r) =>
        `${r.serial},${r.batch},${r.health_id},${r.activation_code},${BASE_URL}/card/${r.health_id}`
    ),
  ];
  fs.writeFileSync(masterPath, masterLines.join("\n") + "\n", "utf8");

  const svgOpts: QRCode.QRCodeToStringOptions = {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#000000", light: "#FFFFFF" },
  };
  const pngOpts: QRCode.QRCodeToBufferOptions = {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 800,
    color: { dark: "#000000", light: "#FFFFFF" },
  };

  for (let b = 2; b <= 5; b++) {
    const rows = real.filter((r) => r.batch === b);
    const dir = batchDir(b);
    const qrDir = path.join(dir, "qr");
    fs.mkdirSync(qrDir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, "activation-codes.csv"),
      [
        "serial,health_id,activation_code",
        ...rows.map((r) => `${r.serial},${r.health_id},${r.activation_code}`),
      ].join("\n") + "\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(dir, "qr-urls.csv"),
      [
        "serial,health_id,url",
        ...rows.map(
          (r) => `${r.serial},${r.health_id},${BASE_URL}/card/${r.health_id}`
        ),
      ].join("\n") + "\n",
      "utf8"
    );

    for (const r of rows) {
      const url = `${BASE_URL}/card/${r.health_id}`;
      const svg = await QRCode.toString(url, svgOpts);
      fs.writeFileSync(path.join(qrDir, `${r.health_id}.svg`), svg, "utf8");
      // PNG alongside for decode verification (same settings as batch 1)
      const png = await QRCode.toBuffer(url, pngOpts);
      fs.writeFileSync(path.join(qrDir, `${r.health_id}.png`), png);
    }
  }

  return { masterPath, batches: [2, 3, 4, 5].map((b) => batchDir(b)) };
}

async function verifyQrDecode(
  cards: Array<{ health_id: string; batch: number }>
): Promise<{ ok: number; total: number; fail: number }> {
  // lazy require — may be present from prior --no-save install
  let PNG: { sync: { read: (b: Buffer) => { data: Buffer; width: number; height: number } } };
  let jsQR: (
    data: Uint8ClampedArray,
    w: number,
    h: number,
    opts?: { inversionAttempts?: string }
  ) => { data: string } | null;
  try {
    PNG = require("pngjs").PNG;
    jsQR = require("jsqr");
  } catch {
    console.log("qr_decode: SKIP (pngjs/jsqr not installed)");
    return { ok: 0, total: 0, fail: -1 };
  }

  let ok = 0;
  let fail = 0;
  const newCards = cards.filter((c) => c.batch >= 2);
  for (const c of newCards) {
    const pngPath = path.join(
      batchDir(c.batch),
      "qr",
      `${c.health_id}.png`
    );
    const expected = `${BASE_URL}/card/${c.health_id}`;
    if (!fs.existsSync(pngPath)) {
      fail += 1;
      continue;
    }
    const buf = fs.readFileSync(pngPath);
    const png = PNG.sync.read(buf);
    const code = jsQR(
      new Uint8ClampedArray(
        png.data.buffer,
        png.data.byteOffset,
        png.data.byteLength
      ),
      png.width,
      png.height,
      { inversionAttempts: "dontInvert" }
    );
    if (code?.data === expected) ok += 1;
    else fail += 1;
  }
  // Also require SVG present for each
  let svgMissing = 0;
  for (const c of newCards) {
    const svgPath = path.join(
      batchDir(c.batch),
      "qr",
      `${c.health_id}.svg`
    );
    if (!fs.existsSync(svgPath)) svgMissing += 1;
  }
  return { ok, total: newCards.length, fail: fail + svgMissing };
}

async function main() {
  const db = adminDb();
  const snap = await db.collection("cards").get();

  const byDoc = new Map<string, Record<string, unknown>>();
  const usedHealth = new Set<string>();
  const usedCodes = new Set<string>();
  let demoOk = false;

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    byDoc.set(d.id, data);
    const hid = String(data.health_id || "").toUpperCase();
    if (hid) usedHealth.add(hid);
    const code = String(data.activation_code || d.id).padStart(4, "0").slice(0, 4);
    usedCodes.add(code);
    if (hid === "KVS-DEMO-00001" && data.isDemo === true) demoOk = true;
  }

  const plans: CardPlan[] = [];
  const writeOps: Array<(b: WriteBatch) => void> = [];

  // Backfill batch 1 serial/batch only
  for (let n = 1; n <= 100; n++) {
    const docId = padCode(n);
    const data = byDoc.get(docId);
    if (!data) {
      throw new Error(`REFUSED: missing batch-1 card doc ${docId}`);
    }
    const hid = String(data.health_id || "").toUpperCase();
    if (!/^KVS-2026-[A-Z0-9]{5}$/.test(hid)) {
      throw new Error(`REFUSED: batch-1 card ${docId} has unexpected health_id`);
    }
    if (data.isDemo === true) {
      throw new Error(`REFUSED: batch-1 card ${docId} marked isDemo`);
    }
    const needSerial = data.serial == null || data.serial === "";
    const needBatch = data.batch == null || data.batch === "";
    const serial = serialFor(n);
    const batch = 1;
    if (needSerial || needBatch) {
      plans.push({
        docId,
        activation_code: docId,
        health_id: hid,
        serial,
        batch,
        action: "backfill",
      });
      const patch: Record<string, unknown> = {};
      if (needSerial) patch.serial = serial;
      if (needBatch) patch.batch = batch;
      writeOps.push((b) => b.update(db.collection("cards").doc(docId), patch));
    } else {
      plans.push({
        docId,
        activation_code: docId,
        health_id: hid,
        serial: String(data.serial),
        batch: Number(data.batch) || 1,
        action: "exists",
      });
    }
  }

  // Create / keep 0101–0500
  for (let n = 101; n <= 500; n++) {
    const docId = padCode(n);
    const serial = serialFor(n);
    const batch = batchFor(n);
    const existing = byDoc.get(docId);
    if (existing) {
      const hid = String(existing.health_id || "").toUpperCase();
      if (existing.isDemo === true || hid.startsWith("KVS-DEMO")) {
        throw new Error(`REFUSED: ${docId} is demo — abort`);
      }
      plans.push({
        docId,
        activation_code: String(existing.activation_code || docId)
          .padStart(4, "0")
          .slice(0, 4),
        health_id: hid,
        serial: String(existing.serial || serial),
        batch: Number(existing.batch) || batch,
        action: "exists",
      });
      // Ensure serial/batch present on re-run
      const patch: Record<string, unknown> = {};
      if (existing.serial == null || existing.serial === "") patch.serial = serial;
      if (existing.batch == null || existing.batch === "") patch.batch = batch;
      if (Object.keys(patch).length) {
        writeOps.push((b) => b.update(db.collection("cards").doc(docId), patch));
      }
      continue;
    }

    if (usedCodes.has(docId)) {
      throw new Error(`REFUSED: activation_code collision for ${docId}`);
    }
    const health_id = randomHealthId(usedHealth);
    usedCodes.add(docId);
    plans.push({
      docId,
      activation_code: docId,
      health_id,
      serial,
      batch,
      action: "create",
    });
    writeOps.push((b) =>
      b.set(db.collection("cards").doc(docId), {
        activation_code: docId,
        health_id,
        serial,
        batch,
        tier: "STANDARD",
        status: "unactivated",
        isDemo: false,
        user_uid: null,
        activated_at: null,
        created_at: FieldValue.serverTimestamp(),
      })
    );
  }

  const createCount = plans.filter((p) => p.action === "create").length;
  const backfillCount = plans.filter((p) => p.action === "backfill").length;
  const existsCount = plans.filter((p) => p.action === "exists").length;
  const byBatch: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const p of plans) byBatch[p.batch] = (byBatch[p.batch] || 0) + 1;

  console.log("=== CREATE CARD BATCHES ===");
  console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`alphabet: ${ALPHABET}`);
  console.log(`demo_present: ${demoOk ? "OK" : "FAIL"}`);
  console.log(`planned_total_real: ${plans.length}`);
  console.log(`actions_create: ${createCount}`);
  console.log(`actions_backfill_serial_batch: ${backfillCount}`);
  console.log(`actions_exists: ${existsCount}`);
  console.log(
    `per_batch: ${[1, 2, 3, 4, 5].map((b) => `${b}=${byBatch[b] || 0}`).join(" ")}`
  );
  console.log(`firestore_ops: ${writeOps.length}`);

  if (!APPLY) {
    console.log("dry_run: no Firestore writes, no export files");
    console.log("re-run with --apply to write");
    return;
  }

  if (!demoOk) throw new Error("REFUSED: demo card missing before apply");

  await commitInChunks(db, writeOps);
  console.log("firestore_write: OK");

  // Re-read all real cards for exports + verify
  const after = await db.collection("cards").get();
  const realRows: Array<{
    serial: string;
    batch: number;
    health_id: string;
    activation_code: string;
    status: string;
    isDemo: boolean;
  }> = [];
  let demoStatus = "";
  for (const d of after.docs) {
    const data = d.data();
    const hid = String(data.health_id || "").toUpperCase();
    if (hid === "KVS-DEMO-00001") {
      demoStatus = `${data.status}|isDemo=${data.isDemo === true}`;
      continue;
    }
    if (data.isDemo === true || hid.startsWith("KVS-DEMO") || /^KVS-2099/i.test(hid)) {
      continue;
    }
    const code = String(data.activation_code || d.id).padStart(4, "0").slice(0, 4);
    const n = Number(code);
    realRows.push({
      serial: String(data.serial || serialFor(n)),
      batch: Number(data.batch) || batchFor(n),
      health_id: hid,
      activation_code: code,
      status: String(data.status || ""),
      isDemo: data.isDemo === true,
    });
  }

  const exportInfo = await writeExports(realRows);
  console.log(`export_master: ${exportInfo.masterPath}`);
  for (const p of exportInfo.batches) console.log(`export_batch: ${p}`);

  const healthIds = realRows.map((r) => r.health_id);
  const codes = realRows.map((r) => r.activation_code);
  const serials = realRows.map((r) => r.serial);
  const uniq = (a: string[]) => new Set(a).size === a.length;
  const allUnact = realRows.every(
    (r) => String(r.status).toLowerCase() === "unactivated"
  );
  const batchCounts: Record<number, number> = {};
  for (const r of realRows) {
    batchCounts[r.batch] = (batchCounts[r.batch] || 0) + 1;
  }

  const decode = await verifyQrDecode(realRows);

  // Live check 3 random new cards (batch >= 2) — message only, no codes
  const newOnes = realRows.filter((r) => r.batch >= 2);
  const shuffled = [...newOnes].sort(() => Math.random() - 0.5).slice(0, 3);
  let liveOk = 0;
  for (const r of shuffled) {
    const res = await fetch(`${BASE_URL}/card/${r.health_id}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const opens =
      /Activation opens on 11 October 2026/i.test(html) &&
      /12:00\s*PM IST/i.test(html);
    if (res.status === 200 && opens) liveOk += 1;
    console.log(
      `live_check: batch=${r.batch} http=${res.status} opens_msg=${opens ? "OK" : "FAIL"}`
    );
  }

  console.log("=== VERIFY (counts only) ===");
  console.log(`real_total: ${realRows.length}`);
  console.log(`all_unactivated: ${allUnact ? "OK" : "FAIL"}`);
  console.log(`unique_health_id: ${uniq(healthIds) ? "OK" : "FAIL"} (${new Set(healthIds).size})`);
  console.log(`unique_activation_code: ${uniq(codes) ? "OK" : "FAIL"} (${new Set(codes).size})`);
  console.log(`unique_serial: ${uniq(serials) ? "OK" : "FAIL"} (${new Set(serials).size})`);
  console.log(
    `batch_counts: ${[1, 2, 3, 4, 5].map((b) => `${b}=${batchCounts[b] || 0}`).join(" ")}`
  );
  console.log(`demo: ${demoStatus}`);
  console.log(
    `qr_decode: ${decode.ok}/${decode.total} fail=${decode.fail}`
  );
  console.log(`live_opens_msg: ${liveOk}/3`);

  const pass =
    realRows.length === 500 &&
    allUnact &&
    uniq(healthIds) &&
    uniq(codes) &&
    uniq(serials) &&
    (batchCounts[1] || 0) === 100 &&
    (batchCounts[2] || 0) === 100 &&
    (batchCounts[3] || 0) === 100 &&
    (batchCounts[4] || 0) === 100 &&
    (batchCounts[5] || 0) === 100 &&
    decode.fail === 0 &&
    decode.ok === decode.total &&
    liveOk === 3 &&
    demoStatus.includes("isDemo=true");

  console.log(`summary: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

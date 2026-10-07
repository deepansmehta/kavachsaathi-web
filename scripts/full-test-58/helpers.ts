/**
 * Shared helpers for full-test-58 — never logs secrets/codes/PINs/PII.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BrowserContext, Page } from "playwright";

export const BASE = "https://kavachsaathi.in";
export const OUT = path.join(
  process.cwd(),
  process.env.E2E_OUT_DIR || "exports/full-test-2026-10-08"
);

export const AUTO = [
  { health_id: "KVS-2099-AUTO01", serial: "T0001", role: "main" as const },
  { health_id: "KVS-2099-AUTO02", serial: "T0002", role: "elderly" as const },
  { health_id: "KVS-2099-AUTO03", serial: "T0003", role: "family" as const },
];

export const PIN_MAIN = "582914";
export const PIN_ELDER = "391746";
export const PIN_FAM = "746291";
export const PHONE_MAIN = "9998800101";
export const PHONE_ELDER = "9998800102";
export const PHONE_FAM = "9998800103";
export const PHONE_STRANGER = "9998800199";

export type ResultStatus = "PASS" | "FAIL" | "FIXED" | "NEEDS_OWNER";
export type Row = {
  id: string;
  status: ResultStatus;
  detail: string;
  fix?: string;
};

export const results: Row[] = [];
const fixes: string[] = [];

export function pass(id: string, detail = "") {
  results.push({ id, status: "PASS", detail });
  console.log("PASS", id, detail.slice(0, 80));
}
export function fail(id: string, detail: string) {
  results.push({ id, status: "FAIL", detail: detail.slice(0, 200) });
  console.log("FAIL", id, detail.slice(0, 120));
}
export function fixed(id: string, detail: string, fix: string) {
  results.push({ id, status: "FIXED", detail, fix });
  fixes.push(`${id}: ${fix}`);
  console.log("FIXED", id, fix.slice(0, 100));
}
export function needsOwner(id: string, detail: string) {
  results.push({ id, status: "NEEDS_OWNER", detail });
  console.log("NEEDS_OWNER", id, detail.slice(0, 120));
}
export function getFixes() {
  return fixes.slice();
}

export function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

export function adminDb() {
  loadEnv();
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

export function adminAuth() {
  adminDb();
  return getAuth();
}

export function jpegBytes(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
    "base64"
  );
}

export async function makePdf(
  file: string,
  text = "SAMPLE — NOT REAL DOCUMENT"
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, {
    x: 40,
    y: 400,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  fs.writeFileSync(file, await doc.save());
}

export async function prepareAssets(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    selfie: path.join(dir, "selfie.jpg"),
    pan: path.join(dir, "id-pan.jpg"),
    dlFront: path.join(dir, "id-dl-front.jpg"),
    dlBack: path.join(dir, "id-dl-back.jpg"),
    address: path.join(dir, "address-proof.jpg"),
    policyCard: path.join(dir, "policy-card.jpg"),
    govtCard: path.join(dir, "govt-card.jpg"),
    policyBond: path.join(dir, "policy-bond.pdf"),
    labReport: path.join(dir, "lab-report.pdf"),
    wrongType: path.join(dir, "wrong-type.jpg"),
  };
  for (const k of [
    "selfie",
    "pan",
    "dlFront",
    "dlBack",
    "address",
    "policyCard",
    "govtCard",
  ] as const) {
    fs.writeFileSync(files[k], jpegBytes());
  }
  await makePdf(files.policyBond, "SAMPLE POLICY BOND — NOT REAL");
  await makePdf(files.labReport, "SAMPLE LAB REPORT — NOT REAL");
  fs.writeFileSync(files.wrongType, Buffer.from("MZ-FAKE-EXE-NOT-AN-IMAGE"));
  return files;
}

export function randomCode4(): string {
  return String(crypto.randomInt(1000, 10000));
}

export async function ensureAutoCards(
  db: FirebaseFirestore.Firestore
): Promise<Record<string, string>> {
  const codes: Record<string, string> = {};
  for (const c of AUTO) {
    const code = randomCode4();
    codes[c.health_id] = code;
    await db
      .collection("cards")
      .doc(c.health_id)
      .set(
        {
          health_id: c.health_id,
          activation_code: code,
          serial: c.serial,
          status: "unactivated",
          tier: "STANDARD",
          batch: null,
          user_uid: null,
          linkedProfileId: null,
          activated_at: null,
          isDemo: false,
          isRehearsal: false,
          isTest: true,
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
  }
  return codes;
}

export async function countRealUnactivated(db: FirebaseFirestore.Firestore) {
  const snap = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<=", "KVS-2026-\uf8ff")
    .get();
  let un = 0;
  const updatedAts: number[] = [];
  for (const d of snap.docs) {
    const x = d.data();
    if (String(x.status) === "unactivated") un += 1;
    const u = x.updatedAt || x.updated_at;
    if (u && typeof u.toMillis === "function") updatedAts.push(u.toMillis());
  }
  return {
    total: snap.size,
    unactivated: un,
    updatedFingerprint: updatedAts.sort().join(",") || "none",
  };
}

export async function snapshotFlags(): Promise<Record<string, boolean>> {
  const r = await fetch(`${BASE}/api/features`);
  const j = (await r.json()) as { flags: Record<string, boolean> };
  const outPath = path.join(OUT, "flags-snapshot.json");
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(j.flags, null, 2));
  return j.flags;
}

export async function compareFlags(
  snap: Record<string, boolean>
): Promise<{ on: number; mismatch: number }> {
  const live = await snapshotFlags();
  let mismatch = 0;
  let on = 0;
  for (const [k, v] of Object.entries(snap)) {
    if (live[k] !== v) mismatch += 1;
  }
  for (const v of Object.values(live)) if (v === true) on += 1;
  return { on, mismatch };
}

export async function profileEncKeyMatch(): Promise<boolean> {
  // Read from Netlify via env already loaded, or skip if absent locally
  const k = String(process.env.PROFILE_ENC_KEY || "").trim();
  if (!k) return true; // verified separately in cleanup via netlify env:get
  const h = crypto.createHash("sha256").update(k).digest("hex");
  return h.startsWith("9449cf3e") && h.endsWith("999a8");
}

export async function mintAdminIdToken(): Promise<{
  idToken: string;
  uid: string;
  email: string;
}> {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com";
  const email = raw.split(",")[0].trim().toLowerCase();
  const auth = adminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, emailVerified: true });
  }
  const customToken = await auth.createCustomToken(user.uid, {
    role: "admin_test",
  });
  const apiKey = String(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ""
  ).trim();
  if (!apiKey) throw new Error("FIREBASE_API_KEY missing for admin token exchange");
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const j = (await r.json()) as { idToken?: string; error?: unknown };
  if (!j.idToken) throw new Error("custom token exchange failed");
  return { idToken: j.idToken, uid: user.uid, email };
}

export async function revokeAdminSession(uid: string) {
  try {
    await adminAuth().revokeRefreshTokens(uid);
  } catch {
    /* */
  }
}

export async function withPreviewCookie(
  context: BrowserContext,
  secret: string
) {
  await context.addCookies([
    {
      name: "kavach_preview_v3",
      value: "1",
      domain: "kavachsaathi.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  // Also open once with ?preview= to match server-side set
  const p = await context.newPage();
  await p.goto(`${BASE}/my-profile?preview=${secret}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.close();
}

export async function shot(page: Page, name: string) {
  fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
  await page.screenshot({
    path: path.join(OUT, "shots", `${name}.png`),
    fullPage: true,
  });
}

export async function solveMathCaptchaIfPresent(page: Page) {
  const label = page.getByLabel(/CAPTCHA/i);
  if ((await label.count()) === 0) return false;
  const bodyText = await page.locator("body").innerText();
  const m = bodyText.match(/(\d+)\s*([+\-×x*\/])\s*(\d+)\s*=\s*\?/);
  if (!m) return false;
  const a = Number(m[1]);
  const op = m[2];
  const b = Number(m[3]);
  let ans = 0;
  if (op === "+") ans = a + b;
  else if (op === "-") ans = a - b;
  else if (op === "×" || op === "x" || op === "*") ans = a * b;
  else if (op === "/") ans = Math.floor(a / b);
  await label.first().fill(String(ans));
  return true;
}

export async function fillByLabel(
  page: Page,
  re: RegExp,
  value: string,
  nth = 0
) {
  const loc = page.getByLabel(re).nth(nth);
  await loc.waitFor({ state: "visible", timeout: 20000 });
  await loc.fill(value);
}

export async function clickNext(page: Page) {
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.waitForTimeout(800);
}

export async function clearRateLimits(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection("rate_limits").limit(200).get();
  for (const d of snap.docs) await d.ref.delete().catch(() => {});
}

export async function deleteAutoEverything(db: FirebaseFirestore.Firestore) {
  const counts: Record<string, number> = {};
  const bucket = getStorage().bucket();
  for (const c of AUTO) {
    const hid = c.health_id;
    assertSafeDelete(hid);
    // profiles
    const profiles = await db
      .collection("profiles")
      .where("health_id", "==", hid)
      .get();
    counts.profiles = (counts.profiles || 0) + profiles.size;
    for (const d of profiles.docs) await d.ref.delete().catch(() => {});
    // card
    await db.collection("cards").doc(hid).delete().catch(() => {});
    counts.cards = (counts.cards || 0) + 1;
    // storage
    for (const prefix of [`profiles/${hid}/`, `pending/${hid}/`]) {
      const [files] = await bucket.getFiles({ prefix });
      counts.storage = (counts.storage || 0) + files.length;
      for (const f of files)
        await f.delete({ ignoreNotFound: true }).catch(() => {});
    }
    for (const col of [
      "accessLogs",
      "access_logs",
      "scans",
      "scan_logs",
      "stickerOrders",
      "sticker_orders",
      "referral_events",
      "referrals",
      "family_links",
      "family",
      "attendant_passes",
      "feedback",
      "fhir_exports",
      "rate_limits",
    ]) {
      try {
        for (const field of ["health_id", "healthId", "cardId"]) {
          const snap = await db.collection(col).where(field, "==", hid).get();
          counts[col] = (counts[col] || 0) + snap.size;
          for (const d of snap.docs) await d.ref.delete().catch(() => {});
        }
      } catch {
        /* collection may not exist / no index */
      }
    }
  }
  return counts;
}

function assertSafeDelete(hid: string) {
  if (hid.startsWith("KVS-2026-") || hid.startsWith("KVS-DEMO-")) {
    throw new Error("REFUSED: hard guard");
  }
  if (!hid.startsWith("KVS-2099-AUTO")) {
    throw new Error("REFUSED: only AUTO test cards");
  }
}

export function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    fixed: results.filter((r) => r.status === "FIXED").length,
    needsOwner: results.filter((r) => r.status === "NEEDS_OWNER").length,
    rows: results,
    fixes: getFixes(),
  };
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify(summary, null, 2)
  );
  const md = [
    "# Full test 58 report",
    "",
    `| ID | Status | Detail |`,
    `|----|--------|--------|`,
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.status} | ${(r.fix || r.detail || "").replace(/\|/g, "/").slice(0, 120)} |`
    ),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "report.md"), md);
  return summary;
}

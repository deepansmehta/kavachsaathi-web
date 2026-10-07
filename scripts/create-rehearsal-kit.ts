/**
 * Create two rehearsal cards + local test kit under exports/rehearsal/.
 * Never prints activation codes or the preview secret to stdout.
 *
 *   npx tsx scripts/create-rehearsal-kit.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { isActivationExemptHealthId } from "../src/lib/activationGate";

const OUT = path.join(process.cwd(), "exports", "rehearsal");
const BASE = "https://kavachsaathi.in";

const CARDS = [
  { health_id: "KVS-2099-REH01", serial: "R0001", ref: "KS/WL/2026/R0001" },
  { health_id: "KVS-2099-REH02", serial: "R0002", ref: "KS/WL/2026/R0002" },
] as const;

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

function adminDb() {
  loadEnv();
  if (!getApps().length) {
    const sa = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

function randomCode(used: Set<string>): string {
  for (let i = 0; i < 5000; i++) {
    const n = crypto.randomInt(7000, 9999);
    const code = String(n);
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
  throw new Error("Could not allocate activation code");
}

async function uniqueCode(db: FirebaseFirestore.Firestore): Promise<string> {
  const used = new Set<string>();
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = randomCode(used);
    const byId = await db.collection("cards").doc(code).get();
    if (byId.exists) continue;
    const q = await db
      .collection("cards")
      .where("activation_code", "==", code)
      .limit(1)
      .get();
    if (!q.empty) continue;
    return code;
  }
  throw new Error("No free activation code");
}

async function makeQrPng(url: string, serial: string, outPath: string) {
  const qrBuf = await QRCode.toBuffer(url, {
    type: "png",
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const label = Buffer.from(
    `<svg width="780" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="780" height="120" fill="#FAFAF7"/>
      <text x="390" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#0B0812">${serial}</text>
      <text x="390" y="88" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#666">REHEARSAL — NOT FOR SALE</text>
    </svg>`
  );
  const labeled = await sharp(label).png().toBuffer();
  await sharp({
    create: { width: 780, height: 860, channels: 3, background: "#FAFAF7" },
  })
    .composite([
      { input: qrBuf, top: 20, left: 30 },
      { input: labeled, top: 740, left: 0 },
    ])
    .png()
    .toFile(outPath);
}

async function makeWelcomePdf(opts: {
  serial: string;
  ref: string;
  activationCode: string;
  healthId: string;
  outPath: string;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.83, 0.69, 0.22);
  const ink = rgb(0.04, 0.03, 0.07);

  page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: ink });
  page.drawText("KavachSaathi", {
    x: 40,
    y: 804,
    size: 22,
    font: bold,
    color: gold,
  });
  page.drawText("Welcome letter", {
    x: 40,
    y: 786,
    size: 11,
    font,
    color: rgb(0.9, 0.9, 0.88),
  });

  page.drawText("Namaste,", { x: 40, y: 720, size: 14, font: bold, color: ink });
  const lines = [
    "Thank you for choosing KavachSaathi. Your Smart Health Card is ready",
    "to activate. Keep this letter private — it contains your activation code.",
    "",
    `Serial: ${opts.serial}`,
    `Health ID (on QR): ${opts.healthId}`,
    `Ref: ${opts.ref}`,
    "",
    "Your 4-digit activation code (packaging secret):",
  ];
  let y = 690;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: ink });
    y -= 18;
  }
  page.drawText(opts.activationCode, {
    x: 40,
    y: y - 8,
    size: 28,
    font: bold,
    color: gold,
  });
  y -= 50;
  const more = [
    "How to activate:",
    "1. Scan the QR on your card (or open the link on this kit).",
    "2. Enter the 4-digit code above.",
    "3. Complete the 7 steps: medical, photo, IDs, address,",
    "   insurance, consents and PIN.",
    "",
    "Helpline and updates: kavachsaathi.in",
    "",
    "Protect / Inform / Save",
  ];
  for (const line of more) {
    page.drawText(line, { x: 40, y, size: 11, font, color: ink });
    y -= 16;
  }

  page.drawText("REHEARSAL", {
    x: 160,
    y: 320,
    size: 64,
    font: bold,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(35),
    opacity: 0.35,
  });

  fs.writeFileSync(opts.outPath, await doc.save());
}

async function sampleJpg(
  outPath: string,
  label: string,
  w = 640,
  h = 480
) {
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e8e4d9"/>
      <text x="50%" y="45%" text-anchor="middle" font-size="28" font-family="Arial" fill="#333">${label}</text>
      <text x="50%" y="58%" text-anchor="middle" font-size="48" font-family="Arial" font-weight="700" fill="#b00" opacity="0.45">SAMPLE</text>
    </svg>`
  );
  await sharp(svg).jpeg({ quality: 82 }).toFile(outPath);
}

async function samplePdf(outPath: string, title: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 560]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title, { x: 40, y: 480, size: 16, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("SAMPLE — NOT A REAL DOCUMENT", {
    x: 40,
    y: 440,
    size: 12,
    font,
    color: rgb(0.7, 0, 0),
  });
  fs.writeFileSync(outPath, await doc.save());
}

function writeChecklist(outPath: string) {
  const md = `# KavachSaathi — Launch-day rehearsal checklist

Use **Phone A** (customer) and **Phone B** (stranger / hospital).
Files: \`R0001-QR.png\`, \`R0002-QR.png\`, welcome letters, \`rehearsal-codes.txt\`, \`preview-url.txt\`, \`sample-docs/\`.

Mark each step: **PASS** / **FAIL** · Notes: ____

## A. ACTIVATION — card R0001 on Phone A
- [ ] **A1** Scan R0001-QR.png → step 1 opens (no "opens 11 Oct" notice) · ____
- [ ] **A2** Wrong code ×3 → clear error, then captcha · ____
- [ ] **A3** Correct code → step 2 · ____
- [ ] **A4** Medical: blood group, 1 allergy, "Diabetes — insulin dependent", 1 medicine; 2 emergency contacts (one = Phone B) · ____
- [ ] **A5** Photo: selfie via front camera; preview + retake · ____
- [ ] **A6** Same ID type twice → blocked; then PAN + Driving Licence → accepted · ____
- [ ] **A7** Upload wrong-type.jpg → rejected · ____
- [ ] **A8** Refresh at step 4 → data kept OR clear restart (no crash) · ____
- [ ] **A9** Address: "Same as ID 2" (Driving Licence) → accepted · ____
- [ ] **A10** Insurance: private — insurer, policy number, policy card, policy bond PDF · ____
- [ ] **A11** All 3 consents + set PIN → "Card active" · ____
- [ ] **A12** Full activation time: ____ minutes. Confusing? ____

## B. EMERGENCY — Phone B
- [ ] **B1** Scan R0001 → photo, name, RED insulin badge, blood group, call buttons, insurer · ____
- [ ] **B2** NOT visible: policy number, ID numbers, address · ____
- [ ] **B3** Alert Family → WhatsApp/SMS to Phone A · ____
- [ ] **B4** One-tap call to emergency contact · ____
- [ ] **B5** Need Blood → WhatsApp + e-RaktKosh · ____
- [ ] **B6** Large-text + Hindi switch · ____
- [ ] **B7** Opens fast on mobile data · ____

## C. HOSPITAL — Phone B
- [ ] **C1** Full Details → unconscious → insurance ONLY · ____
- [ ] **C2** Full Details → PIN → all details + watermarked docs · ____
- [ ] **C3** IRDAI cashless + admission PDFs open · ____
- [ ] **C4** Wait ~10–15 min → session expiry message · ____

## D. MY PROFILE — Phone A
- [ ] **D1** Open preview-url.txt once · ____
- [ ] **D2** Login mobile+PIN and Health ID+PIN · ____
- [ ] **D3** Wrong PIN ×5 → lockout message · ____
- [ ] **D4** Access log shows C1 + C2 · ____
- [ ] **D5** Edit medicine + photo → Phone B re-scan shows change · ____
- [ ] **D6** Validity = 1 year from today · ____
- [ ] **D7** Vault upload; doc pack + doctor summary PDFs · ____
- [ ] **D8** Car sticker order → requested · ____
- [ ] **D9** Family plan: invite R0002 · ____
- [ ] **D10** Referral code visible · ____
- [ ] **D11** Lost card → blocked on Phone B → unblock · ____
- [ ] **D12** Forgot PIN → new PIN works · ____
- [ ] **D13** Add to Home Screen → offline card · ____
- [ ] **D14** Emergency wallpaper (no IDs/address) · ____

## E. SECOND CARD — R0002
- [ ] **E1** Activate with government scheme + govt card image · ____
- [ ] **E2** Accept family invite from D9 · ____
- [ ] **E3** Easy for an elder? Notes: ____

## F. ADMIN — laptop
- [ ] **F1** /admin Google login · ____
- [ ] **F2** R0001 detail profileComplete + access log · ____
- [ ] **F3** Sticker confirm → print file · ____
- [ ] **F4** CSV has no ID/policy/address · ____
- [ ] **F5** Analytics does not count rehearsal · ____

## G. FINISH
- [ ] **G1** Open \`?preview=off\` on Phone A · ____
- [ ] **G2** Tell Cursor: "run cleanup-rehearsal" → confirm real unactivated = 500 · ____
`;
  fs.writeFileSync(outPath, md);
}

function readPreviewSecret(): string {
  try {
    const raw = execSync(
      "netlify env:list --context production --json",
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const j = JSON.parse(raw) as Record<string, string>;
    const s = String(j.PRELAUNCH_PREVIEW_SECRET || "").trim();
    if (s.length < 16) throw new Error("PRELAUNCH_PREVIEW_SECRET missing/short");
    return s;
  } catch (e) {
    throw new Error(
      "Could not read PRELAUNCH_PREVIEW_SECRET from Netlify production env"
    );
  }
}

async function main() {
  for (const c of CARDS) {
    if (!isActivationExemptHealthId(c.health_id)) {
      throw new Error(`${c.health_id} is NOT activation-exempt — abort`);
    }
  }

  fs.mkdirSync(path.join(OUT, "sample-docs"), { recursive: true });
  const db = adminDb();
  const codes: { serial: string; health_id: string; activation_code: string }[] =
    [];

  for (const c of CARDS) {
    const activation_code = await uniqueCode(db);
    const ref = db.collection("cards").doc(c.health_id);
    await ref.set(
      {
        health_id: c.health_id,
        activation_code,
        serial: c.serial,
        status: "unactivated",
        tier: "STANDARD",
        batch: null,
        user_uid: null,
        linkedProfileId: null,
        activated_at: null,
        isDemo: false,
        isRehearsal: true,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: false }
    );
    codes.push({
      serial: c.serial,
      health_id: c.health_id,
      activation_code,
    });

    await makeQrPng(
      `${BASE}/card/${c.health_id}`,
      c.serial,
      path.join(OUT, `${c.serial}-QR.png`)
    );
    await makeWelcomePdf({
      serial: c.serial,
      ref: c.ref,
      activationCode: activation_code,
      healthId: c.health_id,
      outPath: path.join(OUT, `${c.serial}-Welcome-Letter.pdf`),
    });
    console.log(`wrote ${c.serial}-QR.png + welcome letter; card status=unactivated`);
  }

  fs.writeFileSync(
    path.join(OUT, "rehearsal-codes.txt"),
    codes
      .map(
        (c) =>
          `${c.serial}\t${c.health_id}\tactivation_code=${c.activation_code}`
      )
      .join("\n") + "\n"
  );
  console.log("wrote rehearsal-codes.txt (local only)");

  const secret = readPreviewSecret();
  fs.writeFileSync(
    path.join(OUT, "preview-url.txt"),
    `${BASE}/my-profile?preview=${secret}\n`
  );
  console.log("wrote preview-url.txt (local only)");

  const sd = path.join(OUT, "sample-docs");
  await sampleJpg(path.join(sd, "selfie.jpg"), "Selfie");
  await sampleJpg(path.join(sd, "id-pan.jpg"), "PAN SAMPLE");
  await sampleJpg(path.join(sd, "id-dl-front.jpg"), "DL FRONT");
  await sampleJpg(path.join(sd, "id-dl-back.jpg"), "DL BACK");
  await sampleJpg(path.join(sd, "address-proof.jpg"), "Address proof");
  await sampleJpg(path.join(sd, "policy-card.jpg"), "Policy card");
  await samplePdf(path.join(sd, "policy-bond.pdf"), "SAMPLE POLICY BOND");
  await sampleJpg(path.join(sd, "govt-card.jpg"), "Ayushman card");
  fs.writeFileSync(
    path.join(sd, "wrong-type.jpg"),
    Buffer.from("This is not an image file — rejection test\n")
  );
  console.log("wrote sample-docs/");

  writeChecklist(path.join(OUT, "TESTER-CHECKLIST.md"));
  console.log("wrote TESTER-CHECKLIST.md");
  console.log("DONE — kit in exports/rehearsal/ (gitignored)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

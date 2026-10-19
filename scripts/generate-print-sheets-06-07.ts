/**
 * Generate Set 06 / Set 07 confidential 3×3 print PDFs + CSVs.
 * Reads cards from Firestore; writes ONLY under exports/print-batches/ (gitignored).
 * Never prints activation codes to stdout.
 *
 *   npx tsx scripts/generate-print-sheets-06-07.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execFileSync } from "child_process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import QRCode from "qrcode";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import * as fontkitNs from "@pdf-lib/fontkit";

type FontkitLike = { create: (...args: unknown[]) => unknown };
const fontkit = ((fontkitNs as { default?: FontkitLike }).default ??
  fontkitNs) as FontkitLike;

const ROOT = process.cwd();
const BASE_URL = "https://kavachsaathi.in";
const OUT_ROOT = path.join(ROOT, "exports", "print-batches");

const PAGE_W = 594.96;
const PAGE_H = 841.92;

const INK = rgb(0.0431, 0.0314, 0.0706);
const TITLE = rgb(0.114, 0.106, 0.133);
const GOLD = rgb(0.7216, 0.5255, 0.0431);
const CONF_GOLD = rgb(0.91, 0.749, 0.243);
const CREAM = rgb(0.851, 0.8235, 0.7333);
const CODE_BG = rgb(0.9922, 0.9647, 0.8627);
const MUTED = rgb(0.373, 0.361, 0.4);
const WHITE = rgb(1, 1, 1);

type CardRow = {
  docId: string;
  serial: string;
  batch: number;
  health_id: string;
  activation_code: string;
  setOf: number; // 1..100 within set
};

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
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
      fs.readFileSync(path.join(ROOT, "service-account.json"), "utf8")
    );
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return getFirestore();
}

/** Letter-space words without exploding existing spaces into gaps. */
function spaced(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.split("").join(" "))
    .join("  ");
}

function tileOrigins(): Array<{ x: number; yTop: number; w: number; h: number }> {
  // fitz top-left → convert to pdf-lib bottom-left when drawing
  const tiles = [
    [28.5, 79.5, 172.5, 216.8],
    [212.2, 79.5, 171.8, 216.8],
    [395.2, 79.5, 172.5, 216.8],
    [28.5, 308.2, 172.5, 216.8],
    [212.2, 308.2, 171.8, 216.8],
    [395.2, 308.2, 172.5, 216.8],
    [28.5, 536.2, 172.5, 217.5],
    [212.2, 536.2, 171.8, 217.5],
    [395.2, 536.2, 172.5, 217.5],
  ] as const;
  return tiles.map(([x, yTop, w, h]) => ({ x, yTop, w, h }));
}

async function loadFonts(pdf: PDFDocument): Promise<{
  sans: PDFFont;
  sansBold: PDFFont;
  monoBold: PDFFont;
}> {
  pdf.registerFontkit(fontkit);
  const arial = "/System/Library/Fonts/Supplemental/Arial.ttf";
  const arialBold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
  const courierBold = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf";
  const sans = await pdf.embedFont(fs.readFileSync(arial), { subset: true });
  const sansBold = await pdf.embedFont(fs.readFileSync(arialBold), {
    subset: true,
  });
  const monoBold = await pdf.embedFont(fs.readFileSync(courierBold), {
    subset: true,
  });
  return { sans, sansBold, monoBold };
}

function drawDashedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: ReturnType<typeof rgb>
) {
  const dash = 2.2;
  const gap = 1.6;
  const drawH = (x0: number, x1: number, yy: number) => {
    let cx = x0;
    while (cx < x1) {
      const nx = Math.min(cx + dash, x1);
      page.drawLine({
        start: { x: cx, y: yy },
        end: { x: nx, y: yy },
        thickness: 0.75,
        color,
      });
      cx = nx + gap;
    }
  };
  const drawV = (xx: number, y0: number, y1: number) => {
    let cy = y0;
    while (cy < y1) {
      const ny = Math.min(cy + dash, y1);
      page.drawLine({
        start: { x: xx, y: cy },
        end: { x: xx, y: ny },
        thickness: 0.75,
        color,
      });
      cy = ny + gap;
    }
  };
  drawH(x, x + w, y);
  drawH(x, x + w, y + h);
  drawV(x, y, y + h);
  drawV(x + w, y, y + h);
}

async function drawTile(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Awaited<ReturnType<typeof loadFonts>>,
  tile: { x: number; yTop: number; w: number; h: number },
  card: CardRow,
  setNum: number
) {
  const y = PAGE_H - tile.yTop - tile.h; // bottom-left of tile
  const stripH = 14;

  // cream body + thin border via dark underlay
  page.drawRectangle({
    x: tile.x,
    y,
    width: tile.w,
    height: tile.h,
    color: INK,
  });
  page.drawRectangle({
    x: tile.x + 0.6,
    y: y + 0.6,
    width: tile.w - 1.2,
    height: tile.h - 1.2,
    color: CREAM,
  });
  // black top strip
  page.drawRectangle({
    x: tile.x + 0.6,
    y: y + tile.h - stripH - 0.6,
    width: tile.w - 1.2,
    height: stripH,
    color: INK,
  });

  const label = `SET ${String(setNum).padStart(2, "0")} · CARD ${String(card.setOf).padStart(3, "0")} OF 100`;
  const labelSp = spaced(label);
  const labelSize = 6.2;
  const labelW = fonts.sansBold.widthOfTextAtSize(labelSp, labelSize);
  page.drawText(labelSp, {
    x: tile.x + (tile.w - labelW) / 2,
    y: y + tile.h - stripH - 14,
    size: labelSize,
    font: fonts.sansBold,
    color: GOLD,
  });

  // QR
  const url = `${BASE_URL}/card/${card.health_id}`;
  const qrPng = await QRCode.toBuffer(url, {
    type: "png",
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const qrImg = await pdf.embedPng(qrPng);
  const qrSize = 119.1;
  const qrX = tile.x + (tile.w - qrSize) / 2;
  const qrY = y + tile.h - stripH - 14 - 8 - qrSize;
  page.drawRectangle({
    x: qrX - 2,
    y: qrY - 2,
    width: qrSize + 4,
    height: qrSize + 4,
    color: WHITE,
  });
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // CARD NUMBER
  const cnLabel = spaced("CARD NUMBER");
  const cnLabelSize = 6.5;
  const cnLabelW = fonts.sans.widthOfTextAtSize(cnLabel, cnLabelSize);
  const cnY = qrY - 16;
  page.drawText(cnLabel, {
    x: tile.x + (tile.w - cnLabelW) / 2,
    y: cnY,
    size: cnLabelSize,
    font: fonts.sans,
    color: MUTED,
  });
  const hidSize = 10.5;
  const hidW = fonts.monoBold.widthOfTextAtSize(card.health_id, hidSize);
  page.drawText(card.health_id, {
    x: tile.x + (tile.w - hidW) / 2,
    y: cnY - 13,
    size: hidSize,
    font: fonts.monoBold,
    color: TITLE,
  });

  // ACTIVATION CODE
  const acLabel = spaced("ACTIVATION CODE");
  const acLabelW = fonts.sans.widthOfTextAtSize(acLabel, cnLabelSize);
  const acLabelY = cnY - 28;
  page.drawText(acLabel, {
    x: tile.x + (tile.w - acLabelW) / 2,
    y: acLabelY,
    size: cnLabelSize,
    font: fonts.sans,
    color: MUTED,
  });

  const boxW = 69;
  const boxH = 23.2;
  const boxX = tile.x + (tile.w - boxW) / 2;
  const boxY = y + 8.5;
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: CODE_BG,
  });
  drawDashedRect(page, boxX, boxY, boxW, boxH, GOLD);

  const codeSp = spaced(card.activation_code);
  const codeSize = 15;
  const codeW = fonts.monoBold.widthOfTextAtSize(codeSp, codeSize);
  page.drawText(codeSp, {
    x: boxX + (boxW - codeW) / 2,
    y: boxY + 6.5,
    size: codeSize,
    font: fonts.monoBold,
    color: INK,
  });
}

async function buildSheetPdf(
  cards: CardRow[],
  setNum: number,
  outPath: string
): Promise<number> {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const origins = tileOrigins();
  const pagesNeeded = Math.ceil(cards.length / 9);

  for (let p = 0; p < pagesNeeded; p++) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const title1 = "KAVACHSAATHI · 100 CARDS — QR, CARD NUMBER &";
    const title2 = "ACTIVATION CODE";
    page.drawText(title1, {
      x: 28.5,
      y: PAGE_H - 40,
      size: 13,
      font: fonts.sansBold,
      color: TITLE,
    });
    page.drawText(title2, {
      x: 28.5,
      y: PAGE_H - 54,
      size: 13,
      font: fonts.sansBold,
      color: TITLE,
    });

    // CONFIDENTIAL badge
    const badgeX = 480.75;
    const badgeY = PAGE_H - 52.5;
    const badgeW = 87;
    const badgeH = 16.5;
    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      color: INK,
    });
    const conf = spaced("CONFIDENTIAL");
    const confSize = 7.5;
    const confW = fonts.sansBold.widthOfTextAtSize(conf, confSize);
    page.drawText(conf, {
      x: badgeX + (badgeW - confW) / 2,
      y: badgeY + 4.5,
      size: confSize,
      font: fonts.sansBold,
      color: CONF_GOLD,
    });

    // gold rule
    page.drawRectangle({
      x: 28.5,
      y: PAGE_H - 68.25,
      width: 539.25,
      height: 2.25,
      color: GOLD,
    });

    const slice = cards.slice(p * 9, p * 9 + 9);
    for (let i = 0; i < slice.length; i++) {
      await drawTile(pdf, page, fonts, origins[i], slice[i], setNum);
    }

    // footer set marker (tiny, outside cut area)
    page.drawText(`SET ${String(setNum).padStart(2, "0")} · PAGE ${p + 1}/${pagesNeeded}`, {
      x: 28.5,
      y: 14,
      size: 7,
      font: fonts.sans,
      color: MUTED,
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, await pdf.save());
  return pagesNeeded;
}

function writeCsv(cards: CardRow[], outPath: string) {
  const lines = [
    "serial,batch,set_card,health_id,activation_code,url",
    ...cards.map(
      (c) =>
        `${c.serial},${c.batch},${c.setOf},${c.health_id},${c.activation_code},${BASE_URL}/card/${c.health_id}`
    ),
  ];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}

function copySharedBacks(setDir: string) {
  const src = path.join(
    ROOT,
    "exports",
    "final-100",
    "KavachSaathi-Welcome-Letter-BACK-Guide-and-About.pdf"
  );
  if (!fs.existsSync(src)) {
    console.log("welcome_back: SKIP (source missing)");
    return;
  }
  const dest = path.join(
    setDir,
    "KavachSaathi-Welcome-Letter-BACK-Guide-and-About.pdf"
  );
  fs.copyFileSync(src, dest);
  console.log(`welcome_back: ${dest}`);
}

/**
 * Decode every embedded QR image in the PDF (9 per page) with jsQR.
 * Counts only — never logs URLs or codes.
 */
function verifyPdfQrs(
  pdfPath: string,
  expected: CardRow[]
): { ok: number; total: number; pages: number } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PNG } = require("pngjs") as {
    PNG: { sync: { read: (b: Buffer) => { data: Buffer; width: number; height: number } } };
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jsQR = require("jsqr") as (
    data: Uint8ClampedArray,
    w: number,
    h: number,
    opts?: { inversionAttempts?: string }
  ) => { data: string } | null;

  const extractPy = `
import sys, json, fitz
pdf_path = sys.argv[1]
out_dir = sys.argv[2]
doc = fitz.open(pdf_path)
n = 0
for pi in range(doc.page_count):
    page = doc[pi]
    for img in page.get_images(full=True):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)
        if pix.n >= 4:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        path = f"{out_dir}/qr_{n:04d}.png"
        pix.save(path)
        n += 1
print(json.dumps({"pages": doc.page_count, "images": n}))
`;
  const tmpDir = path.join(OUT_ROOT, `_qr_extract_${Date.now()}`);
  const tmpPy = path.join(OUT_ROOT, "_extract_qr_tmp.py");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(tmpPy, extractPy, "utf8");
  try {
    const metaOut = execFileSync("python3", [tmpPy, pdfPath, tmpDir], {
      encoding: "utf8",
    });
    const meta = JSON.parse(metaOut.trim().split("\n").pop() || "{}") as {
      pages: number;
      images: number;
    };
    let ok = 0;
    for (let i = 0; i < expected.length; i++) {
      const pngPath = path.join(tmpDir, `qr_${String(i).padStart(4, "0")}.png`);
      if (!fs.existsSync(pngPath)) continue;
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
        { inversionAttempts: "attemptBoth" }
      );
      const want = `${BASE_URL}/card/${expected[i].health_id}`;
      if (code?.data === want) ok += 1;
    }
    return { ok, total: expected.length, pages: meta.pages || 0 };
  } finally {
    try {
      fs.unlinkSync(tmpPy);
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const db = adminDb();
  const snap = await db.collection("cards").get();

  const setCards: Record<number, CardRow[]> = { 6: [], 7: [] };

  for (const d of snap.docs) {
    const data = d.data();
    const hid = String(data.health_id || "").toUpperCase();
    if (!/^KVS-2026-/.test(hid)) continue;
    const n = Number(d.id);
    if (!Number.isFinite(n) || n < 501 || n > 700) continue;
    const batch = Number(data.batch) || (n <= 600 ? 6 : 7);
    const setOf = batch === 6 ? n - 500 : n - 600;
    setCards[batch].push({
      docId: d.id,
      serial: String(data.serial || `A${String(n).padStart(4, "0")}`),
      batch,
      health_id: hid,
      activation_code: String(data.activation_code || d.id)
        .padStart(4, "0")
        .slice(0, 4),
      setOf,
    });
  }

  for (const b of [6, 7] as const) {
    setCards[b].sort((a, c) => a.setOf - c.setOf);
  }

  console.log("=== PRINT SHEETS SET 06–07 ===");
  console.log(`set06_cards: ${setCards[6].length}`);
  console.log(`set07_cards: ${setCards[7].length}`);

  if (setCards[6].length !== 100 || setCards[7].length !== 100) {
    throw new Error("REFUSED: need exactly 100 cards per set in Firestore");
  }

  const results: Array<{
    set: number;
    pdf: string;
    csv: string;
    pages: number;
    qrOk: number;
    qrTotal: number;
  }> = [];

  for (const setNum of [6, 7] as const) {
    const cards = setCards[setNum];
    const setDir = path.join(OUT_ROOT, `Set-${String(setNum).padStart(2, "0")}`);
    fs.mkdirSync(setDir, { recursive: true });

    const pdfName = `KavachSaathi-Set${String(setNum).padStart(2, "0")}-100-Cards-QR-CardNo-ActivationCode.pdf`;
    const csvName = `KavachSaathi-Set${String(setNum).padStart(2, "0")}-100-Cards-welcome-letter.csv`;
    const pdfPath = path.join(OUT_ROOT, pdfName);
    const csvPath = path.join(OUT_ROOT, csvName);

    const pages = await buildSheetPdf(cards, setNum, pdfPath);
    writeCsv(cards, csvPath);
    // also keep set-folder copies
    fs.copyFileSync(pdfPath, path.join(setDir, pdfName));
    fs.copyFileSync(csvPath, path.join(setDir, csvName));
    copySharedBacks(setDir);

    const idsFp = crypto
      .createHash("sha256")
      .update(cards.map((c) => c.health_id).sort().join("\n"))
      .digest("hex")
      .slice(0, 16);

    console.log(`set${String(setNum).padStart(2, "0")}_pdf: ${pdfPath}`);
    console.log(`set${String(setNum).padStart(2, "0")}_csv: ${csvPath}`);
    console.log(`set${String(setNum).padStart(2, "0")}_pages: ${pages}`);
    console.log(`set${String(setNum).padStart(2, "0")}_id_fingerprint: ${idsFp}`);

    const v = verifyPdfQrs(pdfPath, cards);
    console.log(
      `set${String(setNum).padStart(2, "0")}_qr_verify: ${v.ok}/${v.total} pages=${v.pages}`
    );
    results.push({
      set: setNum,
      pdf: pdfPath,
      csv: csvPath,
      pages: v.pages,
      qrOk: v.ok,
      qrTotal: v.total,
    });
  }

  const qrAll = results.reduce((s, r) => s + r.qrOk, 0);
  const qrTot = results.reduce((s, r) => s + r.qrTotal, 0);
  const pagesOk = results.every((r) => r.pages === 12);
  console.log(`qr_verify_total: ${qrAll}/${qrTot}`);
  console.log(`pages_12_plus_12: ${pagesOk ? "OK" : "FAIL"}`);
  console.log(
    "welcome_kit_generator: ABSENT — copied shared Welcome-Letter BACK only"
  );

  const pass = qrAll === 200 && qrTot === 200 && pagesOk;
  console.log(`summary: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

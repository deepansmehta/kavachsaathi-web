import "regenerator-runtime/runtime";
import fs from "fs";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  degrees,
  type RGB,
} from "pdf-lib";
import * as fontkitNs from "@pdf-lib/fontkit";

type FontkitLike = { create: (...args: unknown[]) => unknown };
// Interop-safe: CJS/ESM bundlers disagree on default export shape
const fontkit = ((fontkitNs as { default?: FontkitLike }).default ??
  fontkitNs) as FontkitLike;

export const A4 = { width: 595.28, height: 841.89 };
export const MARGIN = 36;
export const FOOTER_H = 42;
export const ink: RGB = rgb(0.08, 0.08, 0.1);
export const muted: RGB = rgb(0.35, 0.35, 0.38);
export const lineColor: RGB = rgb(0.55, 0.55, 0.58);

export type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
  unicode: PDFFont;
};

export function blank(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s === "undefined" || s === "null" || s === "NaN") return "";
  return s;
}

export function ageFromDob(dob: string | null | undefined): {
  years: string;
  months: string;
} {
  const raw = blank(dob);
  if (!raw) return { years: "", months: "" };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { years: "", months: "" };
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: "", months: "" };
  return { years: String(years), months: String(Math.max(0, months)) };
}

export function formatIstStamp(d = new Date()): string {
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

export function footerText(stamp: string): string {
  return `Patient details pre-filled by KavachSaathi from the cardholder's profile on ${stamp}. Hospital must verify details with the patient/attendant.`;
}

function readFontFile(name: string): Buffer {
  // Absolute paths from process.cwd() only (Netlify serverless-safe)
  const candidates = [
    path.join(process.cwd(), "public", "fonts", name),
    path.join(process.cwd(), "src", "lib", "fonts", name),
  ];
  for (const abs of candidates) {
    if (fs.existsSync(abs)) return fs.readFileSync(abs);
  }
  throw new Error(
    `Font not found: ${name} (cwd=${process.cwd()} tried=${candidates.join(",")})`
  );
}

export async function createPdfDoc(): Promise<{
  pdf: PDFDocument;
  fonts: PdfFonts;
}> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as Parameters<typeof pdf.registerFontkit>[0]);
  const unicode = await pdf.embedFont(
    readFontFile("NotoSansDevanagari-Regular.ttf")
  );
  const regular = await pdf.embedFont(readFontFile("NotoSans-Regular.ttf"));
  const bold = regular;
  return { pdf, fonts: { regular, bold, unicode } };
}

export function pickFont(fonts: PdfFonts, text: string): PDFFont {
  // Pure Devanagari → unicode font; otherwise prefer Noto Sans (Latin + digits)
  if (/^[\u0900-\u097F\s.,\-_/()]+$/.test(text) && /[\u0900-\u097F]/.test(text)) {
    return fonts.unicode;
  }
  return fonts.regular;
}

/** Split into Devanagari vs other runs so mixed Hindi+Latin never tofu. */
export function scriptRuns(text: string): { text: string; dev: boolean }[] {
  const s = blank(text);
  if (!s) return [];
  const runs: { text: string; dev: boolean }[] = [];
  let cur = "";
  let curDev: boolean | null = null;
  for (const ch of s) {
    const isDev = /[\u0900-\u097F]/.test(ch);
    // spaces/punctuation stick to current run (avoid splitting Hindi around commas)
    if (/[\s.,;:!?'"\-_/()]/.test(ch)) {
      cur += ch;
      continue;
    }
    if (curDev === null) {
      curDev = isDev;
      cur = ch;
    } else if (isDev === curDev) {
      cur += ch;
    } else {
      runs.push({ text: cur, dev: curDev });
      cur = ch;
      curDev = isDev;
    }
  }
  if (cur && curDev !== null) runs.push({ text: cur, dev: curDev });
  return runs;
}

export function widthOfMixed(
  fonts: PdfFonts,
  text: string,
  size: number
): number {
  return scriptRuns(text).reduce((w, r) => {
    if (!r.text.trim()) {
      return w + fonts.regular.widthOfTextAtSize(r.text || " ", size);
    }
    const f = r.dev ? fonts.unicode : fonts.regular;
    try {
      return w + f.widthOfTextAtSize(r.text, size);
    } catch {
      return w + fonts.regular.widthOfTextAtSize(r.text.replace(/[^\x00-\x7F]/g, "?"), size);
    }
  }, 0);
}

export function drawMixedText(
  page: PDFPage,
  fonts: PdfFonts,
  text: string,
  x: number,
  y: number,
  size: number,
  color: RGB = ink
) {
  let cx = x;
  for (const r of scriptRuns(text)) {
    if (!r.text) continue;
    const f = r.dev ? fonts.unicode : fonts.regular;
    try {
      page.drawText(r.text, { x: cx, y, size, font: f, color });
      cx += f.widthOfTextAtSize(r.text, size);
    } catch {
      const safe = r.text.replace(/[^\x00-\x7F]/g, "?");
      page.drawText(safe, {
        x: cx,
        y,
        size,
        font: fonts.regular,
        color,
      });
      cx += fonts.regular.widthOfTextAtSize(safe, size);
    }
  }
}

export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  fonts?: PdfFonts
): string[] {
  const raw = blank(text);
  if (!raw) return [];
  const measure = (s: string) =>
    fonts ? widthOfMixed(fonts, s, size) : font.widthOfTextAtSize(s, size);
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (measure(trial) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      if (measure(w) <= maxWidth) {
        cur = w;
      } else if (/[\u0900-\u097F]/.test(w)) {
        // Never hard-break Devanagari clusters (fontkit GPOS crashes on partial syllables)
        lines.push(w);
        cur = "";
      } else {
        let chunk = "";
        for (const ch of w) {
          const t2 = chunk + ch;
          if (measure(t2) <= maxWidth) chunk = t2;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        cur = chunk;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawWatermark(page: PDFPage) {
  const { width, height } = page.getSize();
  page.drawText("KavachSaathi", {
    x: width / 2 - 90,
    y: height / 2,
    size: 48,
    color: rgb(0.85, 0.85, 0.88),
    rotate: degrees(-32),
    opacity: 0.18,
  });
}

export function drawFooter(page: PDFPage, fonts: PdfFonts, stamp: string) {
  const { width } = page.getSize();
  const text = footerText(stamp);
  const size = 7;
  const maxW = width - MARGIN * 2;
  const lines = wrapText(text, fonts.regular, size, maxW);
  let y = 28;
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_H },
    end: { x: width - MARGIN, y: FOOTER_H },
    thickness: 0.5,
    color: lineColor,
  });
  for (let i = lines.length - 1; i >= 0; i--) {
    page.drawText(lines[i], {
      x: MARGIN,
      y,
      size,
      font: fonts.regular,
      color: muted,
    });
    y += 9;
  }
}

export function drawLineField(
  page: PDFPage,
  fonts: PdfFonts,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 9
): number {
  const labelText = label;
  page.drawText(labelText, {
    x,
    y,
    size,
    font: fonts.regular,
    color: ink,
  });
  const labelW = fonts.regular.widthOfTextAtSize(labelText, size);
  const boxX = x + labelW + 4;
  const boxW = Math.max(40, width - labelW - 4);
  const val = blank(value);
  const lines = val
    ? wrapText(val, fonts.regular, size, boxW - 4, fonts)
    : [];
  const lineY = y - 2;
  page.drawLine({
    start: { x: boxX, y: lineY },
    end: { x: boxX + boxW, y: lineY },
    thickness: 0.6,
    color: lineColor,
  });
  if (lines[0]) {
    drawMixedText(page, fonts, lines[0], boxX + 2, y, size, ink);
  }
  let used = 14;
  for (let i = 1; i < lines.length; i++) {
    const yy = y - i * 12;
    page.drawLine({
      start: { x: boxX, y: yy - 2 },
      end: { x: boxX + boxW, y: yy - 2 },
      thickness: 0.5,
      color: lineColor,
    });
    drawMixedText(page, fonts, lines[i], boxX + 2, yy, size, ink);
    used += 12;
  }
  return used;
}

export function drawCheckboxRow(
  page: PDFPage,
  fonts: PdfFonts,
  label: string,
  options: { text: string; checked: boolean }[],
  x: number,
  y: number
) {
  page.drawText(label, { x, y, size: 9, font: fonts.regular, color: ink });
  let cx = x + fonts.regular.widthOfTextAtSize(label, 9) + 10;
  for (const opt of options) {
    page.drawRectangle({
      x: cx,
      y: y - 1,
      width: 9,
      height: 9,
      borderColor: ink,
      borderWidth: 0.8,
    });
    if (opt.checked) {
      page.drawText("X", {
        x: cx + 1.5,
        y: y,
        size: 8,
        font: fonts.regular,
        color: ink,
      });
    }
    page.drawText(opt.text, {
      x: cx + 12,
      y,
      size: 9,
      font: fonts.regular,
      color: ink,
    });
    cx += 12 + fonts.regular.widthOfTextAtSize(opt.text, 9) + 14;
  }
}

export function drawBlankBox(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number
) {
  page.drawRectangle({
    x,
    y: y - h,
    width: w,
    height: h,
    borderColor: lineColor,
    borderWidth: 0.7,
  });
}

export function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    Pragma: "no-cache",
  };
}

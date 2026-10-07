/**
 * F17 — Bill Request Letter PDF Builder
 * English + Hindi letter + checklist page.
 */

import { rgb } from "pdf-lib";
import {
  createPdfDoc,
  blank,
  wrapText,
  drawMixedText,
  widthOfMixed,
  drawWatermark,
  drawFooter,
  formatIstStamp,
  noStoreHeaders,
  A4,
  MARGIN,
  ink,
  muted,
} from "@/lib/forms/pdfCommon";
import {
  buildEnglishLetter,
  buildHindiLetter,
  BILL_CHECK_ITEMS,
  BILL_LETTER_DISCLAIMER,
  type BillLetterParams,
} from "@/lib/patientEase/billLetter";

const BODY_WIDTH = A4.width - MARGIN * 2;
const LINE_H = 14;
const SECTION_COLOR = rgb(0.1, 0.35, 0.65);

function drawLetterPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  fonts: Awaited<ReturnType<typeof createPdfDoc>>["fonts"],
  text: string,
  title: string,
  stamp: string
) {
  void params; // not used — we call page.drawText etc.
  return { text, fonts, title, stamp };
}
void drawLetterPage;

export async function buildBillLetterPdf(
  params: BillLetterParams
): Promise<{ bytes: Uint8Array; headers: Record<string, string> }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();

  // ── Page 1: English Letter ─────────────────────────────────────────────
  const page1 = pdf.addPage([A4.width, A4.height]);
  drawWatermark(page1);
  let y = A4.height - MARGIN;

  // Header
  page1.drawText("KavachSaathi — Bill Request Letter", {
    x: MARGIN,
    y,
    size: 14,
    font: fonts.bold,
    color: SECTION_COLOR,
  });
  y -= 20;

  // English letter body
  const englishText = buildEnglishLetter(params);
  const lines = englishText.split("\n");
  for (const line of lines) {
    if (y < 80) break;
    if (blank(line) === "") {
      y -= LINE_H * 0.6;
      continue;
    }
    const wrapped = wrapText(line, fonts.regular, 9.5, BODY_WIDTH, fonts);
    for (const wl of wrapped) {
      if (y < 80) break;
      drawMixedText(page1, fonts, wl, MARGIN, y, 9.5, ink);
      y -= LINE_H;
    }
  }

  drawFooter(page1, fonts, stamp);

  // ── Page 2: Hindi Letter ──────────────────────────────────────────────
  const page2 = pdf.addPage([A4.width, A4.height]);
  drawWatermark(page2);
  y = A4.height - MARGIN;

  page2.drawText("KavachSaathi — बिल अनुरोध पत्र (हिंदी)", {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.unicode,
    color: SECTION_COLOR,
  });
  y -= 22;

  const hindiText = buildHindiLetter(params);
  const hindiLines = hindiText.split("\n");
  for (const line of hindiLines) {
    if (y < 80) break;
    if (blank(line) === "") {
      y -= LINE_H * 0.6;
      continue;
    }
    const wrapped = wrapText(line, fonts.unicode, 9.5, BODY_WIDTH, fonts);
    for (const wl of wrapped) {
      if (y < 80) break;
      drawMixedText(page2, fonts, wl, MARGIN, y, 9.5, ink);
      y -= LINE_H;
    }
  }

  drawFooter(page2, fonts, stamp);

  // ── Page 3: Bill Verification Checklist ──────────────────────────────
  const page3 = pdf.addPage([A4.width, A4.height]);
  drawWatermark(page3);
  y = A4.height - MARGIN;

  page3.drawText("Bill Verification Checklist / बिल जाँच सूची", {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.bold,
    color: SECTION_COLOR,
  });
  y -= 8;
  page3.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.width - MARGIN, y },
    thickness: 0.8,
    color: SECTION_COLOR,
  });
  y -= 20;

  for (const item of BILL_CHECK_ITEMS) {
    if (y < 80) break;
    // Checkbox square
    page3.drawRectangle({ x: MARGIN, y: y - 2, width: 10, height: 10, borderColor: ink, borderWidth: 0.8 });
    // English label
    const enWrapped = wrapText(item.label, fonts.regular, 9, BODY_WIDTH - 20, fonts);
    drawMixedText(page3, fonts, enWrapped[0] || "", MARGIN + 15, y, 9, ink);
    y -= 12;
    // Hindi label
    const hiWrapped = wrapText(item.labelHi, fonts.unicode, 9, BODY_WIDTH - 20, fonts);
    drawMixedText(page3, fonts, hiWrapped[0] || "", MARGIN + 15, y, 9, muted);
    y -= 18;
  }

  y -= 10;
  // Disclaimer
  const disclLines = wrapText(BILL_LETTER_DISCLAIMER, fonts.regular, 7.5, BODY_WIDTH, fonts);
  page3.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: A4.width - MARGIN, y: y + 4 }, thickness: 0.4, color: muted });
  y -= 4;
  for (const dl of disclLines) {
    drawMixedText(page3, fonts, dl, MARGIN, y, 7.5, muted);
    y -= 10;
  }

  drawFooter(page3, fonts, stamp);

  const bytes = await pdf.save();
  const headers: Record<string, string> = {
    ...noStoreHeaders(),
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="bill-request-letter.pdf"`,
    "Content-Length": String(bytes.length),
  };

  void widthOfMixed; // used via wrapText
  return { bytes, headers };
}

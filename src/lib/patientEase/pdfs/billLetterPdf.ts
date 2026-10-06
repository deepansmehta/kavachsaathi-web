import {
  A4,
  MARGIN,
  blank,
  createPdfDoc,
  drawMixedText,
  ink,
  muted,
  wrapText,
} from "@/lib/forms/pdfCommon";
import {
  BILL_CHECK_ITEMS,
  NOT_LEGAL_ADVICE,
  billLetterEnglish,
  billLetterHindi,
  type BillLetterInput,
} from "@/lib/patientEase/billLetter";

export async function buildBillLetterPdf(input: BillLetterInput): Promise<Uint8Array> {
  const { pdf, fonts } = await createPdfDoc();
  const page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  const maxW = A4.width - MARGIN * 2;
  const drawBlock = (text: string, size = 10) => {
    const lines = wrapText(text, fonts.regular, size, maxW, fonts);
    for (const line of lines) {
      if (y < MARGIN + 40) return;
      drawMixedText(page, fonts, line, MARGIN, y, size, ink);
      y -= size + 4;
    }
    y -= 6;
  };
  drawMixedText(page, fonts, "Bill request letter / बिल अनुरोध पत्र", MARGIN, y, 14, ink);
  y -= 22;
  drawBlock(billLetterEnglish(input), 10);
  y -= 8;
  drawBlock(billLetterHindi(input), 10);
  y -= 10;
  drawMixedText(page, fonts, "Bill-check checklist", MARGIN, y, 12, ink);
  y -= 18;
  for (const item of BILL_CHECK_ITEMS) {
    drawBlock(`☐ ${item.label}`, 10);
  }
  y -= 8;
  drawMixedText(page, fonts, blank(NOT_LEGAL_ADVICE), MARGIN, y, 8, muted);
  return pdf.save();
}

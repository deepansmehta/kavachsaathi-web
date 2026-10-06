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
import { maskAadhaar } from "@/lib/patientEase/documentPack";
import { formatIstStamp } from "@/lib/forms/pdfCommon";

export type DocPackCover = {
  name: string;
  insurer?: string;
  tpa?: string;
  policy?: string;
  memberId?: string;
  aadhaarMasked?: string;
  sections: string[];
  vaultTitles?: string[];
  autoSummaryEn?: string;
  autoSummaryHi?: string;
};

export async function buildDocumentPackPdf(cover: DocPackCover): Promise<Uint8Array> {
  const { pdf, fonts } = await createPdfDoc();
  const page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  const maxW = A4.width - MARGIN * 2;
  const line = (text: string, size = 11) => {
    const lines = wrapText(blank(text), fonts.regular, size, maxW, fonts);
    for (const l of lines) {
      if (y < MARGIN + 30) return;
      drawMixedText(page, fonts, l, MARGIN, y, size, ink);
      y -= size + 4;
    }
  };
  drawMixedText(page, fonts, "KavachSaathi Document Pack", MARGIN, y, 16, ink);
  y -= 24;
  if (cover.autoSummaryEn) {
    line(cover.autoSummaryEn, 10);
    y -= 4;
  }
  if (cover.autoSummaryHi) {
    line(cover.autoSummaryHi, 10);
    y -= 6;
  }
  line(`Name: ${blank(cover.name)}`);
  line(`Insurer: ${blank(cover.insurer)}`);
  line(`TPA: ${blank(cover.tpa)}`);
  line(`Policy: ${blank(cover.policy)}`);
  line(`Member ID: ${blank(cover.memberId)}`);
  line(`Aadhaar: ${blank(cover.aadhaarMasked || maskAadhaar(""))}`);
  line(`Date: ${formatIstStamp()}`);
  y -= 10;
  line(`Sections included: ${cover.sections.join(", ") || "—"}`);
  y -= 8;
  line(
    "Attached forms (cashless / admission) and images are listed below. Generate live PDFs from Full Details when needed.",
    9
  );
  if (cover.vaultTitles?.length) {
    y -= 8;
    line("Latest vault records:", 11);
    for (const t of cover.vaultTitles.slice(0, 3)) line(`• ${t}`, 10);
  }
  y -= 16;
  drawMixedText(
    page,
    fonts,
    "This pack is generated on demand and is not stored on KavachSaathi servers.",
    MARGIN,
    y,
    8,
    muted
  );
  // Extra page with Hindi wrap stress + long text
  const p2 = pdf.addPage([A4.width, A4.height]);
  let y2 = A4.height - MARGIN;
  const hindi =
    "यह दस्तावेज़ पैक मरीज की सहूलियत के लिए है। कृपया बीमाकर्ता / टीपीए से पुष्टि करें। बहुत लंबा पाठ लपेटने का परीक्षण — " +
    "आइटमयुक्त बिल, डिस्चार्ज सारांश, रिपोर्ट्स और फार्मेसी बिल साथ रखें।";
  for (const l of wrapText(hindi, fonts.regular, 11, maxW, fonts)) {
    drawMixedText(p2, fonts, l, MARGIN, y2, 11, ink);
    y2 -= 15;
  }
  return pdf.save();
}

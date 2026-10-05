import {
  A4,
  MARGIN,
  FOOTER_H,
  blank,
  createPdfDoc,
  drawBlankBox,
  drawCheckboxRow,
  drawFooter,
  drawLineField,
  drawMixedText,
  drawWatermark,
  formatIstStamp,
  ink,
  muted,
  lineColor,
  wrapText,
  type PdfFonts,
} from "./pdfCommon";
import type { PDFDocument, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

export interface ClaimPrefillFields {
  // Insured / Patient
  patientName: string;
  gender: string;
  ageYears: string;
  ageMonths: string;
  dateOfBirth: string;
  contact: string;
  alternateContact: string;
  currentAddress: string;
  occupation: string;
  // Insurance
  insurerName: string;
  policyNumber: string;
  policyHolderName: string;
  memberId: string;
  tpaName: string;
  isGroupPolicy: boolean;
  corporateName: string;
  employeeId: string;
  // Medical summary
  familyPhysicianName: string;
  familyPhysicianContact: string;
  familyPhysicianYes: boolean | null;
  otherInsuranceYes: boolean | null;
  otherCompany: string;
  otherPolicyDetails: string;
}

function sectionHeader(
  page: PDFPage,
  fonts: PdfFonts,
  text: string,
  y: number
): number {
  const { width } = page.getSize();
  page.drawRectangle({
    x: MARGIN,
    y: y - 12,
    width: width - MARGIN * 2,
    height: 16,
    color: rgb(0.93, 0.88, 0.65),
    opacity: 0.4,
  });
  page.drawText(text, {
    x: MARGIN + 4,
    y,
    size: 9.5,
    font: fonts.bold,
    color: ink,
  });
  return y - 20;
}

function ensureSpace(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: PdfFonts,
  y: number,
  need: number,
  stamp: string,
  pages: PDFPage[]
): { page: PDFPage; y: number } {
  if (y - need > FOOTER_H + 8) return { page, y };
  drawFooter(page, fonts, stamp);
  const next = pdf.addPage([A4.width, A4.height]);
  drawWatermark(next);
  pages.push(next);
  return { page: next, y: A4.height - MARGIN };
}

/**
 * IRDAI Reimbursement Claim Form — Part A (Insured section pre-filled).
 * Bills / hospital / cost sections intentionally left blank.
 */
export async function buildClaimFormPdf(
  fields: ClaimPrefillFields
): Promise<{ bytes: Uint8Array }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();
  const pages: PDFPage[] = [];
  let page = pdf.addPage([A4.width, A4.height]);
  pages.push(page);
  drawWatermark(page);

  const contentW = A4.width - MARGIN * 2;
  let y = A4.height - MARGIN;
  let used: number;

  // Title
  page.drawText("REIMBURSEMENT CLAIM FORM — PART A", {
    x: MARGIN,
    y,
    size: 12,
    font: fonts.bold,
    color: ink,
  });
  y -= 13;
  page.drawText("(Insured section — pre-filled by KavachSaathi)", {
    x: MARGIN,
    y,
    size: 8.5,
    font: fonts.regular,
    color: muted,
  });
  y -= 9;
  page.drawText("Bills / hospital / physician / cost sections are intentionally blank — to be completed by hospital.", {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: muted,
  });
  y -= 18;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.width - MARGIN, y },
    thickness: 0.8,
    color: lineColor,
  });
  y -= 10;

  // CLAIM DETAILS (blank — to be filled)
  y = sectionHeader(page, fonts, "SECTION 1 — CLAIM DETAILS (hospital to complete)", y);
  for (const label of [
    "Claim reference number:",
    "Date of intimation to insurer:",
    "Date of hospitalisation:",
    "Date of discharge:",
    "Name of hospital / nursing home:",
    "Hospital address:",
    "Hospital registration number:",
  ]) {
    const sp = ensureSpace(pdf, page, fonts, y, 24, stamp, pages);
    page = sp.page;
    y = sp.y;
    used = drawLineField(page, fonts, label, "", MARGIN, y, contentW);
    y -= used + 4;
  }
  y -= 4;

  // INSURED DETAILS (pre-filled)
  y = sectionHeader(page, fonts, "SECTION 2 — INSURED / PATIENT DETAILS (pre-filled)", y);

  const insuredRows: [string, string][] = [
    ["Name of the insured:", fields.patientName],
    ["Policy / group scheme number:", fields.policyNumber],
    ["Policy holder / proposer name:", fields.policyHolderName],
    ["Insurer / TPA name:", [blank(fields.tpaName), blank(fields.insurerName)].filter(Boolean).join(" / ")],
    ["Insured member ID:", fields.memberId],
    ["Contact number:", fields.contact],
    ["Alternate contact:", fields.alternateContact],
    ["Address:", fields.currentAddress],
    ["Occupation:", fields.occupation],
    ["Date of birth:", fields.dateOfBirth],
  ];
  if (fields.isGroupPolicy) {
    insuredRows.push(["Corporate name:", fields.corporateName]);
    insuredRows.push(["Employee ID:", fields.employeeId]);
  }

  for (const [label, val] of insuredRows) {
    const sp = ensureSpace(pdf, page, fonts, y, 24, stamp, pages);
    page = sp.page;
    y = sp.y;
    used = drawLineField(page, fonts, label, val, MARGIN, y, contentW);
    y -= used + 4;
  }

  // Gender + Age on same row
  {
    const sp = ensureSpace(pdf, page, fonts, y, 20, stamp, pages);
    page = sp.page;
    y = sp.y;
    const g = blank(fields.gender);
    drawCheckboxRow(
      page,
      fonts,
      "Gender:",
      [
        { text: "Male", checked: g === "Male" },
        { text: "Female", checked: g === "Female" },
        { text: "Other", checked: g === "Third Gender" },
      ],
      MARGIN,
      y
    );
    used = drawLineField(
      page,
      fonts,
      "Age:",
      blank(fields.ageYears) ? `${fields.ageYears} yrs  ${blank(fields.ageMonths) ? `${fields.ageMonths} mo` : ""}` : "",
      MARGIN + contentW * 0.55,
      y,
      contentW * 0.44
    );
    y -= Math.max(18, used) + 4;
  }

  // Family physician
  {
    const sp = ensureSpace(pdf, page, fonts, y, 20, stamp, pages);
    page = sp.page;
    y = sp.y;
    drawCheckboxRow(
      page,
      fonts,
      "Family physician registered:",
      [
        { text: "Yes", checked: fields.familyPhysicianYes === true },
        { text: "No", checked: fields.familyPhysicianYes === false },
      ],
      MARGIN,
      y
    );
    y -= 18;
    if (fields.familyPhysicianYes === true) {
      used = drawLineField(
        page,
        fonts,
        "Name:",
        fields.familyPhysicianName,
        MARGIN,
        y,
        contentW * 0.55
      );
      drawLineField(
        page,
        fonts,
        "Contact:",
        fields.familyPhysicianContact,
        MARGIN + contentW * 0.57,
        y,
        contentW * 0.43
      );
      y -= Math.max(used, 14) + 4;
    }
  }

  // Other insurance
  {
    const sp = ensureSpace(pdf, page, fonts, y, 40, stamp, pages);
    page = sp.page;
    y = sp.y;
    drawCheckboxRow(
      page,
      fonts,
      "Any other health insurance:",
      [
        { text: "Yes", checked: fields.otherInsuranceYes === true },
        { text: "No", checked: fields.otherInsuranceYes === false },
      ],
      MARGIN,
      y
    );
    y -= 18;
    if (fields.otherInsuranceYes === true) {
      used = drawLineField(
        page,
        fonts,
        "Company:",
        fields.otherCompany,
        MARGIN,
        y,
        contentW
      );
      y -= used + 4;
      used = drawLineField(
        page,
        fonts,
        "Policy / details:",
        fields.otherPolicyDetails,
        MARGIN,
        y,
        contentW
      );
      y -= used + 4;
    }
  }
  y -= 4;

  // SECTION 3 — Illness / treatment (blank)
  y = sectionHeader(page, fonts, "SECTION 3 — ILLNESS / TREATMENT (hospital/doctor to complete)", y);
  for (const label of [
    "Nature of illness / disease:",
    "Provisional diagnosis:",
    "ICD-10 code:",
    "Date of first symptoms:",
    "Pre-existing condition (Y/N):",
    "Details of symptoms:",
    "Line of treatment:  [ ] Medical   [ ] Surgical   [ ] ICU   [ ] Investigation",
    "Duration of hospitalisation (days expected):",
  ]) {
    const sp = ensureSpace(pdf, page, fonts, y, 24, stamp, pages);
    page = sp.page;
    y = sp.y;
    used = drawLineField(page, fonts, label, "", MARGIN, y, contentW);
    y -= used + 4;
  }
  y -= 4;

  // SECTION 4 — Estimated costs (blank)
  y = sectionHeader(page, fonts, "SECTION 4 — ESTIMATED / ACTUAL COSTS (hospital to complete)", y);
  for (const label of [
    "Room & nursing charges (₹):",
    "ICU charges (₹):",
    "Surgeon / anaesthetist / consultation (₹):",
    "Medicines & consumables (₹):",
    "Investigation / diagnostic (₹):",
    "Other charges (₹):",
    "Total estimated cost (₹):",
    "Amount claimed (₹):",
  ]) {
    const sp = ensureSpace(pdf, page, fonts, y, 22, stamp, pages);
    page = sp.page;
    y = sp.y;
    used = drawLineField(page, fonts, label, "", MARGIN, y, contentW);
    y -= used + 4;
  }
  y -= 4;

  // SECTION 5 — Declarations
  y = sectionHeader(page, fonts, "SECTION 5 — DECLARATION BY INSURED", y);
  const decl = [
    "I declare that the information furnished above is true to the best of my knowledge.",
    "I authorise the insurer / TPA to obtain any information relating to this claim from any doctor, hospital, or institution.",
    "I undertake to repay any excess payment found after settlement.",
  ];
  for (const line of decl) {
    const ls = wrapText(line, fonts.regular, 8, contentW);
    for (const ln of ls) {
      const sp = ensureSpace(pdf, page, fonts, y, 12, stamp, pages);
      page = sp.page;
      y = sp.y;
      page.drawText(ln, { x: MARGIN, y, size: 8, font: fonts.regular, color: ink });
      y -= 10;
    }
  }
  y -= 6;

  used = drawLineField(page, fonts, "Name:", blank(fields.patientName), MARGIN, y, contentW * 0.55);
  drawLineField(page, fonts, "Date:", "", MARGIN + contentW * 0.57, y, contentW * 0.43);
  y -= Math.max(used, 14) + 8;

  page.drawText("Signature:", { x: MARGIN, y, size: 9, font: fonts.regular, color: ink });
  drawBlankBox(page, MARGIN + 70, y + 8, 180, 36);
  y -= 50;

  // Notice
  {
    const sp = ensureSpace(pdf, page, fonts, y, 20, stamp, pages);
    page = sp.page;
    y = sp.y;
  }
  const noticeLine =
    "⚠  Patient details pre-filled by KavachSaathi for assistance only. Verify all data. " +
    "KavachSaathi is not party to the insurance contract.";
  const nLines = wrapText(noticeLine, fonts.regular, 7.5, contentW);
  for (const ln of nLines) {
    page.drawText(ln, { x: MARGIN, y, size: 7.5, font: fonts.regular, color: muted });
    y -= 9;
  }

  for (const p of pages) drawFooter(p, fonts, stamp);
  void drawMixedText; // keep import

  const bytes = await pdf.save();
  return { bytes };
}

export function claimFormFilename(): string {
  return "kavachsaathi-claim-form-part-a.pdf";
}

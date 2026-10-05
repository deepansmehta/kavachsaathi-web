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
  drawWatermark,
  formatIstStamp,
  ink,
  wrapText,
  type PdfFonts,
} from "./pdfCommon";
import type { CashlessPatientFields } from "./formData";
import type { PDFDocument, PDFPage } from "pdf-lib";

function sectionTitle(page: PDFPage, fonts: PdfFonts, text: string, y: number) {
  page.drawText(text, {
    x: MARGIN,
    y,
    size: 10,
    font: fonts.regular,
    color: ink,
  });
  return y - 16;
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
 * IRDAI Part C (Revised) — Request for Cashless Hospitalisation.
 * Pre-fills patient/insured section only; hospital/doctor/cost/signatures blank.
 */
export async function buildCashlessFormPdf(
  fields: CashlessPatientFields
): Promise<{ bytes: Uint8Array; textDump: string }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();
  const pages: PDFPage[] = [];
  let page = pdf.addPage([A4.width, A4.height]);
  pages.push(page);
  drawWatermark(page);
  const texts: string[] = [];
  const note = (s: string) => {
    if (blank(s)) texts.push(s);
  };

  const contentW = A4.width - MARGIN * 2;
  let y = A4.height - MARGIN;

  page.drawText(
    "Request for Cashless Hospitalisation for Health Insurance Policy",
    { x: MARGIN, y, size: 11, font: fonts.regular, color: ink }
  );
  y -= 13;
  page.drawText("(IRDAI standard format) — PART C (Revised)", {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: ink,
  });
  y -= 12;
  page.drawText("(TO BE FILLED IN BLOCK LETTERS)", {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: ink,
  });
  y -= 18;

  y = sectionTitle(
    page,
    fonts,
    "DETAILS OF THE THIRD PARTY ADMINISTRATOR / INSURER / HOSPITAL",
    y
  );

  const tpaLine = [blank(fields.tpaName), blank(fields.insurerName)]
    .filter(Boolean)
    .join(" / ");
  note(tpaLine);
  let used = drawLineField(
    page,
    fonts,
    "a. Name of TPA/Insurance Company:",
    tpaLine,
    MARGIN,
    y,
    contentW
  );
  y -= used + 4;
  used = drawLineField(
    page,
    fonts,
    "b. Toll free phone number:",
    "",
    MARGIN,
    y,
    contentW
  );
  y -= used + 4;
  used = drawLineField(page, fonts, "c. Toll free fax:", "", MARGIN, y, contentW);
  y -= used + 4;
  used = drawLineField(
    page,
    fonts,
    "d. Name of Hospital:",
    "",
    MARGIN,
    y,
    contentW
  );
  y -= used + 4;
  used = drawLineField(page, fonts, "   i. Address:", "", MARGIN, y, contentW);
  y -= used + 4;
  used = drawLineField(page, fonts, "   ii. Rohini ID:", "", MARGIN, y, contentW);
  y -= used + 4;
  used = drawLineField(page, fonts, "   iii. e-mail ID:", "", MARGIN, y, contentW);
  y -= used + 14;

  y = sectionTitle(page, fonts, "TO BE FILLED BY INSURED / PATIENT", y);

  const patientRows: [string, string][] = [
    ["A. Name of the Patient:", fields.patientName],
    ["E. Contact number:", fields.contact],
    ["F. Contact number of attending Relative:", fields.alternateContact],
    ["G. Insured Card ID number:", fields.insuredCardId],
    [
      "H. Policy number / Name of Corporate:",
      [blank(fields.policyNumber), blank(fields.corporateName)]
        .filter(Boolean)
        .join(" / "),
    ],
    ["I. Employee ID:", fields.employeeId],
    ["L. Name of the Family Physician:", fields.familyPhysicianName],
    ["M. Contact number, if any:", fields.familyPhysicianContact],
    ["N. Current Address of Insured Patient:", fields.currentAddress],
    ["O. Occupation of Insured Patient:", fields.occupation],
  ];

  for (const [label, val] of patientRows) {
    note(val);
    const space = ensureSpace(pdf, page, fonts, y, 36, stamp, pages);
    page = space.page;
    y = space.y;
    used = drawLineField(page, fonts, label, val, MARGIN, y, contentW);
    y -= used + 5;
  }

  // B Gender
  {
    const space = ensureSpace(pdf, page, fonts, y, 20, stamp, pages);
    page = space.page;
    y = space.y;
    const g = blank(fields.gender);
    note(g);
    drawCheckboxRow(
      page,
      fonts,
      "B. Gender:",
      [
        { text: "Male", checked: g === "Male" },
        { text: "Female", checked: g === "Female" },
        { text: "Third Gender", checked: g === "Third Gender" },
      ],
      MARGIN,
      y
    );
    y -= 16;
  }

  // C Age + D DOB
  {
    const space = ensureSpace(pdf, page, fonts, y, 20, stamp, pages);
    page = space.page;
    y = space.y;
    const ageStr = [
      blank(fields.ageYears) ? `${fields.ageYears} Years` : "____ Years",
      blank(fields.ageMonths) ? `${fields.ageMonths} Month` : "____ Month",
    ].join("  ");
    note(fields.ageYears);
    note(fields.dateOfBirth);
    used = drawLineField(
      page,
      fonts,
      "C. Age:",
      ageStr.includes("____") && !fields.ageYears ? "" : `${blank(fields.ageYears)} Years  ${blank(fields.ageMonths)} Month`,
      MARGIN,
      y,
      contentW * 0.48
    );
    drawLineField(
      page,
      fonts,
      "D. Date of Birth:",
      fields.dateOfBirth,
      MARGIN + contentW * 0.5,
      y,
      contentW * 0.5
    );
    y -= Math.max(used, 14) + 6;
  }

  // J Other insurance
  {
    const space = ensureSpace(pdf, page, fonts, y, 40, stamp, pages);
    page = space.page;
    y = space.y;
    drawCheckboxRow(
      page,
      fonts,
      "J. Currently do you have any other mediclaim / health insurance:",
      [
        { text: "Yes", checked: fields.otherInsuranceYes === true },
        { text: "No", checked: fields.otherInsuranceYes === false },
      ],
      MARGIN,
      y
    );
    y -= 16;
    note(fields.otherCompany);
    note(fields.otherPolicyDetails);
    used = drawLineField(
      page,
      fonts,
      "   i. Company Name:",
      fields.otherCompany,
      MARGIN,
      y,
      contentW
    );
    y -= used + 4;
    used = drawLineField(
      page,
      fonts,
      "   ii. Give Details:",
      fields.otherPolicyDetails,
      MARGIN,
      y,
      contentW
    );
    y -= used + 8;
  }

  // K Family physician yes/no
  {
    const space = ensureSpace(pdf, page, fonts, y, 18, stamp, pages);
    page = space.page;
    y = space.y;
    drawCheckboxRow(
      page,
      fonts,
      "K. Do you have a family Physician:",
      [
        { text: "Yes", checked: fields.familyPhysicianYes === true },
        { text: "No", checked: fields.familyPhysicianYes === false },
      ],
      MARGIN,
      y
    );
    y -= 20;
  }

  // Hospital / doctor section — intentionally blank
  {
    const space = ensureSpace(pdf, page, fonts, y, 80, stamp, pages);
    page = space.page;
    y = space.y;
    y = sectionTitle(
      page,
      fonts,
      "TO BE FILLED BY TREATING DOCTOR / HOSPITAL",
      y
    );
    const blanks = [
      "A. Name of the treating Doctor:",
      "B. Contact number:",
      "C. Nature of Illness / Disease with presenting complaint:",
      "D. Relevant Critical Findings:",
      "E. Duration of the present ailment (Days):",
      "   i. Date of First consultation:",
      "   ii. Past history of present ailment, if any:",
      "F. Provisional diagnosis:",
      "   i. ICD 10 code:",
      "G. Proposed line of treatment:  [ ] Medical  [ ] Surgical  [ ] ICU  [ ] Investigation  [ ] Non-allopathic",
      "H. If investigation and/or Medical Management, provide details:",
      "I. If surgical, name of surgery:",
      "J. If other treatment, provide details:",
      "K. How did injury occur:",
      "L. In case of accident — RTA / Date of Injury / Police / FIR:",
      "M. In case of Maternity — G / P / L / A / Expected date of Delivery:",
    ];
    for (const label of blanks) {
      const sp = ensureSpace(pdf, page, fonts, y, 28, stamp, pages);
      page = sp.page;
      y = sp.y;
      used = drawLineField(page, fonts, label, "", MARGIN, y, contentW);
      y -= used + 4;
    }
  }

  // Patient admitted + costs — blank
  {
    const space = ensureSpace(pdf, page, fonts, y, 60, stamp, pages);
    page = space.page;
    y = space.y;
    y = sectionTitle(page, fonts, "DETAILS OF PATIENT ADMITTED", y);
    const costBlanks = [
      "A. Date of admission:",
      "B. Time of admission:",
      "C. Emergency / Planned hospitalization:",
      "D. Mandatory past history of any chronic illness:",
      "E. Expected number of Days stay in hospital:",
      "F. Days in ICU:",
      "G. Room Type:",
      "H. Per day room rent + nursing + diet:",
      "I. Expected cost of investigation + diagnostic:",
      "J. ICU charges:",
      "K. OT charges:",
      "L. Professional fees (Surgeon + Anesthetist + consultation):",
      "M. Medicines + Consumables + Implants:",
      "N. Other hospital expenses:",
      "O. All-inclusive package charges:",
      "P. Sum Total expected cost of hospitalization:",
    ];
    for (const label of costBlanks) {
      const sp = ensureSpace(pdf, page, fonts, y, 24, stamp, pages);
      page = sp.page;
      y = sp.y;
      used = drawLineField(page, fonts, label, "", MARGIN, y, contentW);
      y -= used + 4;
    }
  }

  // Declarations + signature boxes
  {
    const space = ensureSpace(pdf, page, fonts, y, 120, stamp, pages);
    page = space.page;
    y = space.y;
    y = sectionTitle(page, fonts, "DECLARATION BY THE PATIENT / REPRESENTATIVE", y);
    const decl = [
      "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after discharge.",
      "b. Payment to hospital is governed by the terms and conditions of the policy.",
      "c. Non-medical / non-admissible expenses will be paid by me.",
      "d–h. I abide by policy terms; authorize Insurer/TPA to contact me for claim updates.",
    ];
    for (const line of decl) {
      const font = fonts.regular;
      const lines = wrapText(line, font, 7.5, contentW);
      for (const ln of lines) {
        const sp = ensureSpace(pdf, page, fonts, y, 12, stamp, pages);
        page = sp.page;
        y = sp.y;
        page.drawText(ln, { x: MARGIN, y, size: 7.5, font, color: ink });
        y -= 10;
      }
    }
    y -= 6;
    used = drawLineField(
      page,
      fonts,
      "a) Patient's / Insured's Name:",
      "",
      MARGIN,
      y,
      contentW
    );
    y -= used + 4;
    used = drawLineField(
      page,
      fonts,
      "b) Contact number:",
      "",
      MARGIN,
      y,
      contentW * 0.5
    );
    drawLineField(
      page,
      fonts,
      "c) e-mail Id:",
      "",
      MARGIN + contentW * 0.52,
      y,
      contentW * 0.48
    );
    y -= 18;
    page.drawText("d) Patient's / Insured's Signature:", {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: ink,
    });
    drawBlankBox(page, MARGIN + 160, y + 8, 200, 36);
    y -= 50;
    used = drawLineField(page, fonts, "Date:", "", MARGIN, y, contentW * 0.45);
    drawLineField(
      page,
      fonts,
      "Time:",
      "",
      MARGIN + contentW * 0.5,
      y,
      contentW * 0.45
    );
    y -= 28;

    const sp = ensureSpace(pdf, page, fonts, y, 80, stamp, pages);
    page = sp.page;
    y = sp.y;
    y = sectionTitle(page, fonts, "HOSPITAL DECLARATION", y);
    page.drawText(
      "Hospital Seal / Doctor's Signature (leave blank for hospital use)",
      { x: MARGIN, y, size: 8, font: fonts.regular, color: ink }
    );
    y -= 8;
    drawBlankBox(page, MARGIN, y, 220, 50);
    drawBlankBox(page, MARGIN + 240, y, 220, 50);
    y -= 60;
    used = drawLineField(page, fonts, "Date:", "", MARGIN, y, contentW * 0.45);
    drawLineField(
      page,
      fonts,
      "Time:",
      "",
      MARGIN + contentW * 0.5,
      y,
      contentW * 0.45
    );
  }

  for (const p of pages) drawFooter(p, fonts, stamp);

  const bytes = await pdf.save();
  return { bytes, textDump: texts.join("\n") };
}

export function cashlessFilename(): string {
  return `kavachsaathi-cashless-irdai.pdf`;
}

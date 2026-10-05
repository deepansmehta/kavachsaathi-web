import {
  A4,
  MARGIN,
  FOOTER_H,
  blank,
  createPdfDoc,
  drawFooter,
  drawLineField,
  drawMixedText,
  drawWatermark,
  formatIstStamp,
  ink,
  muted,
  wrapText,
} from "./pdfCommon";
import type { AdmissionSheetFields } from "./formData";

/**
 * One-page Admission Info Sheet for any hospital / government scheme.
 * limited=true → emergency mode: no address, no ID numbers.
 */
export async function buildAdmissionSheetPdf(
  fields: AdmissionSheetFields,
  opts: { limited: boolean }
): Promise<{ bytes: Uint8Array; textDump: string }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();
  const page = pdf.addPage([A4.width, A4.height]);
  drawWatermark(page);
  const texts: string[] = [];
  const note = (s: string) => {
    if (blank(s)) texts.push(s);
  };

  const contentW = A4.width - MARGIN * 2;
  let y = A4.height - MARGIN;

  page.drawText("KavachSaathi — Admission Info Sheet", {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.regular,
    color: ink,
  });
  y -= 14;
  page.drawText(
    opts.limited
      ? "Limited emergency view (hospital staff access)"
      : "Attach to hospital admission form / government scheme paperwork",
    { x: MARGIN, y, size: 8, font: fonts.regular, color: muted }
  );
  y -= 18;

  // Photo
  if (fields.photoBytes && fields.photoBytes.length > 100) {
    try {
      const img =
        fields.photoContentType?.includes("png")
          ? await pdf.embedPng(fields.photoBytes)
          : await pdf.embedJpg(fields.photoBytes);
      const iw = 72;
      const ih = 72;
      page.drawImage(img, {
        x: A4.width - MARGIN - iw,
        y: y - ih + 20,
        width: iw,
        height: ih,
      });
    } catch {
      /* skip bad photo */
    }
  }

  const rows: [string, string][] = [
    ["Name:", fields.fullName],
    ["Age / Gender:", fields.ageGender],
    ["Blood group:", fields.bloodGroup],
    ["Allergies:", fields.allergies],
    ["Medical conditions:", fields.conditions],
    ["Current medicines:", fields.medicines],
  ];

  if (!opts.limited) {
    rows.push(["Address:", fields.address]);
    rows.push(["Emergency contacts:", fields.emergencyContacts]);
  }

  for (const [label, val] of rows) {
    note(val);
    const used = drawLineField(
      page,
      fonts,
      label,
      val,
      MARGIN,
      y,
      opts.limited ? contentW : contentW - 90
    );
    y -= used + 6;
    if (y < FOOTER_H + 80) break;
  }

  if (!opts.limited && fields.idProofs.length) {
    page.drawText("ID proof (masked):", {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: ink,
    });
    y -= 12;
    for (const id of fields.idProofs) {
      const line = `${id.type}: ${id.masked}`;
      note(line);
      // Guard: never print full Aadhaar
      if (/^\d{12}$/.test(id.masked.replace(/\s/g, ""))) {
        throw new Error("REFUSED: full Aadhaar would be printed");
      }
      const lines = wrapText(line, fonts.regular, 9, contentW, fonts);
      for (const ln of lines) {
        drawMixedText(page, fonts, ln, MARGIN + 8, y, 9, ink);
        y -= 12;
      }
    }
    y -= 4;
  }

  page.drawText("Insurance", {
    x: MARGIN,
    y,
    size: 10,
    font: fonts.regular,
    color: ink,
  });
  y -= 14;

  const insRows: [string, string][] = [
    ["Insurer:", fields.insurerName],
    ["TPA:", fields.tpaName],
    ["Policy number:", fields.policyNumber],
    ["Policy holder:", fields.policyHolder],
    ["Valid till:", fields.validTill],
    ["Member / health card ID:", fields.memberId],
    ["Government scheme:", fields.schemeName],
    ["Scheme card number:", fields.govtCardNumber],
  ];

  for (const [label, val] of insRows) {
    note(val);
    const used = drawLineField(page, fonts, label, val, MARGIN, y, contentW);
    y -= used + 5;
  }

  drawFooter(page, fonts, stamp);
  const bytes = await pdf.save();
  return { bytes, textDump: texts.join("\n") };
}

export function admissionFilename(limited: boolean): string {
  return limited
    ? "kavachsaathi-admission-sheet-limited.pdf"
    : "kavachsaathi-admission-sheet.pdf";
}

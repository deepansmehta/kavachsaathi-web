import {
  A4,
  MARGIN,
  FOOTER_H,
  blank,
  createPdfDoc,
  drawFooter,
  drawLineField,
  drawWatermark,
  formatIstStamp,
  ink,
  muted,
} from "@/lib/forms/pdfCommon";
import { POLICY_LEGAL_FOOTER } from "./constants";

export type CashlessInfoFields = {
  holderName: string;
  healthId: string;
  bloodGroup: string;
  insurerName: string;
  tpaName: string;
  policyNumber: string;
  memberId: string;
  sumInsured: string;
  nomineeName: string;
  nomineeRelation: string;
  nomineePhone: string;
  emergencyContacts: string;
  cashlessHelpline: string;
  claimHelpline: string;
};

/**
 * One-page Cashless Info Sheet — same letterhead stack as admission PDF (pdf-lib).
 * Full policy number only here (PIN-gated download). Never log the number.
 */
export async function buildCashlessInfoPdf(
  fields: CashlessInfoFields
): Promise<{ bytes: Uint8Array; textDump: string }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();
  const page = pdf.addPage([A4.width, A4.height]);
  drawWatermark(page);
  const texts: string[] = [];
  const note = (s: string) => {
    const t = String(s || "").trim();
    if (t) texts.push(t);
  };

  let y = A4.height - MARGIN;

  page.drawText("KavachSaathi — Cashless Info Sheet", {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.regular,
    color: ink,
  });
  y -= 14;
  page.drawText("For hospital / TPA desk (PIN-protected download)", {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: muted,
  });
  y -= 22;

  const rows: [string, string][] = [
    ["Holder name", fields.holderName],
    ["Card ID", fields.healthId],
    ["Blood group", fields.bloodGroup],
    ["Insurer", fields.insurerName],
    ["TPA", fields.tpaName],
    ["Policy number", fields.policyNumber],
    ["Member ID", fields.memberId],
    ["Sum insured", fields.sumInsured],
    ["Cashless helpline", fields.cashlessHelpline],
    ["Claim helpline", fields.claimHelpline],
    ["Nominee", [fields.nomineeName, fields.nomineeRelation].filter(Boolean).join(" / ")],
    ["Nominee phone", fields.nomineePhone],
    ["Emergency contacts", fields.emergencyContacts],
  ];

  const contentW = A4.width - MARGIN * 2;
  for (const [label, value] of rows) {
    if (!String(value || "").trim()) continue;
    note(`${label}: ${value}`);
    const used = drawLineField(
      page,
      fonts,
      label,
      blank(value),
      MARGIN,
      y,
      contentW
    );
    y -= used + 4;
    if (y < MARGIN + FOOTER_H + 40) break;
  }

  y -= 8;
  page.drawText(POLICY_LEGAL_FOOTER, {
    x: MARGIN,
    y: Math.max(y, MARGIN + FOOTER_H + 16),
    size: 7,
    font: fonts.regular,
    color: muted,
    maxWidth: A4.width - MARGIN * 2,
  });

  drawFooter(page, fonts, stamp);

  const bytes = await pdf.save();
  return { bytes, textDump: texts.join("\n") };
}

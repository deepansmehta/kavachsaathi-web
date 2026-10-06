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
import { JAN_AUSHADHI_LOCATOR } from "@/lib/patientEase/officialLinks";
import type {
  ConditionEntry,
  MedicineEntry,
  SurgeryEntry,
  VaccinationEntry,
} from "@/lib/patientEase/helpers";

export type DoctorSummaryData = {
  name: string;
  bloodGroup?: string;
  allergies?: string[];
  criticalFlags?: string[];
  conditions?: ConditionEntry[];
  surgeries?: SurgeryEntry[];
  medicines?: MedicineEntry[];
  vaccinations?: VaccinationEntry[];
  familyDoctor?: { name?: string; phone?: string } | null;
  includeJanAushadhi?: boolean;
  autoSummaryEn?: string;
  autoSummaryHi?: string;
};

export async function buildDoctorSummaryPdf(
  data: DoctorSummaryData
): Promise<Uint8Array> {
  const { pdf, fonts } = await createPdfDoc();
  const page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  const maxW = A4.width - MARGIN * 2;
  const h = (t: string) => {
    drawMixedText(page, fonts, t, MARGIN, y, 12, ink);
    y -= 16;
  };
  const p = (t: string, size = 10) => {
    for (const l of wrapText(blank(t), fonts.regular, size, maxW, fonts)) {
      if (y < MARGIN + 36) return;
      drawMixedText(page, fonts, l, MARGIN, y, size, ink);
      y -= size + 3;
    }
  };
  drawMixedText(page, fonts, "Doctor Summary / चिकित्सक सारांश", MARGIN, y, 14, ink);
  y -= 22;
  if (data.autoSummaryEn) {
    p(data.autoSummaryEn);
    y -= 4;
  }
  if (data.autoSummaryHi) {
    p(data.autoSummaryHi);
    y -= 6;
  }
  p(`Name: ${blank(data.name)}`);
  p(`Blood group: ${blank(data.bloodGroup)}`);
  p(`Allergies: ${(data.allergies || []).map(blank).filter(Boolean).join(", ") || "—"}`);
  p(
    `Critical flags: ${(data.criticalFlags || []).map(blank).filter(Boolean).join(", ") || "—"}`
  );
  h("Conditions");
  if (!data.conditions?.length) p("—");
  else
    for (const c of data.conditions)
      p(`${blank(c.name)}${c.sinceYear ? ` (since ${blank(c.sinceYear)})` : ""}`);
  h("Surgeries / hospitalisations");
  if (!data.surgeries?.length) p("—");
  else
    for (const s of data.surgeries)
      p(
        `${blank(s.name)}${s.year ? ` (${blank(s.year)})` : ""}${s.hospital ? ` — ${blank(s.hospital)}` : ""}`
      );
  h("Medicines");
  if (!data.medicines?.length) p("—");
  else
    for (const m of data.medicines)
      p(
        `${blank(m.name)}${m.dose ? ` — ${blank(m.dose)}` : ""}${m.frequency ? `, ${blank(m.frequency)}` : ""}`
      );
  h("Vaccinations");
  if (!data.vaccinations?.length) p("—");
  else
    for (const v of data.vaccinations)
      p(`${blank(v.name)}${v.date ? ` — ${blank(v.date)}` : ""}`);
  h("Family doctor");
  p(
    `${blank(data.familyDoctor?.name)}${data.familyDoctor?.phone ? ` · ${blank(data.familyDoctor.phone)}` : ""}` ||
      "—"
  );
  if (data.includeJanAushadhi) {
    y -= 8;
    p(`Jan Aushadhi Kendra locator: ${JAN_AUSHADHI_LOCATOR}`, 8);
  }
  y -= 10;
  drawMixedText(
    page,
    fonts,
    "For treating clinician reference. Confirm with patient records.",
    MARGIN,
    y,
    8,
    muted
  );
  return pdf.save();
}

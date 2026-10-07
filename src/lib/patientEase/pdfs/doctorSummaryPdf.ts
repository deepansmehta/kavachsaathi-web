/**
 * Doctor Summary PDF — 1-page A4 PDF for handing to a doctor.
 * Uses the same pdf-lib + font pattern as other forms.
 */
import "regenerator-runtime/runtime";
import {
  A4,
  MARGIN,
  ink,
  muted,
  lineColor,
  createPdfDoc,
  drawWatermark,
  drawFooter,
  formatIstStamp,
  blank,
  drawMixedText,
  wrapText,
} from "@/lib/forms/pdfCommon";
import { rgb } from "pdf-lib";
import type { DoctorSummaryData } from "@/lib/patientEase/doctorSummary";

const GOLD = rgb(0.831, 0.686, 0.216);
const SECTION_GAP = 14;
const ROW_H = 13;

export async function buildDoctorSummaryPdf(
  data: DoctorSummaryData
): Promise<Buffer> {
  const { pdf, fonts } = await createPdfDoc();
  const page = pdf.addPage([A4.width, A4.height]);
  const { width, height } = page.getSize();
  drawWatermark(page);

  let y = height - MARGIN;

  // ── Header ─────────────────────────────────────────────────────────────
  page.drawText("KavachSaathi", {
    x: MARGIN,
    y,
    size: 10,
    font: fonts.bold,
    color: GOLD,
  });
  page.drawText("Doctor Summary Sheet", {
    x: width - MARGIN - 130,
    y,
    size: 10,
    font: fonts.bold,
    color: GOLD,
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 0.8,
    color: GOLD,
  });
  y -= 12;

  // ── Patient bio row ─────────────────────────────────────────────────────
  const nameLabel = "Patient: ";
  page.drawText(nameLabel, { x: MARGIN, y, size: 9, font: fonts.regular, color: muted });
  const nx = MARGIN + fonts.regular.widthOfTextAtSize(nameLabel, 9);
  drawMixedText(page, fonts, blank(data.name) || "—", nx, y, 11, ink);

  // Blood group badge
  const bgText = data.bloodGroup || "—";
  const bgW = fonts.bold.widthOfTextAtSize(bgText, 14) + 12;
  const bgX = width - MARGIN - bgW;
  page.drawRectangle({ x: bgX, y: y - 4, width: bgW, height: 18, color: rgb(0.95, 0.92, 0.80), borderColor: GOLD, borderWidth: 0.6, borderOpacity: 0.6, opacity: 1 });
  page.drawText(bgText, { x: bgX + 6, y: y + 1, size: 14, font: fonts.bold, color: GOLD });
  y -= ROW_H;

  // Age / Gender
  const ageGender = [
    data.age ? `Age: ${data.age}y${data.ageMonths ? ` ${data.ageMonths}m` : ""}` : null,
    data.gender ? `Gender: ${data.gender}` : null,
  ]
    .filter(Boolean)
    .join("   ");
  if (ageGender) {
    page.drawText(ageGender, { x: MARGIN, y, size: 9, font: fonts.regular, color: muted });
    y -= ROW_H;
  }

  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.4, color: lineColor });
  y -= SECTION_GAP;

  const drawSection = (title: string, items: string[]) => {
    if (!items.length) return;
    page.drawText(title.toUpperCase(), { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 10;
    for (const item of items) {
      const lines = wrapText(item, fonts.regular, 9, width - MARGIN * 2 - 14, fonts);
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
          page.drawText("•", { x: MARGIN, y, size: 9, font: fonts.regular, color: muted });
          drawMixedText(page, fonts, lines[i], MARGIN + 10, y, 9, ink);
        } else {
          drawMixedText(page, fonts, lines[i], MARGIN + 10, y, 9, ink);
        }
        y -= ROW_H;
        if (y < 80) return; // safety guard
      }
    }
    y -= 4;
  };

  // Critical flags
  if (data.criticalFlags.length) {
    page.drawText("CRITICAL FLAGS", { x: MARGIN, y, size: 8, font: fonts.bold, color: rgb(0.9, 0.3, 0.3) });
    y -= 10;
    for (const f of data.criticalFlags) {
      drawMixedText(page, fonts, `⚠ ${f}`, MARGIN + 10, y, 9, rgb(0.9, 0.3, 0.3));
      y -= ROW_H;
    }
    y -= 4;
  }

  drawSection("Allergies", data.allergies);
  drawSection("Chronic Conditions", data.conditions);

  // Medications
  if (data.medications.length) {
    page.drawText("MEDICATIONS", { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 10;
    for (const med of data.medications) {
      const medStr = [med.name, med.dose, med.freq].filter(Boolean).join("  ·  ");
      const lines = wrapText(medStr, fonts.regular, 9, width - MARGIN * 2 - 14, fonts);
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) page.drawText("•", { x: MARGIN, y, size: 9, font: fonts.regular, color: muted });
        drawMixedText(page, fonts, lines[i], MARGIN + 10, y, 9, ink);
        y -= ROW_H;
      }
    }
    y -= 4;
  }

  drawSection("Surgeries / Procedures", data.surgeries);
  drawSection("Vaccinations", data.vaccinations);

  // Family Doctor
  if (data.familyDoctor?.name || data.familyDoctor?.phone) {
    page.drawText("FAMILY DOCTOR", { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 10;
    const fdParts = [
      data.familyDoctor.name,
      data.familyDoctor.clinic,
      data.familyDoctor.phone ? `☎ ${data.familyDoctor.phone}` : null,
    ].filter(Boolean);
    drawMixedText(page, fonts, fdParts.join("  ·  "), MARGIN + 10, y, 9, ink);
    y -= ROW_H + 4;
  }

  // Disclaimer
  const stamp = formatIstStamp();
  page.drawText(
    `Generated by KavachSaathi on ${stamp}. Verify all details with patient/attendant.`,
    { x: MARGIN, y: Math.max(y, 58), size: 7, font: fonts.regular, color: muted }
  );

  drawFooter(page, fonts, stamp);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

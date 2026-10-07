/**
 * F16 — Document Pack PDF Builder
 * Multi-page PDF: cover + selected sections. Masks Aadhaar. Never prints undefined/null.
 */

import { rgb } from "pdf-lib";
import {
  createPdfDoc,
  blank,
  wrapText,
  drawMixedText,
  drawWatermark,
  drawFooter,
  formatIstStamp,
  noStoreHeaders,
  A4,
  MARGIN,
  ink,
  muted,
  lineColor,
} from "@/lib/forms/pdfCommon";
import {
  SECTION_LABELS,
  SECTION_LABELS_HI,
  maskAadhaar,
  type DocumentPackSection,
} from "@/lib/patientEase/documentPack";
import type { CoverageSnapshot } from "@/lib/patientEase/coverage";
import { roomRentTip, formatInr } from "@/lib/patientEase/coverage";

const BODY_WIDTH = A4.width - MARGIN * 2;
const LINE_H = 13;
const SECTION_COLOR = rgb(0.1, 0.35, 0.65);
const ACCENT = rgb(0.95, 0.95, 0.98);

type ProfileData = {
  name?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  address?: string;
  aadhaarEnc?: string;
  aadhaar?: string;
  emergencyContacts?: { name?: string; relation?: string; phone?: string }[];
  conditions?: string[];
  allergies?: string[];
  medications?: { name?: string; dose?: string; frequency?: string }[];
  insurance?: {
    coverageType?: string;
    private?: { insurerName?: string; policyNumber?: string; validTill?: string; tpaName?: string };
    government?: { schemeName?: string; govtCardNumber?: string };
  };
  donorDirective?: { isDonor?: boolean; organs?: string[]; advanceDirective?: string };
  coverageSnapshot?: CoverageSnapshot;
  healthId?: string;
};

function sectionHeader(
  page: ReturnType<import("pdf-lib").PDFDocument["addPage"]>,
  fonts: Awaited<ReturnType<typeof createPdfDoc>>["fonts"],
  section: DocumentPackSection,
  y: number
): number {
  // Background band
  page.drawRectangle({
    x: MARGIN - 4,
    y: y - 4,
    width: BODY_WIDTH + 8,
    height: 18,
    color: ACCENT,
  });
  const enLabel = SECTION_LABELS[section];
  const hiLabel = SECTION_LABELS_HI[section];
  page.drawText(enLabel, { x: MARGIN, y, size: 10, font: fonts.bold, color: SECTION_COLOR });
  const enW = fonts.bold.widthOfTextAtSize(enLabel, 10);
  page.drawText(` / `, { x: MARGIN + enW, y, size: 9, font: fonts.regular, color: muted });
  drawMixedText(page, fonts, hiLabel, MARGIN + enW + 10, y, 9, muted);
  return y - 22;
}

function row(
  page: ReturnType<import("pdf-lib").PDFDocument["addPage"]>,
  fonts: Awaited<ReturnType<typeof createPdfDoc>>["fonts"],
  label: string,
  value: string,
  y: number
): number {
  const val = blank(value);
  if (!val) return y;
  page.drawText(`${label}:`, { x: MARGIN, y, size: 8.5, font: fonts.regular, color: muted });
  const labelW = fonts.regular.widthOfTextAtSize(`${label}:`, 8.5);
  const maxVal = BODY_WIDTH - labelW - 8;
  const wrapped = wrapText(val, fonts.regular, 9, maxVal, fonts);
  drawMixedText(page, fonts, wrapped[0] || "", MARGIN + labelW + 6, y, 9, ink);
  let dy = LINE_H;
  for (let i = 1; i < wrapped.length; i++) {
    drawMixedText(page, fonts, wrapped[i], MARGIN + labelW + 6, y - dy, 9, ink);
    dy += LINE_H;
  }
  return y - dy - 2;
}

export async function buildDocumentPackPdf(opts: {
  sections: DocumentPackSection[];
  profile: ProfileData;
  healthId: string;
  generatedBy?: string;
}): Promise<{ bytes: Uint8Array; headers: Record<string, string> }> {
  const { pdf, fonts } = await createPdfDoc();
  const stamp = formatIstStamp();
  const { sections, profile, healthId } = opts;

  // ── Cover Page ────────────────────────────────────────────────────────
  const cover = pdf.addPage([A4.width, A4.height]);
  drawWatermark(cover);
  let y = A4.height - MARGIN - 20;

  cover.drawText("KavachSaathi", { x: MARGIN, y, size: 22, font: fonts.bold, color: SECTION_COLOR });
  y -= 28;
  cover.drawText("Patient Document Pack", { x: MARGIN, y, size: 16, font: fonts.regular, color: ink });
  y -= 14;
  drawMixedText(cover, fonts, "रोगी दस्तावेज़ पैक", MARGIN, y, 13, muted);
  y -= 24;

  cover.drawLine({ start: { x: MARGIN, y }, end: { x: A4.width - MARGIN, y }, thickness: 1, color: lineColor });
  y -= 20;

  y = row(cover, fonts, "Patient Name", blank(profile.name), y);
  y = row(cover, fonts, "Health ID", blank(healthId), y);
  y = row(cover, fonts, "Blood Group", blank(profile.bloodGroup), y);
  y = row(cover, fonts, "Date of Birth", blank(profile.dob), y);
  y = row(cover, fonts, "Gender", blank(profile.gender), y);
  y -= 10;

  cover.drawText("Sections included:", { x: MARGIN, y, size: 9, font: fonts.bold, color: ink });
  y -= 14;
  for (const s of sections) {
    cover.drawText(`• ${SECTION_LABELS[s]}`, { x: MARGIN + 10, y, size: 9, font: fonts.regular, color: ink });
    y -= 12;
  }

  y -= 10;
  const noteLines = wrapText(
    "NOTE: This document pack is generated from self-reported profile data on KavachSaathi. Aadhaar numbers are masked. Verify all details with original documents.",
    fonts.regular,
    8,
    BODY_WIDTH,
    fonts
  );
  for (const nl of noteLines) {
    drawMixedText(cover, fonts, nl, MARGIN, y, 8, muted);
    y -= 10;
  }

  drawFooter(cover, fonts, stamp);

  // ── Section Pages ─────────────────────────────────────────────────────
  for (const section of sections) {
    const page = pdf.addPage([A4.width, A4.height]);
    drawWatermark(page);
    y = A4.height - MARGIN;
    y = sectionHeader(page, fonts, section, y);

    switch (section) {
      case "personal_details": {
        y = row(page, fonts, "Name", blank(profile.name), y);
        y = row(page, fonts, "Health ID", blank(healthId), y);
        y = row(page, fonts, "Date of Birth", blank(profile.dob), y);
        y = row(page, fonts, "Gender", blank(profile.gender), y);
        y = row(page, fonts, "Blood Group", blank(profile.bloodGroup), y);
        y = row(page, fonts, "Phone", blank(profile.phone), y);
        y = row(page, fonts, "Address", blank(profile.address), y);
        // Mask Aadhaar
        const rawAadhaar = profile.aadhaar || "";
        if (rawAadhaar) {
          y = row(page, fonts, "Aadhaar", maskAadhaar(rawAadhaar), y);
        }
        break;
      }
      case "emergency_contacts": {
        const contacts = profile.emergencyContacts || [];
        if (contacts.length === 0) {
          drawMixedText(page, fonts, "No emergency contacts saved.", MARGIN, y, 9, muted);
          y -= LINE_H;
        }
        for (let i = 0; i < contacts.length; i++) {
          const c = contacts[i];
          y -= 4;
          page.drawText(`Contact ${i + 1}`, { x: MARGIN, y, size: 9, font: fonts.bold, color: ink });
          y -= LINE_H;
          y = row(page, fonts, "Name", blank(c.name), y);
          y = row(page, fonts, "Relation", blank(c.relation), y);
          y = row(page, fonts, "Phone", blank(c.phone), y);
          y -= 4;
        }
        break;
      }
      case "medical_history": {
        const conditions = (profile.conditions || []).filter(Boolean);
        if (conditions.length) {
          page.drawText("Conditions / Diagnoses:", { x: MARGIN, y, size: 9, font: fonts.bold, color: ink });
          y -= LINE_H;
          for (const c of conditions) {
            drawMixedText(page, fonts, `• ${blank(c)}`, MARGIN + 8, y, 9, ink);
            y -= LINE_H;
          }
        } else {
          drawMixedText(page, fonts, "No conditions recorded.", MARGIN, y, 9, muted);
          y -= LINE_H;
        }
        break;
      }
      case "allergies": {
        const allergies = (profile.allergies || []).filter(Boolean);
        if (allergies.length) {
          for (const a of allergies) {
            drawMixedText(page, fonts, `• ${blank(a)}`, MARGIN + 8, y, 9, ink);
            y -= LINE_H;
          }
        } else {
          drawMixedText(page, fonts, "No allergies recorded.", MARGIN, y, 9, muted);
          y -= LINE_H;
        }
        break;
      }
      case "medications": {
        const meds = (profile.medications || []).filter((m) => m.name);
        if (meds.length) {
          for (const m of meds) {
            const text = [blank(m.name), blank(m.dose), blank(m.frequency)].filter(Boolean).join(" — ");
            drawMixedText(page, fonts, `• ${text}`, MARGIN + 8, y, 9, ink);
            y -= LINE_H;
          }
        } else {
          drawMixedText(page, fonts, "No medications recorded.", MARGIN, y, 9, muted);
          y -= LINE_H;
        }
        break;
      }
      case "insurance_details": {
        const ins = profile.insurance;
        if (!ins) {
          drawMixedText(page, fonts, "No insurance details saved.", MARGIN, y, 9, muted);
          y -= LINE_H;
        } else {
          y = row(page, fonts, "Coverage Type", blank(ins.coverageType), y);
          if (ins.private?.insurerName) {
            y -= 6;
            page.drawText("Private Insurance:", { x: MARGIN, y, size: 9, font: fonts.bold, color: ink });
            y -= LINE_H;
            y = row(page, fonts, "Insurer", blank(ins.private.insurerName), y);
            y = row(page, fonts, "Policy No.", blank(ins.private.policyNumber), y);
            y = row(page, fonts, "Valid Till", blank(ins.private.validTill), y);
            y = row(page, fonts, "TPA", blank(ins.private.tpaName), y);
          }
          if (ins.government?.schemeName) {
            y -= 6;
            page.drawText("Government Scheme:", { x: MARGIN, y, size: 9, font: fonts.bold, color: ink });
            y -= LINE_H;
            y = row(page, fonts, "Scheme", blank(ins.government.schemeName), y);
            y = row(page, fonts, "Card No.", blank(ins.government.govtCardNumber), y);
          }
        }
        break;
      }
      case "coverage_snapshot": {
        const cs = profile.coverageSnapshot;
        if (!cs) {
          drawMixedText(page, fonts, "No coverage snapshot saved.", MARGIN, y, 9, muted);
          y -= LINE_H;
        } else {
          y = row(page, fonts, "Sum Insured", formatInr(cs.sumInsured), y);
          y = row(page, fonts, "Used So Far", formatInr(cs.usedSoFar), y);
          y = row(page, fonts, "Remaining", formatInr(Math.max(0, cs.sumInsured - cs.usedSoFar)), y);
          if (cs.roomRentLimit.type !== "none") {
            const rrLabel = cs.roomRentLimit.type === "day"
              ? `${formatInr(cs.roomRentLimit.value)}/day`
              : `${cs.roomRentLimit.value}% of sum insured/day`;
            y = row(page, fonts, "Room Rent Limit", rrLabel, y);
          }
          if (cs.icuLimit > 0) y = row(page, fonts, "ICU Limit", `${formatInr(cs.icuLimit)}/day`, y);
          if (cs.copayPercent > 0) y = row(page, fonts, "Co-pay", `${cs.copayPercent}%`, y);
          if (cs.deductible > 0) y = row(page, fonts, "Deductible", formatInr(cs.deductible), y);
          y = row(page, fonts, "Restoration", cs.restoration ? "Yes" : "No", y);
          if (blank(cs.subLimitsText)) y = row(page, fonts, "Sub-limits", cs.subLimitsText, y);
          const tip = roomRentTip(cs);
          if (tip) {
            y -= 6;
            const tipLines = wrapText(`Tip: ${tip}`, fonts.regular, 8.5, BODY_WIDTH, fonts);
            for (const tl of tipLines) {
              drawMixedText(page, fonts, tl, MARGIN, y, 8.5, rgb(0.1, 0.5, 0.1));
              y -= 11;
            }
          }
        }
        break;
      }
      case "donor_directive": {
        const dd = profile.donorDirective;
        if (!dd) {
          drawMixedText(page, fonts, "No donor directive saved.", MARGIN, y, 9, muted);
          y -= LINE_H;
        } else {
          y = row(page, fonts, "Organ Donor", dd.isDonor ? "Yes" : "No", y);
          if (dd.isDonor && dd.organs?.length) {
            y = row(page, fonts, "Organs", (dd.organs || []).join(", "), y);
          }
          if (blank(dd.advanceDirective)) {
            const adLines = wrapText(`Advance Directive: ${dd.advanceDirective}`, fonts.regular, 9, BODY_WIDTH, fonts);
            for (const al of adLines) {
              drawMixedText(page, fonts, al, MARGIN, y, 9, ink);
              y -= LINE_H;
            }
          }
        }
        break;
      }
    }

    drawFooter(page, fonts, stamp);
  }

  const bytes = await pdf.save();
  const headers: Record<string, string> = {
    ...noStoreHeaders(),
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="kavachsaathi-document-pack.pdf"`,
    "Content-Length": String(bytes.length),
  };

  return { bytes, headers };
}

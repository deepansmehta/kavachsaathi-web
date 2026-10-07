/**
 * Doctor Summary — data types and profile-to-summary transformation.
 * Used by /api/doctor-summary (GET JSON, POST pdf).
 */
import { blank, ageFromDob } from "@/lib/forms/pdfCommon";

export type MedicationEntry = {
  name: string;
  dose?: string;
  freq?: string;
};

export type DoctorSummaryData = {
  name: string;
  age: string;
  ageMonths: string;
  gender: string;
  bloodGroup: string;
  /** Chronic / medical conditions with optional since-year */
  conditions: string[];
  surgeries: string[];
  medications: MedicationEntry[];
  allergies: string[];
  vaccinations: string[];
  criticalFlags: string[];
  familyDoctor: { name: string; phone: string; clinic: string } | null;
  generatedAt: string;
};

/** Parse a medication string "Metformin 500mg twice daily" into structured entry. */
function parseMed(raw: string): MedicationEntry {
  const s = blank(raw);
  if (!s) return { name: "" };
  // Try to extract "Name dose freq" pattern
  const m = s.match(/^([A-Za-z][^\d]*?)[\s,]+(\d[\w./%]*)(.*)$/);
  if (m) {
    return {
      name: m[1].trim(),
      dose: m[2].trim() || undefined,
      freq: m[3].trim() || undefined,
    };
  }
  return { name: s };
}

/** Build DoctorSummaryData from raw Firestore profile data. */
export function buildDoctorSummary(
  profile: Record<string, unknown>
): DoctorSummaryData {
  const dob = String(profile.dateOfBirth || profile.dob || "");
  const { years, months } = ageFromDob(dob);

  const rawMeds = (
    Array.isArray(profile.medications) ? profile.medications : []
  ) as string[];

  // Critical alerts display
  const critRaw = profile.criticalAlerts as
    | { tags?: string[]; otherText?: string }
    | null
    | undefined;
  const critFlags: string[] = [];
  if (critRaw && Array.isArray(critRaw.tags)) {
    for (const t of critRaw.tags) {
      if (t === "Severe allergy" && critRaw.otherText) {
        critFlags.push(`Severe allergy: ${critRaw.otherText}`);
      } else if (t === "Other" && critRaw.otherText) {
        critFlags.push(critRaw.otherText);
      } else if (t && t !== "Other") {
        critFlags.push(t);
      }
    }
  }

  const fd =
    profile.family_doctor &&
    typeof profile.family_doctor === "object" &&
    !Array.isArray(profile.family_doctor)
      ? (profile.family_doctor as { name?: string; phone?: string; clinic?: string })
      : null;
  const fdName =
    blank(fd?.name) ||
    blank(profile.familyDoctorName as string) ||
    blank(profile.doctor_name as string);
  const fdPhone =
    blank(fd?.phone) ||
    blank(profile.familyDoctorPhone as string) ||
    blank(profile.doctor_phone as string);
  const fdClinic =
    blank(fd?.clinic) || blank(profile.doctor_clinic as string);

  return {
    name: blank(profile.full_name as string),
    age: years,
    ageMonths: months,
    gender: blank(profile.gender as string),
    bloodGroup: blank(profile.blood_group as string),
    conditions: (
      Array.isArray(profile.chronic_conditions)
        ? profile.chronic_conditions
        : []
    ).map(String).filter(Boolean),
    surgeries: (
      Array.isArray(profile.surgeries) ? profile.surgeries : []
    ).map(String).filter(Boolean),
    medications: rawMeds.map(parseMed).filter((m) => m.name),
    allergies: (
      Array.isArray(profile.allergies) ? profile.allergies : []
    ).map(String).filter(Boolean),
    vaccinations: (
      Array.isArray(profile.vaccinations) ? profile.vaccinations : []
    ).map(String).filter(Boolean),
    criticalFlags: critFlags,
    familyDoctor:
      fdName || fdPhone
        ? { name: fdName, phone: fdPhone, clinic: fdClinic }
        : null,
    generatedAt: new Date().toISOString(),
  };
}

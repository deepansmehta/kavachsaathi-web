import { decrypt, hasEncKey } from "@/lib/crypto";
import { ageFromDob, blank } from "./pdfCommon";

export type FormProfileInput = Record<string, unknown>;

export type CashlessPatientFields = {
  patientName: string;
  gender: string;
  ageYears: string;
  ageMonths: string;
  dateOfBirth: string;
  contact: string;
  alternateContact: string;
  insuredCardId: string;
  policyNumber: string;
  corporateName: string;
  employeeId: string;
  otherInsuranceYes: boolean | null;
  otherCompany: string;
  otherPolicyDetails: string;
  familyPhysicianYes: boolean | null;
  familyPhysicianName: string;
  familyPhysicianContact: string;
  currentAddress: string;
  occupation: string;
  tpaName: string;
  insurerName: string;
};

export type AdmissionSheetFields = {
  photoBytes: Uint8Array | null;
  photoContentType: string | null;
  fullName: string;
  ageGender: string;
  bloodGroup: string;
  allergies: string;
  conditions: string;
  medicines: string;
  address: string;
  emergencyContacts: string;
  idProofs: { type: string; masked: string }[];
  insurerName: string;
  tpaName: string;
  policyNumber: string;
  policyHolder: string;
  validTill: string;
  memberId: string;
  schemeName: string;
  govtCardNumber: string;
  autoSummaryEn?: string;
  autoSummaryHi?: string;
};

function safeDecrypt(enc: unknown): string {
  if (!enc || typeof enc !== "string") return "";
  if (!hasEncKey()) return "";
  try {
    return blank(decrypt(enc));
  } catch {
    return "";
  }
}

function formatDob(dob: string): string {
  const s = blank(dob);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function buildAddress(d: FormProfileInput): string {
  const addr = d.address as
    | {
        lineEnc?: string;
        city?: string;
        district?: string;
        state?: string;
        pincode?: string;
      }
    | undefined;
  const line = safeDecrypt(addr?.lineEnc) || blank(d.fullAddress);
  const parts = [
    line,
    blank(addr?.city || d.city),
    blank(addr?.district),
    blank(addr?.state),
    blank(addr?.pincode),
  ].filter(Boolean);
  return parts.join(", ");
}

export function extractCashlessFields(d: FormProfileInput): CashlessPatientFields {
  const insurance = d.insurance as
    | {
        private?: {
          insurerName?: string;
          policyNumberEnc?: string;
          policyHolderName?: string;
          tpaName?: string;
          memberIdEnc?: string;
          corporateName?: string;
          employeeIdEnc?: string;
          isGroupPolicy?: boolean;
        };
        otherMediclaim?: {
          hasOther?: boolean;
          companyName?: string;
          policyNumberEnc?: string;
        };
      }
    | undefined;

  const gender = blank(d.gender);
  const dob = blank(d.dateOfBirth || d.dob);
  const age = ageFromDob(dob);
  const fd =
    (d.family_doctor as { name?: string; phone?: string } | null) || null;
  const fdName = blank(d.familyDoctorName || fd?.name);
  const fdPhone = blank(d.familyDoctorPhone || fd?.phone);
  const hasFp =
    d.hasFamilyPhysician === true || d.hasFamilyPhysician === false
      ? Boolean(d.hasFamilyPhysician)
      : fdName || fdPhone
        ? true
        : null;

  const om = insurance?.otherMediclaim;
  const otherYes =
    om && typeof om.hasOther === "boolean"
      ? om.hasOther
      : om?.companyName || om?.policyNumberEnc
        ? true
        : null;

  const contacts = Array.isArray(d.emergency_contacts)
    ? (d.emergency_contacts as { phone?: string }[])
    : [];
  const altFromContacts = blank(contacts[0]?.phone);

  const corporate = insurance?.private?.isGroupPolicy
    ? blank(insurance?.private?.corporateName)
    : blank(insurance?.private?.corporateName);

  return {
    patientName: blank(d.full_name),
    gender,
    ageYears: age.years,
    ageMonths: age.months,
    dateOfBirth: formatDob(dob),
    contact: blank(d.phone),
    alternateContact: blank(d.alternateContact) || altFromContacts,
    insuredCardId: safeDecrypt(insurance?.private?.memberIdEnc),
    policyNumber: safeDecrypt(insurance?.private?.policyNumberEnc),
    corporateName: corporate,
    employeeId: safeDecrypt(insurance?.private?.employeeIdEnc),
    otherInsuranceYes: otherYes,
    otherCompany: blank(om?.companyName),
    otherPolicyDetails: safeDecrypt(om?.policyNumberEnc),
    familyPhysicianYes: hasFp,
    familyPhysicianName: fdName,
    familyPhysicianContact: fdPhone,
    currentAddress: buildAddress(d),
    occupation: blank(d.occupation),
    tpaName: blank(insurance?.private?.tpaName),
    insurerName: blank(insurance?.private?.insurerName),
  };
}

export function extractAdmissionFields(
  d: FormProfileInput,
  opts: { limited: boolean; photoBytes?: Uint8Array | null }
): AdmissionSheetFields {
  const insurance = d.insurance as
    | {
        private?: {
          insurerName?: string;
          policyNumberEnc?: string;
          policyHolderName?: string;
          validTill?: string;
          tpaName?: string;
          memberIdEnc?: string;
        };
        government?: {
          schemeName?: string;
          govtCardNumberEnc?: string;
        };
      }
    | undefined;

  const gender = blank(d.gender);
  const dob = blank(d.dateOfBirth || d.dob);
  const age = ageFromDob(dob);
  const agePart = [age.years ? `${age.years}y` : "", gender]
    .filter(Boolean)
    .join(" / ");

  const list = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => blank(x)).filter(Boolean).join(", ")
      : "";

  const contacts = Array.isArray(d.emergency_contacts)
    ? (d.emergency_contacts as { name?: string; phone?: string; relation?: string }[])
        .map((c) =>
          [blank(c.name), blank(c.relation), blank(c.phone)]
            .filter(Boolean)
            .join(" — ")
        )
        .filter(Boolean)
        .join("; ")
    : "";

  const idProofs: { type: string; masked: string }[] = [];
  if (!opts.limited && Array.isArray(d.idProofs)) {
    for (const raw of d.idProofs as {
      type?: string;
      numberEnc?: string | null;
      last4?: string;
    }[]) {
      const type = blank(raw.type);
      if (!type) continue;
      let masked = "";
      if (type === "aadhaar") {
        masked = raw.last4 ? `XXXX XXXX ${raw.last4}` : "";
      } else {
        const full = safeDecrypt(raw.numberEnc);
        if (full) {
          const tail = full.replace(/\W/g, "").slice(-4);
          masked = tail ? `XXXX${tail}` : "";
        } else if (raw.last4) {
          masked = `XXXX${raw.last4}`;
        }
      }
      idProofs.push({ type, masked });
    }
  }

  return {
    photoBytes: opts.photoBytes || null,
    photoContentType: "image/jpeg",
    fullName: blank(d.full_name),
    ageGender: agePart,
    bloodGroup: blank(d.blood_group),
    allergies: list(d.allergies) || "None recorded",
    conditions: list(d.chronic_conditions) || "None recorded",
    medicines: list(d.medications) || "None recorded",
    address: opts.limited ? "" : buildAddress(d),
    emergencyContacts: opts.limited ? "" : contacts,
    idProofs,
    insurerName: blank(insurance?.private?.insurerName),
    tpaName: blank(insurance?.private?.tpaName),
    policyNumber: safeDecrypt(insurance?.private?.policyNumberEnc),
    policyHolder: blank(insurance?.private?.policyHolderName),
    validTill: blank(insurance?.private?.validTill),
    memberId: safeDecrypt(insurance?.private?.memberIdEnc),
    schemeName: blank(insurance?.government?.schemeName),
    govtCardNumber: safeDecrypt(insurance?.government?.govtCardNumberEnc),
  };
}

/** Assert no forbidden substrings leaked into PDF text dump */
export function assertNoNullish(text: string): string[] {
  const bad: string[] = [];
  for (const w of ["undefined", "null", "NaN"]) {
    if (text.includes(w)) bad.push(w);
  }
  return bad;
}

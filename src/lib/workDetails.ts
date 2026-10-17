/**
 * Work / Employer Details — optional profile section (flag: workDetails).
 * PIN-only: employeeId, ESIC, company insurer + policy number.
 * Public /card shows only toggled-ON public-capable fields.
 */

import { encrypt, decrypt, hasEncKey } from "@/lib/crypto";

export const WORK_TYPES = [
  "job",
  "business",
  "student",
  "retired",
  "homemaker",
  "other",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const EMPLOYER_CONTACT_ROLES = [
  "Owner",
  "HR",
  "Manager",
  "Supervisor",
  "Other",
] as const;
export type EmployerContactRole = (typeof EMPLOYER_CONTACT_ROLES)[number];

export type WorkDetailsVisibility = {
  organisationName: boolean;
  city: boolean;
  employerContact: boolean;
  designation: boolean;
};

export const DEFAULT_WORK_VISIBILITY: WorkDetailsVisibility = {
  organisationName: true,
  city: true,
  employerContact: true,
  designation: false,
};

/** Owner / activation form payload (plaintext). */
export type WorkDetailsInput = {
  workType?: string;
  organisationName?: string;
  city?: string;
  designation?: string;
  employerContactName?: string;
  employerContactPhone?: string;
  employerContactRole?: string;
  employerContactConsent?: boolean;
  employeeId?: string;
  esicNumber?: string;
  companyInsurer?: string;
  companyPolicyNo?: string;
  visibility?: Partial<WorkDetailsVisibility>;
  /** true = clear the whole workDetails object */
  clear?: boolean;
};

/** Firestore shape — sensitive fields encrypted. */
export type WorkDetailsStored = {
  workType: WorkType | "";
  organisationName: string | null;
  city: string | null;
  designation: string | null;
  employerContactName: string | null;
  employerContactPhoneEnc: string | null;
  employerContactRole: EmployerContactRole | "" | null;
  employerContactConsent: boolean;
  employeeIdEnc: string | null;
  esicNumberEnc: string | null;
  companyInsurer: string | null;
  companyPolicyNoEnc: string | null;
  visibility: WorkDetailsVisibility;
};

/** Decrypted for /my-profile + Full Details (PIN). */
export type WorkDetailsEdit = {
  workType: WorkType | "";
  organisationName: string;
  city: string;
  designation: string;
  employerContactName: string;
  employerContactPhone: string;
  employerContactRole: EmployerContactRole | "";
  employerContactConsent: boolean;
  employeeId: string;
  esicNumber: string;
  companyInsurer: string;
  companyPolicyNo: string;
  visibility: WorkDetailsVisibility;
};

/** Public /card — never includes employeeId / ESIC / policy. */
export type PublicWorkDetails = {
  workType?: WorkType;
  organisationName?: string;
  city?: string;
  designation?: string;
  employerContactName?: string;
  employerContactPhone?: string;
  employerContactRole?: string;
};

const WORK_TYPE_LABELS: Record<WorkType, { en: string; hi: string }> = {
  job: { en: "Job", hi: "नौकरी" },
  business: { en: "Business", hi: "व्यवसाय" },
  student: { en: "Student", hi: "विद्यार्थी" },
  retired: { en: "Retired", hi: "सेवानिवृत्त" },
  homemaker: { en: "Homemaker", hi: "गृहणी" },
  other: { en: "Other", hi: "अन्य" },
};

export function workTypeLabel(t: string, lang: "en" | "hi" = "en"): string {
  if ((WORK_TYPES as readonly string[]).includes(t)) {
    return WORK_TYPE_LABELS[t as WorkType][lang];
  }
  return t;
}

export function normalizePhone10(raw: unknown): string {
  return String(raw || "")
    .replace(/\D/g, "")
    .slice(-10);
}

export function isValidInPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

function safeDec(enc: unknown): string {
  if (!enc || typeof enc !== "string" || !hasEncKey()) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
}

function mergeVisibility(
  v?: Partial<WorkDetailsVisibility> | null
): WorkDetailsVisibility {
  return {
    organisationName:
      typeof v?.organisationName === "boolean"
        ? v.organisationName
        : DEFAULT_WORK_VISIBILITY.organisationName,
    city:
      typeof v?.city === "boolean" ? v.city : DEFAULT_WORK_VISIBILITY.city,
    employerContact:
      typeof v?.employerContact === "boolean"
        ? v.employerContact
        : DEFAULT_WORK_VISIBILITY.employerContact,
    designation:
      typeof v?.designation === "boolean"
        ? v.designation
        : DEFAULT_WORK_VISIBILITY.designation,
  };
}

export function emptyWorkDetailsEdit(): WorkDetailsEdit {
  return {
    workType: "",
    organisationName: "",
    city: "",
    designation: "",
    employerContactName: "",
    employerContactPhone: "",
    employerContactRole: "",
    employerContactConsent: false,
    employeeId: "",
    esicNumber: "",
    companyInsurer: "",
    companyPolicyNo: "",
    visibility: { ...DEFAULT_WORK_VISIBILITY },
  };
}

/** Validate input. Returns error message or null. */
export function validateWorkDetailsInput(
  input: WorkDetailsInput | null | undefined
): string | null {
  if (!input || input.clear) return null;
  const phone = normalizePhone10(input.employerContactPhone);
  const name = String(input.employerContactName || "").trim();
  const hasContact = Boolean(name || phone);
  if (hasContact) {
    if (!name) return "Employer contact name is required";
    if (!isValidInPhone(phone)) {
      return "Employer contact phone must be a valid +91 mobile (10 digits)";
    }
    if (!input.employerContactConsent) {
      return "Employer contact consent is required";
    }
    const role = String(input.employerContactRole || "").trim();
    if (
      role &&
      !(EMPLOYER_CONTACT_ROLES as readonly string[]).includes(role)
    ) {
      return "Invalid employer contact role";
    }
  }
  const wt = String(input.workType || "").trim();
  if (wt && !(WORK_TYPES as readonly string[]).includes(wt)) {
    return "Invalid work type";
  }
  return null;
}

/** Encrypt + normalize for Firestore. null = clear field set. */
export function encodeWorkDetailsForStorage(
  input: WorkDetailsInput | null | undefined
): WorkDetailsStored | null {
  if (!input || input.clear) return null;
  if (!hasEncKey()) {
    throw new Error("Encryption not configured");
  }

  const phone = normalizePhone10(input.employerContactPhone);
  const name = String(input.employerContactName || "").trim();
  const hasContact = Boolean(name && isValidInPhone(phone));

  const wt = String(input.workType || "").trim();
  const workType = (WORK_TYPES as readonly string[]).includes(wt)
    ? (wt as WorkType)
    : "";

  const roleRaw = String(input.employerContactRole || "").trim();
  const role = (EMPLOYER_CONTACT_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as EmployerContactRole)
    : "";

  const employeeId = String(input.employeeId || "").trim();
  const esic = String(input.esicNumber || "").trim();
  const policy = String(input.companyPolicyNo || "").trim();

  const stored: WorkDetailsStored = {
    workType,
    organisationName: String(input.organisationName || "").trim() || null,
    city: String(input.city || "").trim() || null,
    designation: String(input.designation || "").trim() || null,
    employerContactName: hasContact ? name : null,
    employerContactPhoneEnc: hasContact ? encrypt(phone) : null,
    employerContactRole: hasContact ? role || null : null,
    employerContactConsent: hasContact
      ? Boolean(input.employerContactConsent)
      : false,
    employeeIdEnc: employeeId ? encrypt(employeeId) : null,
    esicNumberEnc: esic ? encrypt(esic) : null,
    companyInsurer: String(input.companyInsurer || "").trim() || null,
    companyPolicyNoEnc: policy ? encrypt(policy) : null,
    visibility: mergeVisibility(input.visibility),
  };

  // Drop empty shell
  const hasAny =
    stored.workType ||
    stored.organisationName ||
    stored.city ||
    stored.designation ||
    stored.employerContactName ||
    stored.employeeIdEnc ||
    stored.esicNumberEnc ||
    stored.companyInsurer ||
    stored.companyPolicyNoEnc;
  return hasAny ? stored : null;
}

export function decodeWorkDetailsForEdit(
  stored: unknown
): WorkDetailsEdit | null {
  if (!stored || typeof stored !== "object") return null;
  const s = stored as Partial<WorkDetailsStored>;
  const phone = safeDec(s.employerContactPhoneEnc);
  return {
    workType: (WORK_TYPES as readonly string[]).includes(String(s.workType || ""))
      ? (s.workType as WorkType)
      : "",
    organisationName: String(s.organisationName || ""),
    city: String(s.city || ""),
    designation: String(s.designation || ""),
    employerContactName: String(s.employerContactName || ""),
    employerContactPhone: phone,
    employerContactRole: (EMPLOYER_CONTACT_ROLES as readonly string[]).includes(
      String(s.employerContactRole || "")
    )
      ? (s.employerContactRole as EmployerContactRole)
      : "",
    employerContactConsent: Boolean(s.employerContactConsent),
    employeeId: safeDec(s.employeeIdEnc),
    esicNumber: safeDec(s.esicNumberEnc),
    companyInsurer: String(s.companyInsurer || ""),
    companyPolicyNo: safeDec(s.companyPolicyNoEnc),
    visibility: mergeVisibility(s.visibility),
  };
}

/**
 * Public projection for /card. Omits fields when toggle OFF.
 * NEVER includes employeeId / ESIC / companyPolicyNo / companyInsurer.
 */
export function toPublicWorkDetails(
  stored: unknown
): PublicWorkDetails | null {
  if (!stored || typeof stored !== "object") return null;
  const s = stored as Partial<WorkDetailsStored>;
  const vis = mergeVisibility(s.visibility);
  const out: PublicWorkDetails = {};

  if (vis.organisationName && s.organisationName) {
    out.organisationName = String(s.organisationName).trim();
  }
  if (vis.city && s.city) {
    out.city = String(s.city).trim();
  }
  if (vis.designation && s.designation) {
    out.designation = String(s.designation).trim();
  }
  if (vis.employerContact && s.employerContactName && s.employerContactPhoneEnc) {
    const phone = safeDec(s.employerContactPhoneEnc);
    if (phone && isValidInPhone(phone)) {
      out.employerContactName = String(s.employerContactName).trim();
      out.employerContactPhone = phone;
      if (s.employerContactRole) {
        out.employerContactRole = String(s.employerContactRole);
      }
    }
  }

  // No toggled-ON fields → omit entire block (workType alone must not leak)
  if (
    !out.organisationName &&
    !out.city &&
    !out.designation &&
    !out.employerContactPhone
  ) {
    return null;
  }

  const wt = String(s.workType || "");
  if ((WORK_TYPES as readonly string[]).includes(wt)) {
    out.workType = wt as WorkType;
  }
  return out;
}

/** Admission / Full Details (PIN) — includes decrypted PIN-only fields. */
export function workDetailsForAdmission(stored: unknown): {
  workType: string;
  organisationName: string;
  city: string;
  designation: string;
  employerContactName: string;
  employerContactPhone: string;
  employerContactRole: string;
  employeeId: string;
  esicNumber: string;
  companyInsurer: string;
  companyPolicyNo: string;
} | null {
  const edit = decodeWorkDetailsForEdit(stored);
  if (!edit) return null;
  const hasAny =
    edit.workType ||
    edit.organisationName ||
    edit.city ||
    edit.designation ||
    edit.employerContactName ||
    edit.employeeId ||
    edit.esicNumber ||
    edit.companyInsurer ||
    edit.companyPolicyNo;
  if (!hasAny) return null;
  return {
    workType: edit.workType,
    organisationName: edit.organisationName,
    city: edit.city,
    designation: edit.designation,
    employerContactName: edit.employerContactName,
    employerContactPhone: edit.employerContactPhone,
    employerContactRole: edit.employerContactRole,
    employeeId: edit.employeeId,
    esicNumber: edit.esicNumber,
    companyInsurer: edit.companyInsurer,
    companyPolicyNo: edit.companyPolicyNo,
  };
}

export function telLinkWork(phone: string | undefined | null): string | null {
  const p = normalizePhone10(phone);
  if (!isValidInPhone(p)) return null;
  return `tel:+91${p}`;
}

export function publicWorkLine(w: PublicWorkDetails): string {
  const parts: string[] = [];
  if (w.organisationName) parts.push(w.organisationName);
  if (w.city) parts.push(w.city);
  return parts.join(", ");
}

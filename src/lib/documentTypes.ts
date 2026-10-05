/** Client-safe document constants + validation (no Node crypto). */

export const ID_PROOF_TYPES = [
  "aadhaar",
  "pan",
  "voter_id",
  "driving_licence",
  "passport",
  "ration_card",
  "other",
] as const;

export type IdProofType = (typeof ID_PROOF_TYPES)[number];

export const ADDRESS_PROOF_OK_TYPES: IdProofType[] = [
  "aadhaar",
  "voter_id",
  "driving_licence",
  "passport",
  "ration_card",
];

export const PRIVATE_INSURERS = [
  "Star Health",
  "HDFC ERGO",
  "ICICI Lombard",
  "Bajaj Allianz",
  "Niva Bupa",
  "Care Health",
  "Max Bupa",
  "Reliance General",
  "New India Assurance",
  "Oriental Insurance",
  "United India",
  "Other",
] as const;

export const GOVT_SCHEMES = [
  "Ayushman Bharat PM-JAY",
  "CGHS",
  "ECHS",
  "ESIC",
  "Chirayu Haryana",
  "State scheme",
  "Other",
] as const;

export type CoverageType = "private" | "government" | "both";

export type IncomingIdProof = {
  type: string;
  number?: string;
  frontPath: string;
  backPath?: string | null;
};

export type IncomingAddress = {
  line: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
};

export type IncomingInsurance = {
  coverageType: CoverageType;
  private?: {
    insurerName: string;
    policyNumber: string;
    policyHolderName: string;
    validTill?: string | null;
    policyCardPath: string;
    policyBondPath: string;
    /** Optional — never blocks activation */
    tpaName?: string | null;
    memberId?: string | null;
    isGroupPolicy?: boolean;
    corporateName?: string | null;
    employeeId?: string | null;
  };
  government?: {
    schemeName: string;
    govtCardNumber: string;
    govtCardPath: string;
  };
  otherMediclaim?: {
    hasOther?: boolean;
    companyName?: string | null;
    policyNumber?: string | null;
  } | null;
};

export type IncomingConsents = {
  photoPublic: boolean;
  docsForAdmission: boolean;
  dpdpConsent: boolean;
};

export function validateMandatoryDocs(input: {
  photoPath?: string | null;
  idProofs?: IncomingIdProof[] | null;
  address?: IncomingAddress | null;
  addressProof?: {
    sameAsIdIndex?: number | null;
    type?: string;
    path?: string | null;
  } | null;
  insurance?: IncomingInsurance | null;
  consents?: IncomingConsents | null;
}): string[] {
  const missing: string[] = [];

  if (!input.photoPath) missing.push("photo");

  const ids = input.idProofs || [];
  if (ids.length !== 2) missing.push("idProofs (exactly 2)");
  else {
    const types = ids.map((i) => String(i.type || ""));
    if (types[0] === types[1]) missing.push("idProofs must be different types");
    for (let i = 0; i < 2; i++) {
      const id = ids[i];
      if (!ID_PROOF_TYPES.includes(id.type as IdProofType)) {
        missing.push(`idProofs[${i}].type`);
      }
      if (!id.frontPath) missing.push(`idProofs[${i}].front`);
      if (id.type === "aadhaar") {
        const last4 = String(id.number || "").replace(/\D/g, "").slice(-4);
        if (!/^\d{4}$/.test(last4)) missing.push("aadhaar last4");
      } else if (!String(id.number || "").trim()) {
        missing.push(`idProofs[${i}].number`);
      }
    }
  }

  const addr = input.address;
  if (
    !addr ||
    !String(addr.line || "").trim() ||
    !String(addr.city || "").trim() ||
    !String(addr.state || "").trim() ||
    !/^\d{6}$/.test(String(addr.pincode || "").replace(/\D/g, ""))
  ) {
    missing.push("address");
  }

  const ap = input.addressProof;
  if (!ap) missing.push("addressProof");
  else {
    const same =
      ap.sameAsIdIndex === 0 || ap.sameAsIdIndex === 1 ? ap.sameAsIdIndex : null;
    if (same !== null) {
      const t = ids[same]?.type as IdProofType | undefined;
      if (!t || !ADDRESS_PROOF_OK_TYPES.includes(t)) {
        missing.push("addressProof same-as-ID not allowed for that ID type");
      }
    } else if (!ap.path) {
      missing.push("addressProof.path");
    }
  }

  const ins = input.insurance;
  if (!ins || !["private", "government", "both"].includes(ins.coverageType)) {
    missing.push("insurance.coverageType");
  } else {
    if (ins.coverageType === "private" || ins.coverageType === "both") {
      const p = ins.private;
      if (!p?.insurerName) missing.push("insurance.private.insurerName");
      if (!p?.policyNumber) missing.push("insurance.private.policyNumber");
      if (!p?.policyHolderName) missing.push("insurance.private.policyHolderName");
      if (!p?.policyCardPath) missing.push("insurance.private.policyCard");
      if (!p?.policyBondPath) missing.push("insurance.private.policyBond");
    }
    if (ins.coverageType === "government" || ins.coverageType === "both") {
      const g = ins.government;
      if (!g?.schemeName) missing.push("insurance.government.schemeName");
      if (!g?.govtCardNumber) missing.push("insurance.government.govtCardNumber");
      if (!g?.govtCardPath) missing.push("insurance.government.govtCard");
    }
  }

  const c = input.consents;
  if (!c?.photoPublic || !c?.docsForAdmission || !c?.dpdpConsent) {
    missing.push("consents");
  }

  return missing;
}

export function publicInsuranceLine(insurance: unknown): {
  insurerName?: string;
  schemeName?: string;
} {
  if (!insurance || typeof insurance !== "object") return {};
  const i = insurance as {
    private?: { insurerName?: string };
    government?: { schemeName?: string };
  };
  return {
    insurerName: i.private?.insurerName,
    schemeName: i.government?.schemeName,
  };
}

export const COMMON_TPAS = [
  "Medi Assist",
  "Paramount Health Services",
  "MDIndia",
  "Health India TPA",
  "Family Health Plan (FHPL)",
  "Vidal Health",
  "Raksha TPA",
  "East West Assist",
  "Good Health TPA",
  "Heritage Health",
  "Other",
] as const;

export type GenderOption = "Male" | "Female" | "Third Gender";

/** Optional cashless / admission profile fields — never required for activation */
export type OptionalCashlessFields = {
  gender?: GenderOption | "";
  dateOfBirth?: string | null;
  occupation?: string | null;
  alternateContact?: string | null;
  tpaName?: string | null;
  memberId?: string | null;
  isGroupPolicy?: boolean;
  corporateName?: string | null;
  employeeId?: string | null;
  otherMediclaim?: {
    hasOther?: boolean;
    companyName?: string | null;
    policyNumber?: string | null;
  } | null;
  hasFamilyPhysician?: boolean | null;
};

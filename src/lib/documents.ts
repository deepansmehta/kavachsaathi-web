import { encrypt } from "./crypto";
import type {
  IncomingAddress,
  IncomingConsents,
  IncomingIdProof,
  IncomingInsurance,
  IdProofType,
} from "./documentTypes";

export * from "./documentTypes";

/** Build encrypted Firestore fields from validated input (Aadhaar: last4 only). */
export function buildEncryptedDocFields(input: {
  photoPath: string;
  idProofs: IncomingIdProof[];
  address: IncomingAddress;
  addressProof: {
    sameAsIdIndex?: number | null;
    type?: string;
    path?: string | null;
  };
  insurance: IncomingInsurance;
  consents: IncomingConsents;
}) {
  const idProofs = input.idProofs.map((id) => {
    const type = id.type as IdProofType;
    if (type === "aadhaar") {
      const last4 = String(id.number || "").replace(/\D/g, "").slice(-4);
      return {
        type,
        numberEnc: null,
        last4,
        frontPath: id.frontPath,
        backPath: id.backPath || null,
      };
    }
    return {
      type,
      numberEnc: encrypt(String(id.number || "").trim()),
      last4: String(id.number || "").replace(/\W/g, "").slice(-4),
      frontPath: id.frontPath,
      backPath: id.backPath || null,
    };
  });

  const address = {
    lineEnc: encrypt(String(input.address.line).trim()),
    city: String(input.address.city).trim(),
    district: String(input.address.district || "").trim() || null,
    state: String(input.address.state).trim(),
    pincode: String(input.address.pincode).replace(/\D/g, "").slice(0, 6),
  };

  const same =
    input.addressProof.sameAsIdIndex === 0 ||
    input.addressProof.sameAsIdIndex === 1
      ? input.addressProof.sameAsIdIndex
      : null;

  const addressProof = {
    sameAsIdIndex: same,
    type: same !== null ? idProofs[same].type : String(input.addressProof.type || ""),
    path: same !== null ? null : input.addressProof.path || null,
  };

  const coverageType = input.insurance.coverageType;
  const insurance: Record<string, unknown> = { coverageType };
  if (coverageType === "private" || coverageType === "both") {
    const p = input.insurance.private!;
    const memberId = String(p.memberId || "").trim();
    const employeeId = String(p.employeeId || "").trim();
    insurance.private = {
      insurerName: p.insurerName,
      policyNumberEnc: encrypt(p.policyNumber.trim()),
      policyHolderName: p.policyHolderName.trim(),
      validTill: p.validTill || null,
      policyCardPath: p.policyCardPath,
      policyBondPath: p.policyBondPath,
      tpaName: String(p.tpaName || "").trim() || null,
      memberIdEnc: memberId ? encrypt(memberId) : null,
      isGroupPolicy: Boolean(p.isGroupPolicy),
      corporateName: String(p.corporateName || "").trim() || null,
      employeeIdEnc: employeeId ? encrypt(employeeId) : null,
    };
  }
  if (coverageType === "government" || coverageType === "both") {
    const g = input.insurance.government!;
    insurance.government = {
      schemeName: g.schemeName,
      govtCardNumberEnc: encrypt(g.govtCardNumber.trim()),
      govtCardPath: g.govtCardPath,
    };
  }
  const om = input.insurance.otherMediclaim;
  if (om && typeof om === "object") {
    const otherPol = String(om.policyNumber || "").trim();
    insurance.otherMediclaim = {
      hasOther: Boolean(om.hasOther),
      companyName: String(om.companyName || "").trim() || null,
      policyNumberEnc: otherPol ? encrypt(otherPol) : null,
    };
  }

  return {
    photo: {
      path: input.photoPath,
      contentType: "image/jpeg",
      uploadedAt: new Date().toISOString(),
    },
    idProofs,
    address,
    addressProof,
    insurance,
    consents: {
      photoPublic: true,
      docsForAdmission: true,
      dpdpConsent: true,
      at: new Date().toISOString(),
    },
    profileComplete: true,
  };
}

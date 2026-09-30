/**
 * Unit checks for mandatory docs validation (no Storage / network).
 *   npx tsx scripts/test-docs-validation.ts
 */
import {
  validateMandatoryDocs,
  buildEncryptedDocFields,
} from "../src/lib/documents";

process.env.PROFILE_ENC_KEY = Buffer.alloc(32, 7).toString("base64");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  photoPath: "pending/x/photo.jpg",
  idProofs: [
    { type: "aadhaar", number: "1234", frontPath: "pending/x/id1.jpg" },
    { type: "pan", number: "ABCDE1234F", frontPath: "pending/x/id2.jpg" },
  ],
  address: {
    line: "12 Test Street",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122001",
  },
  addressProof: { sameAsIdIndex: 0 as number | null },
  insurance: {
    coverageType: "private" as const,
    private: {
      insurerName: "Star Health",
      policyNumber: "POL123",
      policyHolderName: "Test",
      policyCardPath: "pending/x/pc.jpg",
      policyBondPath: "pending/x/pb.pdf",
    },
  },
  consents: {
    photoPublic: true,
    docsForAdmission: true,
    dpdpConsent: true,
  },
};

const rows: { id: string; result: string }[] = [];

{
  const m = validateMandatoryDocs({ ...base, photoPath: null });
  rows.push({ id: "1 no photo", result: m.includes("photo") ? "PASS" : "FAIL" });
}
{
  const m = validateMandatoryDocs({
    ...base,
    idProofs: [base.idProofs[0]],
  });
  rows.push({
    id: "2 only 1 ID",
    result: m.some((x) => x.includes("idProofs")) ? "PASS" : "FAIL",
  });
}
{
  const m = validateMandatoryDocs({
    ...base,
    idProofs: [
      { type: "pan", number: "A", frontPath: "a" },
      { type: "pan", number: "B", frontPath: "b" },
    ],
  });
  rows.push({
    id: "2 same type IDs",
    result: m.some((x) => x.includes("different")) ? "PASS" : "FAIL",
  });
}
{
  const m = validateMandatoryDocs({
    ...base,
    insurance: {
      coverageType: "private",
      private: {
        insurerName: "Star Health",
        policyNumber: "",
        policyHolderName: "T",
        policyCardPath: "a",
        policyBondPath: "",
      },
    },
  });
  rows.push({
    id: "3 private missing bond/number",
    result:
      m.some((x) => x.includes("policyNumber") || x.includes("policyBond"))
        ? "PASS"
        : "FAIL",
  });
}
{
  const m = validateMandatoryDocs({
    ...base,
    insurance: {
      coverageType: "government",
      government: {
        schemeName: "CGHS",
        govtCardNumber: "",
        govtCardPath: "g.jpg",
      },
    },
  });
  rows.push({
    id: "4 govt missing card number",
    result: m.some((x) => x.includes("govtCardNumber")) ? "PASS" : "FAIL",
  });
}
{
  const m = validateMandatoryDocs(base);
  rows.push({ id: "5 valid payload", result: m.length === 0 ? "PASS" : "FAIL" });
  if (m.length === 0) {
    const fields = buildEncryptedDocFields(base);
    const aadhaar = fields.idProofs.find((i) => i.type === "aadhaar");
    rows.push({
      id: "10 aadhaar no full number",
      result:
        aadhaar && aadhaar.numberEnc === null && aadhaar.last4 === "1234"
          ? "PASS"
          : "FAIL",
    });
  }
}

console.log("=== docs validation ===");
for (const r of rows) console.log(`${r.result.padEnd(6)} ${r.id}`);
assert(rows.every((r) => r.result === "PASS"), "some checks failed");
console.log("all OK");

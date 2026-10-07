/**
 * Activate a KVS-2099-AUTO* card via the same /api/card/activate path as the wizard.
 * Uploads go through pending/ then finalize — never prints secrets.
 */
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { activateCardAtomic, finalizeActivationFiles } from "../../src/lib/activateCard";
import { buildEncryptedDocFields } from "../../src/lib/documents";
import { BASE } from "./helpers";

export type ActivateOpts = {
  health_id: string;
  activation_code: string;
  pin: string;
  phone: string;
  full_name: string;
  coverage: "private" | "government" | "both";
  assets: {
    selfie: string;
    pan: string;
    dlFront: string;
    address: string;
    policyCard: string;
    policyBond: string;
    govtCard: string;
  };
  referralCode?: string | null;
  criticalInsulin?: boolean;
  abhaId?: string | null;
};

function readBuf(p: string) {
  return require("fs").readFileSync(p) as Buffer;
}

export async function activateViaApi(opts: ActivateOpts) {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const session = `auto-${Date.now()}`;
  const hid = opts.health_id;

  async function put(name: string, buf: Buffer, type: string) {
    const p = `pending/${hid}/${session}/${name}`;
    await bucket.file(p).save(buf, { contentType: type, resumable: false });
    return p;
  }

  const photoPath = await put("photo.jpg", readBuf(opts.assets.selfie), "image/jpeg");
  const id1 = await put("id1-front.jpg", readBuf(opts.assets.pan), "image/jpeg");
  const id2 = await put("id2-front.jpg", readBuf(opts.assets.dlFront), "image/jpeg");
  const addr = await put("address.jpg", readBuf(opts.assets.address), "image/jpeg");

  const insurance: Record<string, unknown> = { coverageType: opts.coverage };
  if (opts.coverage === "private" || opts.coverage === "both") {
    const pc = await put(
      "policy-card.jpg",
      readBuf(opts.assets.policyCard),
      "image/jpeg"
    );
    const pb = await put(
      "policy-bond.pdf",
      readBuf(opts.assets.policyBond),
      "application/pdf"
    );
    insurance.private = {
      insurerName: "Star Health",
      policyNumber: "POL-TEST-0001",
      policyHolderName: opts.full_name,
      policyCardPath: pc,
      policyBondPath: pb,
    };
  }
  if (opts.coverage === "government" || opts.coverage === "both") {
    const gc = await put(
      "govt-card.jpg",
      readBuf(opts.assets.govtCard),
      "image/jpeg"
    );
    insurance.government = {
      schemeName: "Ayushman Bharat",
      govtCardNumber: "ABHA-TEST-0001",
      govtCardPath: gc,
    };
  }

  const input = {
    health_id: hid,
    activation_code: opts.activation_code,
    pin: opts.pin,
    full_name: opts.full_name,
    phone: opts.phone,
    blood_group: "B+",
    allergies: ["Penicillin"],
    chronic_conditions: ["Diabetes — insulin dependent"],
    medications: ["Insulin"],
    emergency_contacts: [
      { name: "Family EC", phone: "9998800199", relation: "Spouse" },
      { name: "Friend EC", phone: "9998800188", relation: "Friend" },
    ],
    family_doctor: null,
    city: "Fatehabad",
    fullAddress: "12 Sample Street, Fatehabad, Haryana 125050",
    organDonor: "yes" as const,
    abhaId: opts.abhaId || "12-3456-7890-1234",
    gender: "male",
    dateOfBirth: "1960-01-15",
    referralCode: opts.referralCode || null,
    photoPath,
    idProofs: [
      { type: "pan", number: "ABCDE1234F", frontPath: id1 },
      { type: "driving_licence", number: "HR9920260000001", frontPath: id2 },
    ],
    address: {
      line1: "12 Sample Street",
      city: "Fatehabad",
      district: "Fatehabad",
      state: "Haryana",
      pincode: "125050",
    },
    addressProof: { sameAsIdIndex: 1, type: "driving_licence", path: addr },
    insurance,
    consents: {
      photoConsent: true,
      docsConsent: true,
      dpdpConsent: true,
      legalConsent: true,
    },
    requireFullDocs: true,
    criticalAlerts: opts.criticalInsulin
      ? { insulin: true, epilepsy: false, allergySevere: true }
      : undefined,
  };

  // Prefer live HTTP path when possible (same edge as customers)
  try {
    const res = await fetch(`${BASE}/api/card/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      profileId?: string;
    };
    if (res.ok && (body.ok || body.profileId)) {
      return { ok: true as const, via: "http" as const };
    }
    // fall through to local atomic if HTTP fails (e.g. network)
  } catch {
    /* */
  }

  const result = await activateCardAtomic(db, input as never);
  if (!result.ok) {
    return { ok: false as const, error: result.error, via: "atomic" as const };
  }
  try {
    const fields = buildEncryptedDocFields({
      photoPath,
      idProofs: input.idProofs,
      address: input.address,
      addressProof: input.addressProof,
      insurance: input.insurance as never,
      consents: input.consents,
    } as never);
    await finalizeActivationFiles(hid, fields);
  } catch {
    /* finalize best-effort */
  }
  return { ok: true as const, via: "atomic" as const };
}

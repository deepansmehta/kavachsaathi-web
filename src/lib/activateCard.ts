import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { hashPin, isValidPin, normalizePin } from "./pin";
import {
  cardIsActivated,
  cardIsBlocked,
  findCardByHealthId,
  type CardRecord,
} from "./cardsRepo";
import { normalizeHealthId, isValidHealthId } from "./healthId";
import { normalizePhone, phoneLocal10 } from "./phone";
import {
  formatAbhaId,
  isValidAbhaId,
  normalizeAbhaId,
  parseCriticalAlerts,
  parseOrganDonor,
  type CriticalAlerts,
  type OrganDonorValue,
} from "./profileFields";
import {
  buildEncryptedDocFields,
  validateMandatoryDocs,
  type IncomingAddress,
  type IncomingConsents,
  type IncomingIdProof,
  type IncomingInsurance,
} from "./documents";
import { hasEncKey } from "./crypto";
import { isStorageConfigured, moveObject, deletePrefix } from "./storage";

export type ActivateInput = {
  health_id: string;
  activation_code: string;
  pin: string;
  full_name: string;
  phone: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  emergency_contacts: { name: string; phone: string; relation?: string }[];
  family_doctor: { name: string; phone: string } | null;
  photo_url?: string | null;
  city: string;
  fullAddress?: string | null;
  organDonor?: OrganDonorValue | string;
  preferredHospital?: string | null;
  familyDoctorName?: string | null;
  familyDoctorPhone?: string | null;
  criticalAlerts?: CriticalAlerts | unknown;
  abhaId?: string | null;
  /** Optional cashless / admission demographics — never required */
  gender?: string | null;
  dateOfBirth?: string | null;
  occupation?: string | null;
  alternateContact?: string | null;
  hasFamilyPhysician?: boolean | null;
  /** Full-details mandatory docs (Part A/B) */

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
  /** When true, reject if mandatory docs missing (default true when storage+enc ready) */
  requireFullDocs?: boolean;
};

export type ActivateResult =
  | { ok: true; profileId: string; health_id: string }
  | { ok: false; status: number; error: string };

/**
 * Atomic activation: verify activation_code + status inside a transaction,
 * create profiles doc with bcrypt PIN hash, flip card to activated.
 */
export async function activateCardAtomic(
  db: Firestore,
  input: ActivateInput
): Promise<ActivateResult> {
  const health_id = normalizeHealthId(input.health_id);
  if (!isValidHealthId(health_id)) {
    return { ok: false, status: 400, error: "Invalid health_id" };
  }

  const enteredCode = String(input.activation_code || "")
    .trim()
    .padStart(4, "0")
    .slice(0, 4);
  if (!/^\d{4}$/.test(enteredCode)) {
    return {
      ok: false,
      status: 400,
      error: "Enter the 4-digit activation code from your card packaging",
    };
  }

  const pin = normalizePin(input.pin);
  if (!isValidPin(pin)) {
    return {
      ok: false,
      status: 400,
      error: "PIN must be 4–6 digits",
    };
  }

  const phoneNormalized = normalizePhone(input.phone);
  if (!phoneNormalized) {
    return { ok: false, status: 400, error: "Enter a valid 10-digit mobile" };
  }
  const phone = phoneLocal10(phoneNormalized)!;

  const full_name = String(input.full_name || "").trim();
  const blood_group = String(input.blood_group || "").trim();
  const city = String(input.city || "").trim();
  if (full_name.length < 2) {
    return { ok: false, status: 400, error: "Full name is required" };
  }
  if (!blood_group) {
    return { ok: false, status: 400, error: "Blood group is required" };
  }
  if (city.length < 2) {
    return { ok: false, status: 400, error: "City is required" };
  }
  if (!isValidAbhaId(input.abhaId || "")) {
    return {
      ok: false,
      status: 400,
      error: "ABHA ID must be 14 digits (hyphens optional)",
    };
  }

  const docsRequired =
    input.requireFullDocs !== false &&
    isStorageConfigured() &&
    hasEncKey();

  let docFields: ReturnType<typeof buildEncryptedDocFields> | null = null;
  if (docsRequired) {
    const missing = validateMandatoryDocs({
      photoPath: input.photoPath,
      idProofs: input.idProofs,
      address: input.address,
      addressProof: input.addressProof,
      insurance: input.insurance,
      consents: input.consents,
    });
    if (missing.length) {
      return {
        ok: false,
        status: 400,
        error: `Missing required: ${missing.join(", ")}`,
      };
    }
    try {
      docFields = buildEncryptedDocFields({
        photoPath: input.photoPath!,
        idProofs: input.idProofs!,
        address: input.address!,
        addressProof: input.addressProof!,
        insurance: input.insurance!,
        consents: input.consents!,
      });
    } catch (e) {
      return {
        ok: false,
        status: 500,
        error: e instanceof Error ? e.message : "Document encryption failed",
      };
    }
  } else if (input.requireFullDocs === true) {
    return {
      ok: false,
      status: 503,
      error: "Document storage is not configured yet",
    };
  }

  const contacts = (input.emergency_contacts || [])
    .map((c) => {
      const name = String(c.name || "").trim();
      const phone = String(c.phone || "")
        .replace(/\D/g, "")
        .slice(-10);
      const relation = c.relation ? String(c.relation).trim() : "";
      const out: { name: string; phone: string; relation?: string } = {
        name,
        phone,
      };
      if (relation) out.relation = relation;
      return out;
    })
    .filter((c) => c.name && /^[6-9]\d{9}$/.test(c.phone));

  if (contacts.length < 1 || contacts.length > 3) {
    return {
      ok: false,
      status: 400,
      error: "Provide 1–3 emergency contacts with valid phones",
    };
  }

  const card = await findCardByHealthId(db, health_id);
  if (!card) {
    return { ok: false, status: 404, error: "Card not found" };
  }
  if (cardIsBlocked(card)) {
    return {
      ok: false,
      status: 403,
      error: "This card is blocked. Unblock it from My Profile first.",
    };
  }
  if (cardIsActivated(card)) {
    return {
      ok: false,
      status: 409,
      error: "This card is already activated",
    };
  }

  // Pre-check activation code (also re-checked inside transaction)
  if (card.activation_code.padStart(4, "0") !== enteredCode) {
    return {
      ok: false,
      status: 403,
      error: "Activation code does not match this card",
    };
  }

  const pin_hash = await hashPin(pin);
  const profileRef = db.collection("profiles").doc();
  const cardRef = db.collection("cards").doc(card.docId);

  const doctorName = String(
    input.familyDoctorName || input.family_doctor?.name || ""
  ).trim();
  const doctorPhone = String(
    input.familyDoctorPhone || input.family_doctor?.phone || ""
  )
    .replace(/\D/g, "")
    .slice(-10);
  const family_doctor =
    doctorName || doctorPhone
      ? { name: doctorName || "Doctor", phone: doctorPhone }
      : null;

  const organDonor = parseOrganDonor(input.organDonor);
  const criticalAlerts = parseCriticalAlerts(input.criticalAlerts);
  const abhaDigits = normalizeAbhaId(input.abhaId || "");
  const preferredHospital =
    String(input.preferredHospital || "").trim() || null;
  const fullAddress = String(input.fullAddress || "").trim() || null;

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(cardRef);
      if (!fresh.exists) {
        throw Object.assign(new Error("Card not found"), { status: 404 });
      }
      const data = fresh.data()!;
      const status = String(data.status || "unactivated");
      if (status === "blocked") {
        throw Object.assign(
          new Error("This card is blocked. Unblock it from My Profile first."),
          { status: 403 }
        );
      }
      if (status === "activated" || status === "active") {
        throw Object.assign(new Error("This card is already activated"), {
          status: 409,
        });
      }
      const storedCode = String(data.activation_code || fresh.id)
        .padStart(4, "0")
        .slice(0, 4);
      if (storedCode !== enteredCode) {
        throw Object.assign(
          new Error("Activation code does not match this card"),
          { status: 403 }
        );
      }

      tx.set(profileRef, {
        health_id,
        activation_code: storedCode, // forgot-PIN only — never public
        full_name,
        phone,
        phoneNormalized,
        blood_group,
        city,
        fullAddress,
        organDonor,
        preferredHospital,
        familyDoctorName: doctorName || null,
        familyDoctorPhone: doctorPhone || null,
        criticalAlerts: {
          tags: criticalAlerts.tags,
          ...(criticalAlerts.otherText
            ? { otherText: criticalAlerts.otherText }
            : {}),
        },
        abhaId: abhaDigits ? formatAbhaId(abhaDigits) : null,
        gender: String(input.gender || "").trim() || null,
        dateOfBirth: String(input.dateOfBirth || "").trim() || null,
        occupation: String(input.occupation || "").trim() || null,
        alternateContact: String(input.alternateContact || "").replace(/\D/g, "").slice(-10) || null,
        hasFamilyPhysician:
          input.hasFamilyPhysician === true || input.hasFamilyPhysician === false
            ? input.hasFamilyPhysician
            : doctorName || doctorPhone
              ? true
              : null,
        allergies: input.allergies || [],
        chronic_conditions: input.chronic_conditions || [],
        medications: input.medications || [],
        emergency_contacts: contacts,
        family_doctor,
        photo_url: input.photo_url || null,
        pin_hash,
        lastSeenScansAt: null,
        profileComplete: Boolean(docFields),
        ...(docFields || {}),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      tx.update(cardRef, {
        status: "activated",
        linkedProfileId: profileRef.id,
        activated_at: FieldValue.serverTimestamp(),
        // never overwrite health_id / activation_code / created_at / tier / validTill
      });
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Activation failed";
    if (status === 403 || status === 409 || status === 404) {
      return { ok: false, status, error: message };
    }
    console.error("activateCardAtomic", err);
    return { ok: false, status: 500, error: message };
  }

  return { ok: true, profileId: profileRef.id, health_id };
}

/** After successful activation, move pending uploads into profiles/{health_id}/ */
export async function finalizeActivationFiles(
  health_id: string,
  docFields: ReturnType<typeof buildEncryptedDocFields> | null
): Promise<void> {
  if (!docFields || !isStorageConfigured()) return;
  const hid = normalizeHealthId(health_id);
  const moves: { from: string; to: string }[] = [];

  const photoFrom = docFields.photo.path;
  if (photoFrom.startsWith("pending/")) {
    const to = `profiles/${hid}/photo.jpg`;
    moves.push({ from: photoFrom, to });
    docFields.photo.path = to;
  }

  for (let i = 0; i < docFields.idProofs.length; i++) {
    const id = docFields.idProofs[i];
    const n = i + 1;
    if (id.frontPath?.startsWith("pending/")) {
      const to = `profiles/${hid}/id${n}-front.jpg`;
      moves.push({ from: id.frontPath, to });
      id.frontPath = to;
    }
    if (id.backPath?.startsWith("pending/")) {
      const to = `profiles/${hid}/id${n}-back.jpg`;
      moves.push({ from: id.backPath, to });
      id.backPath = to;
    }
  }

  if (docFields.addressProof.path?.startsWith("pending/")) {
    const to = `profiles/${hid}/address-proof.jpg`;
    moves.push({ from: docFields.addressProof.path, to });
    docFields.addressProof.path = to;
  }

  const ins = docFields.insurance as {
    private?: { policyCardPath?: string; policyBondPath?: string };
    government?: { govtCardPath?: string };
  };
  if (ins.private?.policyCardPath?.startsWith("pending/")) {
    const to = `profiles/${hid}/policy-card.jpg`;
    moves.push({ from: ins.private.policyCardPath, to });
    ins.private.policyCardPath = to;
  }
  if (ins.private?.policyBondPath?.startsWith("pending/")) {
    const to = `profiles/${hid}/policy-bond.pdf`;
    moves.push({ from: ins.private.policyBondPath, to });
    ins.private.policyBondPath = to;
  }
  if (ins.government?.govtCardPath?.startsWith("pending/")) {
    const to = `profiles/${hid}/govt-card.jpg`;
    moves.push({ from: ins.government.govtCardPath, to });
    ins.government.govtCardPath = to;
  }

  for (const m of moves) {
    await moveObject(m.from, m.to).catch(() => {});
  }
  await deletePrefix(`pending/${hid}/`).catch(() => {});
}

export type FindProfileLoginResult =
  | {
      status: "found";
      profileId: string;
      data: Record<string, unknown>;
      card: CardRecord | null;
    }
  | { status: "not_found" }
  | { status: "ambiguous"; count: number };

export async function findProfileByLogin(
  db: Firestore,
  identifier: string
): Promise<FindProfileLoginResult> {
  const raw = String(identifier || "").trim();
  if (!raw) return { status: "not_found" };

  // health_id
  if (isValidHealthId(raw)) {
    const health_id = normalizeHealthId(raw);
    const card = await findCardByHealthId(db, health_id);
    if (card?.linkedProfileId) {
      const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
      if (snap.exists) {
        return {
          status: "found",
          profileId: snap.id,
          data: snap.data() as Record<string, unknown>,
          card,
        };
      }
    }
    const q = await db
      .collection("profiles")
      .where("health_id", "==", health_id)
      .limit(2)
      .get();
    if (q.empty) return { status: "not_found" };
    if (q.size > 1) return { status: "ambiguous", count: q.size };
    return {
      status: "found",
      profileId: q.docs[0].id,
      data: q.docs[0].data() as Record<string, unknown>,
      card,
    };
  }

  // phone — query phoneNormalized first, then legacy `phone` (10-digit)
  const phoneNormalized = normalizePhone(raw);
  if (!phoneNormalized) return { status: "not_found" };
  const local10 = phoneLocal10(phoneNormalized)!;

  const byNorm = await db
    .collection("profiles")
    .where("phoneNormalized", "==", phoneNormalized)
    .limit(5)
    .get();

  let docs = byNorm.docs;

  if (docs.length === 0) {
    const byLegacy = await db
      .collection("profiles")
      .where("phone", "==", local10)
      .limit(5)
      .get();
    docs = byLegacy.docs;
  }

  if (docs.length === 0) return { status: "not_found" };
  if (docs.length > 1) return { status: "ambiguous", count: docs.length };

  const doc = docs[0];
  const data = doc.data() as Record<string, unknown>;
  const card = data.health_id
    ? await findCardByHealthId(db, String(data.health_id))
    : null;
  return {
    status: "found",
    profileId: doc.id,
    data,
    card,
  };
}

import type { Firestore } from "firebase-admin/firestore";
import {
  isCardActivatedStatus,
  isCardBlockedStatus,
  isValidHealthId,
  normalizeHealthId,
} from "./healthId";
import {
  criticalAlertsDisplay,
  criticalFlagsDisplay,
  parseCriticalAlerts,
  parseCriticalFlags,
  parseOrganDonor,
  type CriticalAlerts,
  type CriticalFlags,
  type OrganDonorValue,
} from "./profileFields";

export type CardRecord = {
  docId: string;
  activation_code: string;
  health_id: string;
  status: string;
  tier?: string;
  user_uid?: string | null;
  linkedProfileId?: string | null;
  activated_at?: unknown;
  created_at?: unknown;
  validTill?: string | null;
  lastScanLoggedAt?: unknown;
  lastScanDocId?: string | null;
  isDemo?: boolean;
};

function mapCard(
  docId: string,
  data: FirebaseFirestore.DocumentData,
  health_id: string
): CardRecord {
  return {
    docId,
    activation_code: String(data.activation_code || docId),
    health_id: String(data.health_id || health_id),
    status: String(data.status || "unactivated"),
    tier: data.tier ? String(data.tier) : undefined,
    user_uid: (data.user_uid as string) || null,
    linkedProfileId: (data.linkedProfileId as string) || null,
    activated_at: data.activated_at ?? null,
    created_at: data.created_at ?? null,
    validTill: data.validTill ? String(data.validTill) : null,
    lastScanLoggedAt: data.lastScanLoggedAt ?? null,
    lastScanDocId: data.lastScanDocId ? String(data.lastScanDocId) : null,
    isDemo: data.isDemo === true,
  };
}

export async function findCardByHealthId(
  db: Firestore,
  healthIdRaw: string
): Promise<CardRecord | null> {
  const health_id = normalizeHealthId(healthIdRaw);
  if (!isValidHealthId(health_id)) return null;

  const q = await db
    .collection("cards")
    .where("health_id", "==", health_id)
    .limit(1)
    .get();

  if (!q.empty) {
    const d = q.docs[0];
    return mapCard(d.id, d.data(), health_id);
  }

  const direct = await db.collection("cards").doc(health_id).get();
  if (direct.exists) {
    return mapCard(direct.id, direct.data()!, health_id);
  }

  return null;
}

export function cardIsActivated(card: CardRecord): boolean {
  return isCardActivatedStatus(card.status);
}

export function cardIsBlocked(card: CardRecord): boolean {
  return isCardBlockedStatus(card.status);
}

/** Public emergency view — NEVER include health_id, activation_code, fullAddress, abhaId */
export type PublicEmergencyProfile = {
  name: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  emergency_contacts: { name: string; phone: string; relation?: string }[];
  family_doctor: { name: string; phone: string } | null;
  photo_url?: string | null;
  /** Short-lived signed URL filled by the card page when Storage is ready */
  photoSignedUrl?: string | null;
  city?: string | null;
  preferredHospital?: string | null;
  organDonor?: OrganDonorValue;
  criticalAlerts: CriticalAlerts;
  criticalAlertLabels: string[];
  criticalFlags: CriticalFlags;
  criticalFlagLabels: string[];
  sectionsRendered: string[];
  insurerName?: string | null;
  schemeName?: string | null;
  health_id?: string | null;
};

export async function loadEmergencyProfile(
  db: Firestore,
  card: CardRecord
): Promise<PublicEmergencyProfile | null> {
  if (!cardIsActivated(card) || cardIsBlocked(card)) return null;

  if (card.linkedProfileId) {
    const snap = await db.collection("profiles").doc(card.linkedProfileId).get();
    if (snap.exists) {
      return mapPublicProfile(snap.data() as Record<string, unknown>);
    }
  }

  if (card.user_uid) {
    const snap = await db.collection("users").doc(card.user_uid).get();
    if (snap.exists) {
      return mapPublicProfile(snap.data() as Record<string, unknown>);
    }
  }

  return null;
}

function mapPublicProfile(
  data: Record<string, unknown>
): PublicEmergencyProfile {
  const contactsRaw =
    (Array.isArray(data.emergency_contacts) && data.emergency_contacts) ||
    [
      data.emergency_contact_1,
      data.emergency_contact_2,
      data.emergency_contact_3,
    ].filter(Boolean);

  const emergency_contacts = (contactsRaw as unknown[])
    .map((raw) => {
      const c = raw as { name?: string; phone?: string; relation?: string };
      return {
        name: String(c?.name || "").trim(),
        phone: String(c?.phone || "").trim(),
        relation: c?.relation ? String(c.relation) : undefined,
      };
    })
    .filter((c) => c.name || c.phone);

  const fd =
    data.family_doctor && typeof data.family_doctor === "object"
      ? (data.family_doctor as { name?: string; phone?: string })
      : null;
  const doctorName = String(
    fd?.name || data.familyDoctorName || data.doctor_name || ""
  ).trim();
  const doctorPhone = String(
    fd?.phone || data.familyDoctorPhone || data.doctor_phone || ""
  ).trim();

  const criticalAlerts = parseCriticalAlerts(data.criticalAlerts);
  const criticalFlags = parseCriticalFlags(data.criticalFlags);
  const organDonor = parseOrganDonor(
    data.organDonor ?? data.organ_donor
  );
  const city = String(data.city || "").trim() || null;
  const preferredHospital =
    String(data.preferredHospital || "").trim() || null;

  const allergies = asArr(data.allergies);
  const chronic_conditions = asArr(
    data.chronic_conditions || data.medical_conditions || data.medicalConditions
  );
  const medications = asArr(data.medications || data.current_medications);

  const sectionsRendered = ["basic"];
  if (
    criticalAlerts.tags.length ||
    criticalAlerts.otherText ||
    criticalFlags.tags.length
  ) {
    sectionsRendered.push("critical");
  }
  if (
    allergies.length ||
    chronic_conditions.length ||
    medications.length ||
    organDonor !== "unset"
  ) {
    sectionsRendered.push("medical");
  }
  if (emergency_contacts.length) sectionsRendered.push("contacts");
  if (doctorName || doctorPhone) sectionsRendered.push("doctor");
  if (preferredHospital || city) sectionsRendered.push("location");

  const photoObj = data.photo as { path?: string } | undefined;
  const insurance = data.insurance as
    | {
        private?: { insurerName?: string };
        government?: { schemeName?: string };
      }
    | undefined;

  return {
    name: String(data.full_name || data.name || "").trim() || "Not provided",
    blood_group: String(data.blood_group || data.bloodGroup || "").trim() || "—",
    allergies,
    chronic_conditions,
    medications,
    emergency_contacts,
    family_doctor:
      doctorName || doctorPhone
        ? { name: doctorName || "Doctor", phone: doctorPhone }
        : null,
    photo_url: (data.photo_url || data.profile_photo || photoObj?.path || null) as
      | string
      | null,
    city,
    preferredHospital,
    organDonor,
    criticalAlerts,
    criticalAlertLabels: criticalAlertsDisplay(criticalAlerts),
    criticalFlags,
    criticalFlagLabels: criticalFlagsDisplay(criticalFlags),
    sectionsRendered,
    insurerName: insurance?.private?.insurerName || null,
    schemeName: insurance?.government?.schemeName || null,
    health_id: String(data.health_id || "").trim() || null,
  };
}

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

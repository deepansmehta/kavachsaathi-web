import type {
  CardDoc,
  UserProfile,
  EmergencyPublicView,
  SimpleContact,
} from "./types";
import { getDemoCard, getDemoProfile, isDemoCode } from "./demo";

function asContact(
  value: unknown
): SimpleContact | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const name = String(c.name || "").trim();
  const phone = String(c.phone || "").trim();
  if (!name && !phone) return null;
  return { name: name || "Not provided", phone };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function isCardActivated(card: CardDoc): boolean {
  if (card.activated === true) return true;
  if (card.status === "active") return true;
  return false;
}

/** Merge card-doc fields + optional user profile into public emergency view */
export function buildEmergencyView(
  code: string,
  card: CardDoc,
  profile?: UserProfile | null
): EmergencyPublicView {
  const ecFromCard =
    asContact(card.emergencyContact) ||
    asContact(
      profile?.emergency_contact_1 || profile?.emergency_contacts?.[0]
    );
  const doctorFromCard =
    asContact(card.familyDoctor) ||
    (profile?.doctor_name || profile?.doctor_phone
      ? {
          name: profile.doctor_name || "Not provided",
          phone: profile.doctor_phone || "",
        }
      : null);

  const conditions =
    asStringArray(card.medicalConditions).length > 0
      ? asStringArray(card.medicalConditions)
      : asStringArray(card.medical_conditions).length > 0
        ? asStringArray(card.medical_conditions)
        : asStringArray(profile?.medical_conditions);

  const blood =
    String(card.bloodGroup || card.blood_group || profile?.blood_group || "").trim();

  let hasInsurance: boolean | null = null;
  if (typeof card.hasInsurance === "boolean") hasInsurance = card.hasInsurance;
  else if (typeof card.has_insurance === "boolean")
    hasInsurance = card.has_insurance;
  else if (typeof profile?.has_insurance === "boolean")
    hasInsurance = profile.has_insurance;

  return {
    code,
    activated: isCardActivated(card),
    name: String(
      card.name || profile?.full_name || ""
    ).trim() || "Not provided",
    address: String(card.address || profile?.address || "").trim() || "Not provided",
    bloodGroup: blood || "Not provided",
    medicalConditions: conditions,
    emergencyContact: ecFromCard,
    familyDoctor: doctorFromCard,
    hasInsurance,
    userUid: card.user_uid || profile?.uid,
  };
}

/**
 * Server-side emergency data fetch.
 * Prefers fields on cards/{code}; falls back to users profile.
 */
export async function getEmergencyData(
  code: string
): Promise<EmergencyPublicView | null> {
  const id = code.trim().toUpperCase();

  if (isDemoCode(id) || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    if (isDemoCode(id) || id.length === 4) {
      const card = getDemoCard(isDemoCode(id) ? id : "0042");
      const profile = getDemoProfile({ activation_code: id });
      return buildEmergencyView(id, {
        ...card,
        activated: true,
        name: profile.full_name,
        address: profile.address,
        bloodGroup: profile.blood_group,
        medicalConditions: profile.medical_conditions,
        emergencyContact: {
          name: profile.emergency_contact_1.name,
          phone: profile.emergency_contact_1.phone,
        },
        familyDoctor: {
          name: profile.doctor_name,
          phone: profile.doctor_phone,
        },
        hasInsurance: profile.has_insurance,
      });
    }
    return null;
  }

  try {
    const adminData = await tryAdminFetch(id);
    if (adminData) return adminData;
    return await restFetch(id);
  } catch {
    if (isDemoCode(id)) {
      const card = getDemoCard(id);
      const profile = getDemoProfile({ activation_code: id });
      return buildEmergencyView(id, card, profile);
    }
    return null;
  }
}

async function tryAdminFetch(id: string): Promise<EmergencyPublicView | null> {
  try {
    const { getAdminDb } = await import("./firebase-admin");
    const db = getAdminDb();
    const cardSnap = await db.collection("cards").doc(id).get();
    if (!cardSnap.exists) return null;
    const card = {
      ...(cardSnap.data() as CardDoc),
      activation_code: cardSnap.id,
    };

    let profile: UserProfile | null = null;
    if (card.user_uid) {
      const userSnap = await db.collection("users").doc(card.user_uid).get();
      if (userSnap.exists) {
        profile = {
          uid: userSnap.id,
          ...(userSnap.data() as Omit<UserProfile, "uid">),
        };
      }
    }
    if (!profile) {
      const q = await db
        .collection("users")
        .where("activation_code", "==", id)
        .limit(1)
        .get();
      if (!q.empty) {
        const d = q.docs[0];
        profile = { uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) };
      }
    }

    return buildEmergencyView(id, card, profile);
  } catch {
    return null;
  }
}

async function restFetch(id: string): Promise<EmergencyPublicView | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const cardUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cards/${id}`;
  const cardRes = await fetch(cardUrl, { next: { revalidate: 0 } });
  if (!cardRes.ok) return null;
  const cardJson = await cardRes.json();
  const card = parseFirestoreDoc(cardJson) as unknown as CardDoc;
  card.activation_code = id;

  let profile: UserProfile | null = null;
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const queryRes = await fetch(queryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "activation_code" },
            op: "EQUAL",
            value: { stringValue: id },
          },
        },
        limit: 1,
      },
    }),
    next: { revalidate: 0 },
  });

  if (queryRes.ok) {
    const rows = await queryRes.json();
    const doc = rows?.[0]?.document;
    if (doc) {
      profile = parseFirestoreDoc(doc) as unknown as UserProfile;
      const nameParts = doc.name.split("/");
      profile.uid = nameParts[nameParts.length - 1];
    }
  }

  if (!profile && card.user_uid) {
    const uUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${card.user_uid}`;
    const uRes = await fetch(uUrl, { next: { revalidate: 0 } });
    if (uRes.ok) {
      const uJson = await uRes.json();
      profile = parseFirestoreDoc(uJson) as unknown as UserProfile;
      profile.uid = card.user_uid;
    }
  }

  return buildEmergencyView(id, card, profile);
}

function parseFirestoreDoc(doc: {
  fields?: Record<string, FirestoreValue>;
}): Record<string, unknown> {
  const fields = doc.fields || {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out;
}

type FirestoreValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
  nullValue?: null;
  timestampValue?: string;
};

function decodeValue(v: FirestoreValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in v) {
    const m: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue?.fields || {})) {
      m[k] = decodeValue(val);
    }
    return m;
  }
  return null;
}

/** Fire-and-forget scan log — do NOT await on emergency render */
export function logScanBackground(
  activationCode: string,
  userUid: string,
  ip = "unknown"
): void {
  if (!userUid || userUid === "unknown") return;
  import("./firebase-admin")
    .then(({ logScanAdmin }) =>
      logScanAdmin(activationCode, userUid, ip).catch(() => {})
    )
    .catch(() => {
      const base =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      fetch(`${base}/api/log-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: activationCode,
          user_uid: userUid,
          ip,
        }),
      }).catch(() => {});
    });
}

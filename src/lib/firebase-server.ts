import type { CardDoc, UserProfile } from "./types";
import { getDemoCard, getDemoProfile, isDemoCode } from "./demo";

export interface EmergencyPayload {
  card: CardDoc;
  profile: UserProfile;
}

/**
 * Server-side emergency data fetch.
 * Uses Firebase REST when configured; demo fallback otherwise.
 * Pure server — no client SDK auth needed for public reads.
 */
export async function getEmergencyData(
  code: string
): Promise<EmergencyPayload | null> {
  const id = code.trim().toUpperCase();

  if (isDemoCode(id) || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    if (isDemoCode(id) || id.length === 4) {
      return {
        card: getDemoCard(isDemoCode(id) ? id : "0042"),
        profile: getDemoProfile({ activation_code: id }),
      };
    }
    return null;
  }

  try {
    // Prefer Admin SDK if service account present
    const adminData = await tryAdminFetch(id);
    if (adminData) return adminData;

    // Fallback: Firestore REST API (public rules allow read)
    return await restFetch(id);
  } catch {
    if (isDemoCode(id)) {
      return {
        card: getDemoCard(id),
        profile: getDemoProfile({ activation_code: id }),
      };
    }
    return null;
  }
}

async function tryAdminFetch(
  id: string
): Promise<EmergencyPayload | null> {
  try {
    const { getAdminDb } = await import("./firebase-admin");
    const db = getAdminDb();
    const cardSnap = await db.collection("cards").doc(id).get();
    if (!cardSnap.exists) return null;
    const card = {
      ...(cardSnap.data() as CardDoc),
      activation_code: cardSnap.id,
    };
    if (card.status !== "active") return null;

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
    if (!profile) return null;
    return { card, profile };
  } catch {
    return null;
  }
}

async function restFetch(id: string): Promise<EmergencyPayload | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const cardUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cards/${id}`;
  const cardRes = await fetch(cardUrl, { next: { revalidate: 0 } });
  if (!cardRes.ok) return null;
  const cardJson = await cardRes.json();
  const card = parseFirestoreDoc(cardJson) as unknown as CardDoc;
  card.activation_code = id;
  if (card.status !== "active") return null;

  // Query users by activation_code via runQuery
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

  if (!queryRes.ok) return null;
  const rows = await queryRes.json();
  const doc = rows?.[0]?.document;
  if (!doc) {
    // Try by user_uid
    if (card.user_uid) {
      const uUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${card.user_uid}`;
      const uRes = await fetch(uUrl, { next: { revalidate: 0 } });
      if (uRes.ok) {
        const uJson = await uRes.json();
        const profile = parseFirestoreDoc(uJson) as unknown as UserProfile;
        profile.uid = card.user_uid;
        return { card, profile };
      }
    }
    return null;
  }

  const profile = parseFirestoreDoc(doc) as unknown as UserProfile;
  const nameParts = doc.name.split("/");
  profile.uid = nameParts[nameParts.length - 1];
  return { card, profile };
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
  if ("arrayValue" in v)
    return (v.arrayValue?.values || []).map(decodeValue);
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

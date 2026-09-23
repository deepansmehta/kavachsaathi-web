import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import type {
  CardDoc,
  UserProfile,
  DoctorScan,
  CardTier,
  BloodGroup,
} from "./types";
import { generateHealthId, generateOrderId } from "./utils";
import { getDemoCard, getDemoProfile, getDemoScans, isDemoCode } from "./demo";
import { CARD_PRICE } from "./pricing";

function serializeTs(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function verifyActivationCode(code: string): Promise<{
  valid: boolean;
  card?: CardDoc;
  error?: string;
}> {
  const normalized = code.trim().toUpperCase().padStart(4, "0").slice(-4);
  // Allow alphanumeric 4-char too
  const id = code.trim().toUpperCase();

  if (!isFirebaseConfigured) {
    if (isDemoCode(id) || id.length === 4) {
      return {
        valid: true,
        card: {
          activation_code: id,
          health_id: generateHealthId(),
          tier: "STANDARD",
          status: "available",
        },
      };
    }
    return { valid: false, error: "Invalid activation code." };
  }

  try {
    let snap = await getDoc(doc(db, "cards", id));
    if (!snap.exists() && normalized !== id) {
      snap = await getDoc(doc(db, "cards", normalized));
    }
    if (!snap.exists()) {
      return {
        valid: false,
        error: "Card not found. Check the code on the back of your card.",
      };
    }
    const data = snap.data() as CardDoc;
    if (data.status === "active") {
      return {
        valid: false,
        error: "This card has already been activated.",
      };
    }
    return {
      valid: true,
      card: { ...data, activation_code: snap.id },
    };
  } catch {
    return {
      valid: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

export async function getCard(code: string): Promise<CardDoc | null> {
  const id = code.trim().toUpperCase();
  if (!isFirebaseConfigured) {
    return isDemoCode(id) ? getDemoCard(id) : null;
  }
  const snap = await getDoc(doc(db, "cards", id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as CardDoc), activation_code: snap.id };
}

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured) return getDemoProfile({ uid });
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid,
    ...(data as Omit<UserProfile, "uid">),
    created_at: serializeTs(data.created_at),
    updated_at: serializeTs(data.updated_at),
  };
}

export async function getUserByActivationCode(
  code: string
): Promise<UserProfile | null> {
  const id = code.trim().toUpperCase();
  if (!isFirebaseConfigured) {
    return isDemoCode(id) ? getDemoProfile({ activation_code: id }) : null;
  }
  const q = query(
    collection(db, "users"),
    where("activation_code", "==", id),
    limit(1)
  );
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  const d = snaps.docs[0];
  return { uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) };
}

export async function activateAndSaveProfile(params: {
  uid: string;
  activation_code: string;
  tier: CardTier;
  health_id?: string;
  profile: Omit<
    UserProfile,
    "uid" | "activation_code" | "health_id" | "created_at" | "updated_at"
  >;
}): Promise<{ success: boolean; health_id?: string; error?: string }> {
  const code = params.activation_code.trim().toUpperCase();
  const healthId = params.health_id || generateHealthId();

  if (!isFirebaseConfigured) {
    return { success: true, health_id: healthId };
  }

  try {
    await setDoc(doc(db, "users", params.uid), {
      ...params.profile,
      uid: params.uid,
      activation_code: code,
      health_id: healthId,
      tier: params.tier,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await updateDoc(doc(db, "cards", code), {
      status: "active",
      activated_at: serverTimestamp(),
      user_uid: params.uid,
      health_id: healthId,
    });

    return { success: true, health_id: healthId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Activation failed",
    };
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  if (!isFirebaseConfigured) {
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("kavach_demo_profile");
      const base = existing ? JSON.parse(existing) : getDemoProfile({ uid });
      const next = { ...base, ...data, updated_at: new Date().toISOString() };
      localStorage.setItem("kavach_demo_profile", JSON.stringify(next));
    }
    return;
  }
  const { uid: _u, created_at: _c, ...rest } = data;
  void _u;
  void _c;
  await updateDoc(doc(db, "users", uid), {
    ...rest,
    updated_at: serverTimestamp(),
  });
}

export async function getUserScans(uid: string): Promise<DoctorScan[]> {
  if (!isFirebaseConfigured) return getDemoScans();
  try {
    const q = query(
      collection(db, "doctor_scans"),
      where("user_uid", "==", uid),
      orderBy("scanned_at", "desc"),
      limit(50)
    );
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        activation_code: data.activation_code,
        user_uid: data.user_uid,
        scanned_by: data.scanned_by,
        hospital: data.hospital,
        location: data.location,
        notes: data.notes,
        scanned_at: serializeTs(data.scanned_at) || new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

export interface AppNotification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function getUserNotifications(
  uid: string
): Promise<AppNotification[]> {
  if (!isFirebaseConfigured) return [];
  try {
    // Prefer subcollection notifications/{uid}/{notifId}
    const sub = await getDocs(
      query(
        collection(db, "notifications", uid, "items"),
        orderBy("created_at", "desc"),
        limit(20)
      )
    );
    if (!sub.empty) {
      return sub.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          message: String(data.message || ""),
          read: Boolean(data.read),
          created_at:
            serializeTs(data.created_at) || new Date().toISOString(),
        };
      });
    }
    // Legacy: notifications/{uid}.scans[]
    const snap = await getDoc(doc(db, "notifications", uid));
    if (!snap.exists()) return [];
    const scans = (snap.data().scans || []) as {
      id?: string;
      message?: string;
      read?: boolean;
      scanned_at?: string;
    }[];
    return scans.slice(0, 20).map((s, i) => ({
      id: s.id || `scan-${i}`,
      message: s.message || "Card scanned",
      read: Boolean(s.read),
      created_at: s.scanned_at || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(
  uid: string
): Promise<number> {
  if (!isFirebaseConfigured) return 0;
  try {
    const list = await getUserNotifications(uid);
    return list.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}

export async function createOrder(data: {
  name: string;
  phone: string;
  email: string;
  address: string;
  pincode: string;
  blood_group: BloodGroup;
  tier: CardTier;
  razorpay_payment_id?: string;
}): Promise<{ success: boolean; order_id?: string; error?: string }> {
  const orderId = generateOrderId();
  const amount = CARD_PRICE;
  if (!isFirebaseConfigured) {
    return { success: true, order_id: orderId };
  }
  try {
    await setDoc(doc(db, "orders", orderId), {
      order_id: orderId,
      ...data,
      amount,
      status: data.razorpay_payment_id ? "paid" : "pending",
      created_at: serverTimestamp(),
    });
    return { success: true, order_id: orderId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Order failed",
    };
  }
}

export async function addDoctorVisitNote(params: {
  activation_code: string;
  user_uid: string;
  scanned_by: string;
  hospital?: string;
  notes?: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;
  await addDoc(collection(db, "doctor_scans"), {
    ...params,
    scanned_at: serverTimestamp(),
  });
}

/** Client-side helper — prefer server logScan for emergency page */
export async function notifyUserOfScan(
  userUid: string,
  activationCode: string
) {
  if (!isFirebaseConfigured) return;
  const id = `${Date.now()}`;
  const ref = doc(db, "notifications", userUid);
  const snap = await getDoc(ref);
  const entry = {
    id,
    message: `Your KavachSaathi card was scanned (code ${activationCode})`,
    scanned_at: new Date().toISOString(),
    read: false,
  };
  if (snap.exists()) {
    await updateDoc(ref, { scans: arrayUnion(entry) });
  } else {
    await setDoc(ref, { scans: [entry] });
  }
}

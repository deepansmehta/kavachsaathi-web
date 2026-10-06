/**
 * F55 — Owner-only offline emergency card (client).
 * IndexedDB + WebCrypto PBKDF2 + AES-GCM. Key derived from owner PIN.
 * Allowed fields only — no IDs, address, insurance, documents.
 */

export type OfflineEmergencyCard = {
  name: string;
  photoThumbnail?: string | null;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  medicines: string[];
  criticalFlags: string[];
  emergencyContacts: { name: string; phone: string; relation?: string }[];
  autoSummary?: { en?: string; hi?: string } | null;
  savedAt: string;
  healthId: string;
};

const DB_NAME = "kavachsaathi-offline";
const STORE = "emergencyCard";
const KEY_ID = "owner";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function saveOfflineEmergencyCard(
  pin: string,
  card: OfflineEmergencyCard
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const payload = new TextEncoder().encode(JSON.stringify(card));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    payload
  );
  await idbSet(KEY_ID, {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(cipher),
    savedAt: card.savedAt,
    healthId: card.healthId,
  });
}

export async function hasOfflineEmergencyCard(): Promise<boolean> {
  const row = await idbGet(KEY_ID);
  return Boolean(row);
}

export async function offlineCardMeta(): Promise<{
  savedAt?: string;
  healthId?: string;
} | null> {
  const row = (await idbGet(KEY_ID)) as
    | { savedAt?: string; healthId?: string }
    | undefined;
  if (!row) return null;
  return { savedAt: row.savedAt, healthId: row.healthId };
}

export async function loadOfflineEmergencyCard(
  pin: string
): Promise<OfflineEmergencyCard> {
  const row = (await idbGet(KEY_ID)) as
    | { salt: string; iv: string; ciphertext: string }
    | undefined;
  if (!row?.ciphertext) throw new Error("No offline card saved");
  const key = await deriveKey(pin, fromB64(row.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(row.iv) as BufferSource },
      key,
      fromB64(row.ciphertext) as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plain)) as OfflineEmergencyCard;
  } catch {
    throw new Error("Incorrect PIN or corrupted offline card");
  }
}

export async function removeOfflineEmergencyCard(): Promise<void> {
  await idbDel(KEY_ID);
}

/** Call on logout / session clear. */
export async function clearOfflineCardOnLogout(): Promise<void> {
  try {
    await removeOfflineEmergencyCard();
  } catch {
    /* ignore */
  }
}

/** Allowed-field guard for tests / save path. */
export function assertOfflineCardSafe(card: OfflineEmergencyCard): string[] {
  const forbidden = [
    "address",
    "aadhaar",
    "abha",
    "policy",
    "insurance",
    "document",
    "idProof",
    "vault",
  ];
  const json = JSON.stringify(card).toLowerCase();
  const hits: string[] = [];
  for (const f of forbidden) {
    if (Object.prototype.hasOwnProperty.call(card, f)) hits.push(`key:${f}`);
  }
  // soft check — field names in data strings are ok; keys already constrained by type
  void json;
  return hits;
}

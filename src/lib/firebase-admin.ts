import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import * as fs from "fs";
import * as path from "path";

let app: App | undefined;
let db: Firestore | undefined;
let adminAuth: Auth | undefined;

type ServiceAccountLike = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

function normalizePrivateKey(key: string): string {
  let k = key.trim();
  // Strip wrapping quotes
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  // Env files often store literal \n
  k = k.replace(/\\n/g, "\n");
  return k;
}

function parseServiceAccountJson(raw: string): ServiceAccountLike {
  let value: unknown = raw.trim();
  // Unwrap one or two JSON layers (common when .env double-encodes)
  for (let i = 0; i < 2; i++) {
    if (typeof value !== "string") break;
    let s = value.trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1);
    }
    try {
      value = JSON.parse(s);
    } catch {
      // try unescaping common env forms
      try {
        value = JSON.parse(s.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
      } catch {
        throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON");
      }
    }
  }
  if (!value || typeof value !== "object") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY did not parse to an object");
  }
  const obj = value as ServiceAccountLike;
  if (typeof obj.private_key === "string") {
    obj.private_key = normalizePrivateKey(obj.private_key);
  }
  return obj;
}

function loadCredentials(): ServiceAccountLike {
  const errors: string[] = [];

  // 1) Local service-account.json — most reliable in local dev
  const saPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(saPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(saPath, "utf8")) as ServiceAccountLike;
      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(String(parsed.private_key));
      }
      return parsed;
    } catch (e) {
      errors.push(
        `service-account.json: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 2) Split admin env vars
  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    try {
      return {
        project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
      };
    } catch (e) {
      errors.push(
        `FIREBASE_ADMIN_*: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 3) Full JSON in env (production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      errors.push(
        `FIREBASE_SERVICE_ACCOUNT_KEY: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  throw new Error(
    `Firebase Admin credentials missing or invalid. ${errors.join(" | ")}`
  );
}

function initAdmin(): App {
  if (getApps().length) return getApps()[0];
  const credentials = loadCredentials();
  return initializeApp({
    credential: cert(credentials as Parameters<typeof cert>[0]),
    projectId:
      (credentials.project_id as string) ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getAdminApp(): App {
  if (!app) app = initAdmin();
  return app;
}

export function getAdminDb(): Firestore {
  if (!db) db = getFirestore(getAdminApp());
  return db;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export async function logScanAdmin(
  activationCode: string,
  userUid: string,
  ip = "unknown"
): Promise<void> {
  const database = getAdminDb();
  await database.collection("doctor_scans").add({
    card_code: activationCode,
    activation_code: activationCode,
    user_uid: userUid,
    scanned_by: "Emergency QR",
    scanned_at: new Date(),
    ip,
  });

  await database
    .collection("notifications")
    .doc(userUid)
    .collection("items")
    .add({
      message: `Your KavachSaathi card was scanned (code ${activationCode})`,
      read: false,
      created_at: new Date(),
    });

  const notifRef = database.collection("notifications").doc(userUid);
  const snap = await notifRef.get();
  const entry = {
    id: `${Date.now()}`,
    message: `Your KavachSaathi card was scanned`,
    scanned_at: new Date().toISOString(),
    read: false,
  };
  if (snap.exists) {
    const scans = snap.data()?.scans || [];
    await notifRef.update({ scans: [entry, ...scans].slice(0, 50) });
  } else {
    await notifRef.set({ scans: [entry] });
  }
}

/** Server-side SHA-256 (Node crypto) */
export async function hashPinServer(pin: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(pin).digest("hex");
}

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { normalizeHealthId } from "./healthId";

const DEDUPE_MS = 10 * 60 * 1000;
const SCAN_RETENTION_DAYS = 180;

export type UserAgentType = "mobile" | "desktop" | "unknown";

export type ScanDoc = {
  healthId: string;
  scannedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  cityApprox: string | null;
  locationShared: boolean;
  emergencyMode: boolean;
  userAgentType: UserAgentType;
  hourlyBucket: string;
  sectionsRendered: string[];
  scanCountInWindow?: number;
};

export function classifyUserAgent(ua: string | null): UserAgentType {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (
    /mobile|android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(
      s
    )
  ) {
    return "mobile";
  }
  if (/mozilla|chrome|safari|firefox|edg|opera|msie|trident/i.test(s)) {
    return "desktop";
  }
  return "unknown";
}

/** Privacy-safe city from CDN headers only — never IP or lat/lng */
export function cityApproxFromHeaders(headers: Headers): string | null {
  const tryJsonGeo = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
      let decoded = raw;
      // Netlify sometimes base64-encodes geo
      if (!raw.trim().startsWith("{")) {
        decoded = Buffer.from(raw, "base64").toString("utf8");
      }
      const j = JSON.parse(decoded) as {
        city?: string;
        locality?: string;
        region?: string;
        country?: string;
        country_code?: string;
      };
      const city = String(j.city || j.locality || "").trim();
      const region = String(j.region || "").trim();
      const country = String(j.country || j.country_code || "").trim();
      if (city) return region ? `${city}, ${region}` : city;
      if (region) return country ? `${region}, ${country}` : region;
      return country || null;
    } catch {
      return null;
    }
  };

  const fromNf = tryJsonGeo(headers.get("x-nf-geo"));
  if (fromNf) return fromNf.slice(0, 80);

  const city =
    headers.get("x-nf-city") ||
    headers.get("x-vercel-ip-city") ||
    headers.get("cf-ipcity") ||
    headers.get("x-city");
  const country =
    headers.get("x-nf-country") ||
    headers.get("x-country") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry");

  if (city) {
    const c = decodeURIComponent(city).trim().slice(0, 60);
    const cc = country ? String(country).trim().toUpperCase().slice(0, 3) : "";
    return cc ? `${c}, ${cc}` : c;
  }
  if (country) return String(country).trim().toUpperCase().slice(0, 3);
  return null;
}

/** IST hourly bucket YYYY-MM-DD-HH */
export function hourlyBucketIST(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}-${get("hour")}`;
}

export type LogScanInput = {
  healthId: string;
  cityApprox: string | null;
  locationShared: boolean;
  emergencyMode: boolean;
  userAgentType: UserAgentType;
  sectionsRendered: string[];
};

export type LogScanResult =
  | {
      ok: true;
      scanId: string;
      deduped: boolean;
      scanCountInWindow: number;
    }
  | { ok: false; status: number; error: string };

/**
 * Log a scan with 10-min per-health_id dedupe via runTransaction on the card doc.
 * Extra hits within the window only bump scanCountInWindow on the existing scan.
 */
export async function logScanAtomic(
  db: Firestore,
  cardDocId: string,
  input: LogScanInput
): Promise<LogScanResult> {
  const healthId = normalizeHealthId(input.healthId);
  const cardRef = db.collection("cards").doc(cardDocId);
  const scansCol = db.collection("scans");

  try {
    const result = await db.runTransaction(async (tx) => {
      const cardSnap = await tx.get(cardRef);
      if (!cardSnap.exists) {
        throw Object.assign(new Error("Card not found"), { status: 404 });
      }
      const card = cardSnap.data()!;
      const now = Date.now();
      const lastAt = card.lastScanLoggedAt?.toMillis?.()
        ? Number(card.lastScanLoggedAt.toMillis())
        : Number(card.lastScanLoggedAt) || 0;
      const lastScanDocId = String(card.lastScanDocId || "");
      const withinWindow = lastAt > 0 && now - lastAt < DEDUPE_MS;

      if (withinWindow && lastScanDocId) {
        const scanRef = scansCol.doc(lastScanDocId);
        const scanSnap = await tx.get(scanRef);
        const prevCount = scanSnap.exists
          ? Number(scanSnap.data()?.scanCountInWindow || 1)
          : 1;
        const nextCount = prevCount + 1;
        const patch: Record<string, unknown> = {
          scanCountInWindow: nextCount,
        };
        if (input.emergencyMode) patch.emergencyMode = true;
        if (input.locationShared) patch.locationShared = true;
        tx.update(scanRef, patch);
        tx.update(cardRef, {
          scanCountInWindow: nextCount,
        });
        return {
          scanId: lastScanDocId,
          deduped: true,
          scanCountInWindow: nextCount,
        };
      }

      const scanRef = scansCol.doc();
      tx.set(scanRef, {
        healthId,
        scannedAt: FieldValue.serverTimestamp(),
        cityApprox: input.cityApprox,
        locationShared: Boolean(input.locationShared),
        emergencyMode: Boolean(input.emergencyMode),
        userAgentType: input.userAgentType,
        hourlyBucket: hourlyBucketIST(),
        sectionsRendered: input.sectionsRendered || [],
        scanCountInWindow: 1,
      });
      tx.update(cardRef, {
        lastScanLoggedAt: FieldValue.serverTimestamp(),
        lastScanDocId: scanRef.id,
        scanCountInWindow: 1,
      });
      return {
        scanId: scanRef.id,
        deduped: false,
        scanCountInWindow: 1,
      };
    });

    return { ok: true, ...result };
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Scan log failed";
    if (status === 404) return { ok: false, status, error: message };
    console.error("logScanAtomic", err);
    return { ok: false, status: 500, error: message };
  }
}

export async function flagEmergencyOnScan(
  db: Firestore,
  cardDocId: string,
  healthId: string
): Promise<LogScanResult> {
  return logScanAtomic(db, cardDocId, {
    healthId,
    cityApprox: null,
    locationShared: false,
    emergencyMode: true,
    userAgentType: "unknown",
    sectionsRendered: [],
  });
}

export function scanRetentionCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - SCAN_RETENTION_DAYS);
  return d;
}

export { DEDUPE_MS, SCAN_RETENTION_DAYS };

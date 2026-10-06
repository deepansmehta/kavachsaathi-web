/**
 * Aggregate analytics (F49) — NEVER store health_id, IP, or PII.
 * Collection: analytics_daily — one doc per day (+ optional batch).
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export type AggEventType =
  | "activation"
  | "scan"
  | "full_details"
  | "form_download"
  | "alert_family"
  | "emergency_access"
  | "renewal_request"
  | "lost_block"
  | "lost_report"
  | "data_export"
  | "referral_click"
  | "feedback"
  | "pdf_download";

export type AggEventInput = {
  date?: string; // YYYY-MM-DD (UTC)
  batch?: number | string | null;
  type: AggEventType | string;
  state?: string | null;
  city?: string | null;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function docId(date: string, batch?: number | string | null): string {
  const b =
    batch === null || batch === undefined || batch === ""
      ? "all"
      : String(batch);
  return `${date}_${b}`;
}

function normalizeInput(
  a: Firestore | AggEventInput,
  b?: AggEventInput
): { db: Firestore; input: AggEventInput } {
  if (b) {
    return { db: a as Firestore, input: b };
  }
  return { db: getAdminDb(), input: a as AggEventInput };
}

/**
 * Increment a counter on analytics_daily.
 * Call as recordAggEvent(input) or recordAggEvent(db, input).
 * Never writes health_id / IP / phone / name.
 */
export async function recordAggEvent(
  a: Firestore | AggEventInput,
  b?: AggEventInput
): Promise<void> {
  try {
    const { db: database, input } = normalizeInput(a, b);
    const date = input.date || todayUtc();
    const id = docId(date, input.batch);
    const ref = database.collection("analytics_daily").doc(id);

    const typeKey = String(input.type || "unknown")
      .replace(/[^a-z0-9_]/gi, "_")
      .slice(0, 40);
    const field = `counts.${typeKey}`;
    const patch: Record<string, unknown> = {
      date,
      updatedAt: FieldValue.serverTimestamp(),
      [field]: FieldValue.increment(1),
      total: FieldValue.increment(1),
    };
    if (
      input.batch !== null &&
      input.batch !== undefined &&
      input.batch !== ""
    ) {
      patch.batch = input.batch;
      patch[`batches.${String(input.batch)}`] = FieldValue.increment(1);
    }
    if (input.state) {
      const sk = String(input.state).trim().slice(0, 40);
      if (sk) patch[`regions.states.${sk}`] = FieldValue.increment(1);
    }
    if (input.city) {
      const ck = String(input.city).trim().slice(0, 40);
      if (ck) patch[`regions.cities.${ck}`] = FieldValue.increment(1);
    }

    // Refuse accidental PII keys
    for (const k of Object.keys(patch)) {
      if (/health_id|ip|phone|email|name|aadhaar/i.test(k)) {
        throw new Error("analytics PII key refused");
      }
    }

    await ref.set(patch, { merge: true });
  } catch (err) {
    console.warn("recordAggEvent skipped");
    void err;
  }
}

/** Fire-and-forget wrapper for route handlers. */
export function trackAgg(input: AggEventInput): void {
  void recordAggEvent(input);
}

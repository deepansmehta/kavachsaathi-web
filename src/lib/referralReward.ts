/**
 * Referral reward helpers (F51).
 * On activation with a valid code: referrer validTill += reward days (default 30).
 */
import type {
  Firestore,
  Transaction,
  DocumentReference,
  DocumentData,
} from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { addDaysIso } from "@/lib/validity";
import { normalizePhone } from "@/lib/phone";
import type { SitePolicy } from "@/lib/config/siteConfig";

export type ReferralApplyOk = {
  ok: true;
  referrerProfileId: string;
  referrerHealthId: string;
  newValidTill: string;
  monthsGrantedThisYear: number;
};

export type ReferralApplyErr = {
  ok: false;
  error: string;
  code:
    | "INVALID_CODE"
    | "SELF_REFERRAL"
    | "SAME_FAMILY"
    | "YEARLY_CAP"
    | "NOT_ACTIVATED";
};

export type ReferralApplyResult = ReferralApplyOk | ReferralApplyErr;

function yearKey(d = new Date()): number {
  return d.getUTCFullYear();
}

function monthsGrantedThisYear(data: DocumentData, year: number): number {
  const y = data.referralRewardYear;
  const m = Number(data.referralRewardMonthsThisYear || 0);
  if (Number(y) === year) return m;
  return 0;
}

export function makeReferralCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `KS${(h % 1000000).toString().padStart(6, "0")}`;
}

/** Find profile by referralCode (uppercase). */
export async function findProfileByReferralCode(
  db: Firestore,
  code: string
): Promise<{ ref: DocumentReference; data: DocumentData } | null> {
  const normalized = String(code || "")
    .trim()
    .toUpperCase()
    .slice(0, 16);
  if (!normalized) return null;
  const snap = await db
    .collection("profiles")
    .where("referralCode", "==", normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

/**
 * Validate + apply referral reward inside an existing transaction.
 * Caller must have already read the referrer doc into the transaction.
 */
export function applyReferralRewardInTx(
  tx: Transaction,
  opts: {
    referrerRef: DocumentReference;
    referrerData: DocumentData;
    newPhoneNormalized: string;
    newFamilyGroupId?: string | null;
    newHealthId: string;
    policy: SitePolicy;
    now?: Date;
  }
): ReferralApplyResult {
  const now = opts.now || new Date();
  const year = yearKey(now);
  const referrerPhone = normalizePhone(
    String(opts.referrerData.phoneNormalized || opts.referrerData.phone || "")
  );
  const newPhone = normalizePhone(opts.newPhoneNormalized);

  if (referrerPhone && newPhone && referrerPhone === newPhone) {
    return {
      ok: false,
      error: "Self-referral is not allowed",
      code: "SELF_REFERRAL",
    };
  }

  const refFamily = opts.referrerData.familyGroupId
    ? String(opts.referrerData.familyGroupId)
    : "";
  const newFamily = opts.newFamilyGroupId
    ? String(opts.newFamilyGroupId)
    : "";
  if (refFamily && newFamily && refFamily === newFamily) {
    return {
      ok: false,
      error: "Cannot use a referral from your family group",
      code: "SAME_FAMILY",
    };
  }

  const months = monthsGrantedThisYear(opts.referrerData, year);
  if (months >= opts.policy.referralMaxMonthsPerYear) {
    return {
      ok: false,
      error: "Referral code has reached its yearly reward limit",
      code: "YEARLY_CAP",
    };
  }

  const currentTill =
    opts.referrerData.validTill ||
    opts.referrerData.valid_till ||
    null;
  const base = currentTill
    ? new Date(String(currentTill))
    : addDaysFromActivation(opts.referrerData, now);
  if (Number.isNaN(base.getTime())) {
    return {
      ok: false,
      error: "Referrer card validity missing",
      code: "NOT_ACTIVATED",
    };
  }
  // Extend from max(now, currentTill) so expired cards regain future validity
  const from = base.getTime() > now.getTime() ? base : now;
  const newValidTill = addDaysIso(from, opts.policy.referralRewardDays);
  const newMonths = months + 1;

  tx.update(opts.referrerRef, {
    validTill: newValidTill,
    referralRewardYear: year,
    referralRewardMonthsThisYear: newMonths,
    referralRewardCount: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Also bump card doc if linked
  const healthId = String(
    opts.referrerData.health_id || opts.referrerData.healthId || ""
  );
  return {
    ok: true,
    referrerProfileId: opts.referrerRef.id,
    referrerHealthId: healthId,
    newValidTill,
    monthsGrantedThisYear: newMonths,
  };
}

function addDaysFromActivation(data: DocumentData, now: Date): Date {
  const from =
    data.validFrom ||
    data.activated_at ||
    data.created_at ||
    now.toISOString();
  const d = new Date(String(from));
  if (Number.isNaN(d.getTime())) return now;
  return d;
}

export function referralRewardLog(opts: {
  referrerHealthId: string;
  referredHealthId: string;
  referrerProfileId: string;
  newValidTill: string;
  code: string;
  days?: number;
}) {
  return {
    type: "referral_reward" as const,
    code: opts.code,
    referrer_health_id: opts.referrerHealthId,
    referred_health_id: opts.referredHealthId,
    referrer_profile_id: opts.referrerProfileId,
    newValidTill: opts.newValidTill,
    days: opts.days ?? 30,
    at: new Date().toISOString(),
  };
}

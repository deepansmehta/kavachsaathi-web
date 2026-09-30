/**
 * Simple IP rate limiter backed by Firestore `rate_limits` collection.
 * Falls back to in-memory Map when Admin is unavailable (dev).
 */

import type { Firestore } from "firebase-admin/firestore";

type Bucket = { count: number; resetAt: number; captchaRequired: boolean };

const memory = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  captchaRequired: boolean;
  retryAfterSec: number;
};

export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  captchaAfter: number;
  db?: Firestore | null;
  /** When false, only read state — do not increment (default true) */
  record?: boolean;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const { key, limit, windowMs, captchaAfter } = opts;
  const record = opts.record !== false;

  if (opts.db) {
    try {
      return await firestoreLimit(
        opts.db,
        key,
        limit,
        windowMs,
        captchaAfter,
        now,
        record
      );
    } catch {
      /* fall through to memory */
    }
  }

  let bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs, captchaRequired: false };
  }
  if (record) {
    bucket.count += 1;
    if (bucket.count > captchaAfter) bucket.captchaRequired = true;
    memory.set(key, bucket);
  }

  const remaining = Math.max(0, limit - bucket.count);
  return {
    // record=true: after increment, allow while count <= limit (5 fails OK, 6th blocked)
    // record=false (peek): block once count already reached limit
    allowed: record ? bucket.count <= limit : bucket.count < limit,
    remaining,
    captchaRequired: bucket.captchaRequired || bucket.count > captchaAfter,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

async function firestoreLimit(
  db: Firestore,
  key: string,
  limit: number,
  windowMs: number,
  captchaAfter: number,
  now: number,
  record: boolean
): Promise<RateLimitResult> {
  const ref = db.collection("rate_limits").doc(encodeURIComponent(key).slice(0, 700));
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let count = 0;
    let resetAt = now + windowMs;
    let captchaRequired = false;

    if (snap.exists) {
      const data = snap.data()!;
      if (Number(data.resetAt) > now) {
        count = Number(data.count) || 0;
        resetAt = Number(data.resetAt);
        captchaRequired = Boolean(data.captchaRequired);
      }
    }

    if (record) {
      count += 1;
      if (count > captchaAfter) captchaRequired = true;
      tx.set(
        ref,
        { count, resetAt, captchaRequired, updatedAt: now },
        { merge: true }
      );
    }

    return { count, resetAt, captchaRequired };
  });

  return {
    allowed: record ? result.count <= limit : result.count < limit,
    remaining: Math.max(0, limit - result.count),
    captchaRequired:
      result.captchaRequired || result.count > captchaAfter,
    retryAfterSec: Math.max(1, Math.ceil((result.resetAt - now) / 1000)),
  };
}

export function clientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name) || "";
  const forwarded = h("x-forwarded-for").split(",")[0]?.trim();
  return forwarded || h("x-real-ip") || h("cf-connecting-ip") || "unknown";
}

/** Very light captcha: answer = a + b from challenge token */
export function makeMathCaptcha(): { token: string; question: string } {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const exp = Date.now() + 5 * 60 * 1000;
  const token = Buffer.from(`${a}|${b}|${exp}|${a + b}`).toString("base64url");
  return { token, question: `${a} + ${b} = ?` };
}

export function verifyMathCaptcha(token: string, answer: string): boolean {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [a, b, exp, sum] = raw.split("|");
    if (!a || !b || !exp || !sum) return false;
    if (Date.now() > Number(exp)) return false;
    return Number(answer) === Number(sum) && Number(a) + Number(b) === Number(sum);
  } catch {
    return false;
  }
}

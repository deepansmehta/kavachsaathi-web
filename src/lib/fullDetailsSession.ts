import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "kavach_full_details";
const MAX_AGE_SEC = 10 * 60;

function secret(): string {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 64) ||
    "kavach-dev-full-details"
  );
}

export type FullDetailsScope = "pin" | "emergency";

export function makeFullDetailsToken(
  healthId: string,
  scope: FullDetailsScope
): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${healthId}.${scope}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyFullDetailsToken(
  token: string | undefined | null
): { healthId: string; scope: FullDetailsScope; exp: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [healthId, scope, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!healthId || (scope !== "pin" && scope !== "emergency") || !exp) {
    return null;
  }
  if (Date.now() > exp) return null;
  const payload = `${healthId}.${scope}.${expStr}`;
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { healthId, scope, exp };
}

export function fullDetailsCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearFullDetailsCookie() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export { COOKIE as FULL_DETAILS_COOKIE, MAX_AGE_SEC as FULL_DETAILS_MAX_AGE_SEC };

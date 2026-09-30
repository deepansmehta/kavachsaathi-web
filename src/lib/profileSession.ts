import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "kavach_profile_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 64) ||
    "kavach-dev-session-secret-change-me"
  );
}

export function makeProfileSessionToken(profileId: string): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${profileId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyProfileSessionToken(
  token: string | undefined | null
): { profileId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [profileId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!profileId || !exp || Date.now() > exp) return null;
  const payload = `${profileId}.${expStr}`;
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
  return { profileId };
}

export function profileSessionCookieOptions(token: string) {
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

export function clearProfileSessionCookie() {
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

export { COOKIE as PROFILE_SESSION_COOKIE };

import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "kavach_activation_session";
const MAX_AGE_SEC = 15 * 60;

function secret(): string {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 64) ||
    "kavach-dev-activation-session"
  );
}

export function makeActivationSessionToken(
  healthId: string,
  sessionId: string
): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${healthId}.${sessionId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyActivationSessionToken(
  token: string | undefined | null
): { healthId: string; sessionId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [healthId, sessionId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!healthId || !sessionId || !exp || Date.now() > exp) return null;
  const payload = `${healthId}.${sessionId}.${expStr}`;
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
  return { healthId, sessionId };
}

export function activationSessionCookieOptions(token: string) {
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

export function clearActivationSessionCookie() {
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

export { COOKIE as ACTIVATION_SESSION_COOKIE };

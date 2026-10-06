import { createHmac } from "crypto";

export const HOSPITAL_SESSION_COOKIE = "kavach_hospital_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

function sessionSecret() {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 64) ||
    "kavach-hospital-secret"
  );
}

export function makeHospitalSessionToken(hospitalId: string, email: string): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${hospitalId}.${encodeURIComponent(email)}.${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyHospitalSessionToken(
  token: string | undefined | null
): { hospitalId: string; email: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [hospitalId, emailEnc, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!hospitalId || !emailEnc || !exp || Date.now() > exp) return null;
  const payload = `${hospitalId}.${emailEnc}.${expStr}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig),
      b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return null;
  } catch {
    return null;
  }
  return { hospitalId, email: decodeURIComponent(emailEnc) };
}

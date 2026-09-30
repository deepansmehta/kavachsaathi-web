import { createHmac } from "crypto";
import { normalizeHealthId, isValidHealthId } from "./healthId";

function secret(): string {
  return (
    process.env.PROFILE_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 32) ||
    "kavach-dev-scan-secret"
  );
}

/** Short-lived token so the public client never needs raw health_id in props */
export function makeScanToken(healthId: string, ttlMs = 2 * 60 * 60 * 1000): string {
  const id = normalizeHealthId(healthId);
  const exp = Date.now() + ttlMs;
  const payload = `${id}|${exp}`;
  const sig = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url")
    .slice(0, 20);
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyScanToken(token: string): string | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const [id, exp, sig] = raw.split("|");
    if (!id || !exp || !sig) return null;
    if (!isValidHealthId(id)) return null;
    if (Date.now() > Number(exp)) return null;
    const payload = `${id}|${exp}`;
    const expect = createHmac("sha256", secret())
      .update(payload)
      .digest("base64url")
      .slice(0, 20);
    if (expect !== sig) return null;
    return normalizeHealthId(id);
  } catch {
    return null;
  }
}

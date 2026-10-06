import { createHash } from "crypto";

export const CODE_TTL_MS = 10 * 60_000;

export function hashConsentCode(code: string, healthId: string): string {
  return createHash("sha256")
    .update(`${healthId}:${code}`)
    .digest("hex");
}

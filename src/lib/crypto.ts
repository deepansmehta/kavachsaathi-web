import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM helpers for PII at rest.
 * PROFILE_ENC_KEY = 32-byte key as base64 (44 chars with padding).
 */

function keyBytes(): Buffer {
  const raw = process.env.PROFILE_ENC_KEY || "";
  if (!raw) {
    throw new Error("PROFILE_ENC_KEY is not configured");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("PROFILE_ENC_KEY must be 32 bytes base64-encoded");
  }
  return buf;
}

/** Encrypt plaintext → base64(iv || tag || ciphertext) */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(String(payload || ""), "base64");
  if (buf.length < 28) throw new Error("Invalid ciphertext");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

export function hasEncKey(): boolean {
  try {
    keyBytes();
    return true;
  } catch {
    return false;
  }
}

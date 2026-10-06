/** F19 — Attendant pass token helpers */

import { createHash, randomBytes } from "crypto";

export type AttendantHours = 6 | 12 | 24;

export type AttendantScope = {
  /** Full Details without ID images (default) */
  includeIds: boolean;
};

export function normalizeHours(h: unknown): AttendantHours {
  const n = Number(h);
  if (n === 6 || n === 12 || n === 24) return n;
  return 12;
}

/** ≥128-bit random token (32 bytes → 64 hex chars) */
export function createAttendantToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashAttendantToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function attendantWatermark(name: string, validTillIso: string): string {
  const till = new Date(validTillIso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `Attendant pass: ${name}, valid till ${till} IST`;
}

export function isGuessableToken(token: string): boolean {
  // Reject short / non-hex tokens
  return !/^[a-f0-9]{64}$/i.test(token);
}

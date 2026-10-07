/**
 * F19 — Attendant Pass
 * Token creation, hashing, validity, and scope types.
 */

import { randomBytes, createHash } from "crypto";

export type AttendantPassScope =
  | "full_details"       // name, blood group, allergies, medications, contacts
  | "emergency_only"     // blood group + emergency contacts only
  | "medical_summary";   // allergies + medications + conditions only

export const PASS_SCOPE_LABELS: Record<AttendantPassScope, string> = {
  full_details: "Full medical details (except ID images)",
  emergency_only: "Emergency essentials (blood group + contacts)",
  medical_summary: "Medical summary (allergies, medications, conditions)",
};

export type AttendantPassValidity = 6 | 12 | 24;
export const VALID_PASS_HOURS: AttendantPassValidity[] = [6, 12, 24];
export const MAX_PASS_HOURS = 24;

export type CreatePassResult = {
  /** Raw token — return ONCE only to caller, never stored */
  rawToken: string;
  /** SHA-256 hex of rawToken — stored in DB */
  tokenHash: string;
  /** ISO expiry timestamp */
  expiresAt: string;
  /** Label for scope */
  scopeLabel: string;
};

/** Generate a cryptographically random ≥128-bit token (32 hex bytes = 128 bits) */
export function createRawToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hex hash of the raw token */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Compute expiry ISO from now + validityHours */
export function computeExpiry(validityHours: AttendantPassValidity): string {
  const expires = new Date(Date.now() + validityHours * 60 * 60 * 1000);
  return expires.toISOString();
}

/** Create a new attendant pass token bundle */
export function createAttendantPass(opts: {
  validityHours: AttendantPassValidity;
  scope: AttendantPassScope;
}): CreatePassResult {
  const hours = Math.min(opts.validityHours, MAX_PASS_HOURS) as AttendantPassValidity;
  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = computeExpiry(hours);
  return {
    rawToken,
    tokenHash,
    expiresAt,
    scopeLabel: PASS_SCOPE_LABELS[opts.scope],
  };
}

/** Check if a pass is still valid (not expired and not revoked) */
export function isPassValid(pass: {
  expiresAt: string;
  revokedAt?: string | null;
}): boolean {
  if (pass.revokedAt) return false;
  return new Date(pass.expiresAt) > new Date();
}

/** Validate scope input */
export function isValidScope(scope: unknown): scope is AttendantPassScope {
  return (
    scope === "full_details" ||
    scope === "emergency_only" ||
    scope === "medical_summary"
  );
}

/** Validate validity hours input */
export function isValidPassHours(hours: unknown): hours is AttendantPassValidity {
  return hours === 6 || hours === 12 || hours === 24;
}

/** Alias for hashToken — backward compat */
export const hashAttendantToken = hashToken;

/** Watermark string for the attendant pass PDF / view */
export function attendantWatermark(scope: AttendantPassScope): string {
  return `KavachSaathi Attendant Pass · ${PASS_SCOPE_LABELS[scope]} · Misuse is an offence.`;
}

/**
 * True if the token looks trivially guessable / malformed.
 * A valid token is 64 hex chars (32 bytes). Anything shorter or non-hex is suspect.
 */
export function isGuessableToken(token: string): boolean {
  return !token || token.length < 32 || !/^[0-9a-f]+$/i.test(token);
}

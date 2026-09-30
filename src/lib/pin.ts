import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** Always treat PIN as trimmed string — never Number() (leading zeros). */
export function normalizePin(pin: unknown): string {
  return String(pin ?? "").trim();
}

/** 4–6 digit numeric PIN */
export function isValidPin(pin: unknown): boolean {
  return /^\d{4,6}$/.test(normalizePin(pin));
}

export async function hashPin(pin: unknown): Promise<string> {
  const p = normalizePin(pin);
  if (!isValidPin(p)) {
    throw new Error("PIN must be 4–6 digits");
  }
  return bcrypt.hash(p, ROUNDS);
}

export async function verifyPin(
  pin: unknown,
  hash: string | null | undefined
): Promise<boolean> {
  const p = normalizePin(pin);
  if (!hash || !isValidPin(p)) return false;
  try {
    return await bcrypt.compare(p, hash);
  } catch {
    return false;
  }
}

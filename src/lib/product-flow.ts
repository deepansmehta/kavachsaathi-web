/**
 * KavachSaathi physical product flow
 * ----------------------------------
 * ONE adaptive QR per card (never changes):
 *   https://kavachsaathi.in/card/{health_id}
 *
 * Unactivated scan → activation form (requires secret activation_code + PIN)
 * Activated scan   → public emergency profile
 *
 * activation_code (0001–0100) is packaging-only — never printed near the QR.
 */

export const PRODUCT_SITE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "https://kavachsaathi.in";

/** Single QR URL printed on every card */
export function getCardUrl(healthId: string, origin?: string): string {
  const id = String(healthId || "").trim().toUpperCase();
  const base = (origin || PRODUCT_SITE).replace(/\/$/, "");
  return `${base}/card/${encodeURIComponent(id)}`;
}

/** @deprecated Use getCardUrl — QR is now adaptive */
export function getActivateUrl(healthId: string, origin?: string): string {
  return getCardUrl(healthId, origin);
}

/** @deprecated Use getCardUrl — QR is now adaptive */
export function getEmergencyUrl(healthId: string, origin?: string): string {
  return getCardUrl(healthId, origin);
}

/** Legacy sticker by activation_code */
export function getEmergencyUrlByCode(
  activationCode: string,
  origin?: string
): string {
  const code = String(activationCode || "")
    .trim()
    .padStart(4, "0")
    .slice(0, 4);
  const base = (origin || PRODUCT_SITE).replace(/\/$/, "");
  return `${base}/e/${code}`;
}

export const PACKAGING_STEPS = [
  {
    title: "Open the box",
    desc: "Find your unique QR sticker + secret activation code + blood-group sticker.",
  },
  {
    title: "Stick on your card",
    desc: "QR on the back. Blood-group sticker in the circle on the front. Keep the activation code private.",
  },
  {
    title: "Scan to activate",
    desc: "Scan the QR → enter packaging code + health details + PIN.",
  },
  {
    title: "Ready for emergency",
    desc: "After activation, the same QR opens your emergency medical profile — no login.",
  },
] as const;

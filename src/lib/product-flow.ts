/**
 * KavachSaathi physical product flow
 * ----------------------------------
 * 1. PVC cards are printed looking the SAME:
 *      - Front: empty red circle (blood-group sticker area)
 *      - Back: QR placeholder area
 * 2. Inside each box:
 *      - unique 4-digit activation code (0001–0100) + unique emergency QR sticker
 *      - blood-group stickers (A+, B+, …) to paste in the red circle
 * 3. User sticks QR on the back, blood-group sticker in the red circle.
 * 4. User activates online with the 4-digit code + health profile + login PIN.
 * 5. Scanning the QR opens /e/{code} — only that cardholder’s details.
 *
 * Digital rule: emergency URL is always tied to activation_code (card doc id).
 * Card face never prints a blood group — physical sticker only.
 */

export const PRODUCT_SITE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "https://kavachsaathi.in";

/** Public emergency URL encoded in the packaging QR sticker */
export function getEmergencyUrl(
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
    desc: "Find stickers: unique QR + 4-digit code, and your blood-group sticker.",
  },
  {
    title: "Stick on your card",
    desc: "QR on the back. Blood-group sticker inside the empty red circle on the front.",
  },
  {
    title: "Activate online",
    desc: "Enter the same 4-digit code on kavachsaathi.in/activate and set your profile + PIN.",
  },
  {
    title: "Ready for emergency",
    desc: "Anyone who scans your card QR sees only your medical details — no login.",
  },
] as const;

/**
 * Server-only Razorpay helpers. Never import from client components.
 */
import crypto from "crypto";
import Razorpay from "razorpay";
import { CARD_PRICE, CARD_PRICE_PAISE, LAUNCH_PACKS } from "@/lib/pricing";

export function razorpayConfigured(): boolean {
  const id =
    process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return Boolean(id && secret);
}

export function getRazorpayKeyId(): string {
  const id =
    process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!id) throw new Error("RAZORPAY_KEY_ID not configured");
  return id;
}

export function getRazorpayClient(): Razorpay {
  const key_id = getRazorpayKeyId();
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) throw new Error("RAZORPAY_KEY_SECRET not configured");
  return new Razorpay({ key_id, key_secret });
}

/** Resolve charge in INR + paise from pack and/or flat card quantity (server-trusted). */
export function resolveOrderAmount(input: {
  pack?: string;
  quantity?: number;
  /** Flat card count when no pack (amount = CARD_PRICE * cards). */
  cards?: number;
}): {
  amountInr: number;
  amountPaise: number;
  packId: string;
  cardCount: number;
  qty: number;
  unitPrice: number;
  cardsLabel: string;
} {
  const qty = Math.min(3, Math.max(1, Number(input.quantity) || 1));
  const packId = String(input.pack || "").trim();
  const packMeta = LAUNCH_PACKS.find((p) => p.id === packId);

  if (packMeta) {
    const amountInr = packMeta.price * qty;
    return {
      amountInr,
      amountPaise: amountInr * 100,
      packId: packMeta.id,
      cardCount: packMeta.cardCount,
      qty,
      unitPrice: packMeta.price,
      cardsLabel:
        packMeta.id === "Parents Suraksha"
          ? "2 cards + activation help"
          : `${packMeta.cardCount} card${packMeta.cardCount === 1 ? "" : "s"}`,
    };
  }

  // Flat ₹599 × card quantity (no pack)
  const cards = Math.min(18, Math.max(1, Number(input.cards) || qty));
  const amountInr = CARD_PRICE * cards;
  return {
    amountInr,
    amountPaise: CARD_PRICE_PAISE * cards,
    packId: "Single",
    cardCount: 1,
    qty: cards,
    unitPrice: CARD_PRICE,
    cardsLabel: `${cards} card${cards === 1 ? "" : "s"}`,
  };
}

export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(String(params.signature || ""), "utf8")
    );
  } catch {
    return false;
  }
}

export function newLocalOrderNo(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  return `KS-ORD-${t}${n}`;
}

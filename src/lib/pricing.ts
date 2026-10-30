/**
 * KavachSaathi — single source of truth for public pricing.
 * Order page packs, /pricing, homepage CTAs, and (future) checkout all read here.
 */

/** Optional compare-at price for marketing display (not charged). */
export const CARD_MRP = 699;
/** Single-card sell price (INR). Razorpay amount = CARD_PRICE * 100 * quantity (paise). */
export const CARD_PRICE = 599;
/** Same unit in paise — never trust client-supplied amounts for charge. */
export const CARD_PRICE_PAISE = CARD_PRICE * 100;
/** Marketing: digital emergency access is lifetime (no yearly renewal fee). */
export const CARD_LIFETIME = true;
/** @deprecated Kept for old imports — always treat as lifetime (no paid renewal). */
export const CARD_VALIDITY_YEARS = 0;
/** @deprecated No renewal fee — card access is lifetime free after purchase. */
export const RENEWAL_PRICE = 0;

export const GST_NOTE =
  "All prices are inclusive of GST. An invoice with GST details is shared after payment confirmation.";

export const DELIVERY = {
  /** 0 = free standard delivery */
  chargeInr: 0,
  label: "Free standard delivery across India",
  eta: "Typically 7–12 business days after payment confirmation",
  note: "Remote / difficult PIN codes may take longer.",
} as const;

/** Order-page benefit bullets (conversion copy). */
export const ORDER_BENEFITS = [
  "One QR scan shows your emergency health info — no app needed",
  "Blood group, allergies, current medicines & medical conditions",
  "Emergency contacts shown instantly to any helper",
  "Insurance / policy details on scan",
  "PIN-protected — your private data stays safe",
  "Waterproof, scratch-resistant premium PVC card",
  "Works for seniors, bikers, travellers, children & whole family",
  "Lifetime free emergency access + referral rewards",
] as const;

export const WHAT_IS_INCLUDED = [
  "Printed PVC KavachSaathi smart health card with unique QR",
  "Box sticker with QR + 4-digit activation code",
  "Lifetime free digital emergency profile access from activation — no yearly renewal fee",
  "Instant scan page for doctors — no app, no login",
  "Phone + PIN locked full profile and document vault",
  "Order support and activation help from GDM Technoworld",
] as const;

export type LaunchPack = {
  id: string;
  label: string;
  cards: string;
  cardCount: number;
  price: number;
  save: number;
  best?: boolean;
};

/** Family / combo packs — same list the order form uses. */
export const LAUNCH_PACKS: LaunchPack[] = [
  {
    id: "Single",
    label: "Single",
    cards: "1 card",
    cardCount: 1,
    price: CARD_PRICE,
    save: 0,
  },
  {
    id: "Couple / Jodi",
    label: "Couple / Jodi",
    cards: "2 cards",
    cardCount: 2,
    price: 1099,
    save: CARD_PRICE * 2 - 1099,
  },
  {
    id: "Parents Suraksha",
    label: "Parents Suraksha",
    cards: "2 cards + activation help",
    cardCount: 2,
    price: 1149,
    save: CARD_PRICE * 2 - 1149,
  },
  {
    id: "Family Pack",
    label: "Family Pack",
    cards: "4 cards",
    cardCount: 4,
    price: 1999,
    save: CARD_PRICE * 4 - 1999,
    best: true,
  },
  {
    id: "Joint Family",
    label: "Joint Family",
    cards: "6 cards",
    cardCount: 6,
    price: 2799,
    save: CARD_PRICE * 6 - 2799,
  },
];

export const COMPANY = {
  legalName: "GDM Technoworld Pvt. Ltd.",
  productLine: "KavachSaathi is a product of GDM Technoworld Pvt. Ltd.",
  website: "https://www.gdmtechnoworld.in",
  /** Public product site (Merchant / customer-facing). */
  siteUrl: "https://kavachsaathi.in",
  addressLine:
    "Sector 3, HUDA Sector, Fatehabad, Haryana, India – 125050",
  country: "India",
  email: "gdmtechnoworld@gmail.com",
  phones: [
    { display: "+91 72730 00075", tel: "+917273000075" },
    { display: "+91 73001 00102", tel: "+917300100102" },
  ],
  workingHours: "Monday–Saturday, 10:00 AM – 6:00 PM IST",
  closedNote: "Closed on Sundays and public holidays. WhatsApp / email replies next working day.",
} as const;

export const PRICING = {
  mrp: CARD_MRP,
  price: CARD_PRICE,
  lifetime: CARD_LIFETIME,
  validityYears: CARD_VALIDITY_YEARS,
  renewal: RENEWAL_PRICE,
  gstNote: GST_NOTE,
  delivery: DELIVERY,
  included: WHAT_IS_INCLUDED,
  packs: LAUNCH_PACKS,
} as const;

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

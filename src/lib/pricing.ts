/**
 * KavachSaathi — single source of truth for public pricing.
 * Order page packs, /pricing, homepage CTAs, and (future) checkout all read here.
 */

/** Optional compare-at price for marketing display (not charged). */
export const CARD_MRP = 999;
export const CARD_PRICE = 499;
export const CARD_VALIDITY_YEARS = 1;
export const RENEWAL_PRICE = 199;

export const GST_NOTE =
  "All prices are inclusive of GST. An invoice with GST details is shared after payment confirmation.";

export const DELIVERY = {
  /** 0 = free standard delivery */
  chargeInr: 0,
  label: "Free standard delivery across India",
  eta: "Typically 7–12 business days after payment confirmation",
  note: "Remote / difficult PIN codes may take longer. Exact timelines are confirmed on the order call.",
} as const;

export const WHAT_IS_INCLUDED = [
  "Printed PVC KavachSaathi smart health card with unique QR",
  "Box sticker with QR + 4-digit activation code",
  `${CARD_VALIDITY_YEARS} year digital emergency profile access from activation`,
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
    price: 899,
    save: CARD_PRICE * 2 - 899,
  },
  {
    id: "Parents Suraksha",
    label: "Parents Suraksha",
    cards: "2 cards + activation help",
    cardCount: 2,
    price: 949,
    save: CARD_PRICE * 2 - 949,
  },
  {
    id: "Family Pack",
    label: "Family Pack",
    cards: "4 cards",
    cardCount: 4,
    price: 1599,
    save: CARD_PRICE * 4 - 1599,
    best: true,
  },
  {
    id: "Joint Family",
    label: "Joint Family",
    cards: "6 cards",
    cardCount: 6,
    price: 2199,
    save: CARD_PRICE * 6 - 2199,
  },
];

export const COMPANY = {
  legalName: "GDM Technoworld Pvt. Ltd.",
  productLine: "KavachSaathi is a product of GDM Technoworld Pvt. Ltd.",
  website: "https://www.gdmtechnoworld.in",
  addressLine: "Sector 3, HUDA Sector, Fatehabad, Haryana",
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

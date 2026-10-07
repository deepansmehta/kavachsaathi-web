/** F50 — Car sticker orders (on order only; Admin SDK writes). */

export const STICKER_ORDER_STATUSES = [
  "requested",
  "confirmed",
  "printed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type StickerOrderStatus = (typeof STICKER_ORDER_STATUSES)[number];

/** Non-terminal orders count toward the per-card limit of 3. */
export const STICKER_OPEN_STATUSES: StickerOrderStatus[] = [
  "requested",
  "confirmed",
  "printed",
  "shipped",
];

/** Admin may download print file from confirmed onward. */
export const STICKER_PRINTABLE_STATUSES: StickerOrderStatus[] = [
  "confirmed",
  "printed",
  "shipped",
  "delivered",
];

export type VehicleType = "car" | "bike" | "other";

export function isStickerOrderStatus(s: string): s is StickerOrderStatus {
  return (STICKER_ORDER_STATUSES as readonly string[]).includes(s);
}

export function isVehicleType(s: string): s is VehicleType {
  return s === "car" || s === "bike" || s === "other";
}

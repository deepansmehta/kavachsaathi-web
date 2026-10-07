/**
 * F14 — Coverage Snapshot
 * Types and helpers for storing/displaying insurance coverage details.
 */

export type RoomRentLimit = {
  type: "day" | "percent" | "none";
  /** ₹/day when type=day; percentage when type=percent; ignored when type=none */
  value: number;
};

export type WaitingPeriods = {
  /** Initial waiting period in months */
  initial: number;
  /** Disease-specific waiting period in months */
  specific: number;
  /** Pre-existing disease waiting period in months */
  preExisting: number;
};

export type CoverageSnapshot = {
  /** Total sum insured in ₹ */
  sumInsured: number;
  /** Amount used so far this policy year in ₹ */
  usedSoFar: number;
  /** Room rent limit configuration */
  roomRentLimit: RoomRentLimit;
  /** ICU limit in ₹/day (0 = no separate limit) */
  icuLimit: number;
  /** Co-pay percentage (0 = no co-pay) */
  copayPercent: number;
  /** Deductible in ₹ (0 = none) */
  deductible: number;
  /** Policy start date ISO string */
  policyStartDate: string;
  /** Waiting periods */
  waitingPeriods: WaitingPeriods;
  /** Free-text sub-limits description */
  subLimitsText: string;
  /** Whether restoration benefit is available */
  restoration: boolean;
  /** When this snapshot was last saved (ISO) */
  updatedAt: string;
};

export const COVERAGE_DISCLAIMER =
  "This information is self-reported by the cardholder for quick reference only. It does not constitute an insurance certificate or coverage guarantee. Verify all details with your insurer / TPA before making financial decisions.";

/**
 * Given a CoverageSnapshot, returns a human-readable room-rent tip.
 * e.g. "Choose a room up to ₹5,000/day to avoid proportional deduction."
 */
export function roomRentTip(snapshot: CoverageSnapshot): string {
  const { roomRentLimit } = snapshot;
  if (roomRentLimit.type === "none") return "";
  if (roomRentLimit.type === "day") {
    const amt = formatInr(roomRentLimit.value);
    return `Choose a room up to ${amt}/day to avoid proportional deduction on the claim.`;
  }
  if (roomRentLimit.type === "percent") {
    const pct = roomRentLimit.value;
    const cap = snapshot.sumInsured > 0
      ? formatInr(Math.round((pct / 100) * snapshot.sumInsured))
      : `${pct}% of sum insured`;
    return `Choose a room up to ${pct}% of sum insured (≈${cap})/day to avoid proportional deduction.`;
  }
  return "";
}

/** ₹ formatted with Indian locale */
export function formatInr(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

/** Remaining coverage balance */
export function remainingCoverage(snapshot: CoverageSnapshot): number {
  return Math.max(0, snapshot.sumInsured - snapshot.usedSoFar);
}

/** Blank / default CoverageSnapshot */
export function emptyCoverageSnapshot(): CoverageSnapshot {
  return {
    sumInsured: 0,
    usedSoFar: 0,
    roomRentLimit: { type: "none", value: 0 },
    icuLimit: 0,
    copayPercent: 0,
    deductible: 0,
    policyStartDate: "",
    waitingPeriods: { initial: 0, specific: 0, preExisting: 0 },
    subLimitsText: "",
    restoration: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Validate incoming PATCH body — returns error string or null */
export function validateCoverageSnapshot(
  body: unknown
): string | null {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Record<string, unknown>;

  if (typeof b.sumInsured !== "number" || b.sumInsured < 0)
    return "sumInsured must be a non-negative number";
  if (typeof b.usedSoFar !== "number" || b.usedSoFar < 0)
    return "usedSoFar must be a non-negative number";
  if (typeof b.icuLimit !== "number" || b.icuLimit < 0)
    return "icuLimit must be a non-negative number";
  if (typeof b.copayPercent !== "number" || b.copayPercent < 0 || b.copayPercent > 100)
    return "copayPercent must be 0–100";
  if (typeof b.deductible !== "number" || b.deductible < 0)
    return "deductible must be a non-negative number";
  if (b.policyStartDate !== undefined && b.policyStartDate !== "" && typeof b.policyStartDate !== "string")
    return "policyStartDate must be a string";
  if (typeof b.restoration !== "boolean" && b.restoration !== undefined)
    return "restoration must be boolean";

  if (b.roomRentLimit) {
    const rl = b.roomRentLimit as Record<string, unknown>;
    if (!["day", "percent", "none"].includes(String(rl.type)))
      return "roomRentLimit.type must be day|percent|none";
    if (typeof rl.value !== "number" || rl.value < 0)
      return "roomRentLimit.value must be a non-negative number";
  }

  if (b.waitingPeriods) {
    const wp = b.waitingPeriods as Record<string, unknown>;
    for (const k of ["initial", "specific", "preExisting"] as const) {
      if (wp[k] !== undefined && (typeof wp[k] !== "number" || (wp[k] as number) < 0))
        return `waitingPeriods.${k} must be a non-negative number`;
    }
  }

  return null;
}

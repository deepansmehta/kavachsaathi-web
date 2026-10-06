/** F14 — Coverage snapshot helpers */

export type RoomRentLimit = {
  type: "day" | "percent" | "none";
  value: number | null;
};

export type WaitingPeriods = {
  initialMonths: number | null;
  specificMonths: number | null;
  preExistingMonths: number | null;
};

export type CoverageSnapshot = {
  sumInsured: number | null;
  usedSoFar: number | null;
  roomRentLimit: RoomRentLimit;
  icuLimit: number | null;
  copayPercent: number | null;
  deductible: number | null;
  policyStartDate: string | null;
  waitingPeriods: WaitingPeriods;
  subLimitsText: string;
  restoration: boolean | null;
};

export const COVERAGE_DISCLAIMER =
  "As entered by the policyholder — confirm with your insurer/TPA.";

export function emptyCoverage(): CoverageSnapshot {
  return {
    sumInsured: null,
    usedSoFar: null,
    roomRentLimit: { type: "none", value: null },
    icuLimit: null,
    copayPercent: null,
    deductible: null,
    policyStartDate: null,
    waitingPeriods: {
      initialMonths: null,
      specificMonths: null,
      preExistingMonths: null,
    },
    subLimitsText: "",
    restoration: null,
  };
}

export function roomTip(c: CoverageSnapshot): string | null {
  if (c.roomRentLimit.type === "day" && c.roomRentLimit.value != null) {
    return `Choose a room up to ₹${c.roomRentLimit.value}/day to avoid proportional deduction`;
  }
  if (c.roomRentLimit.type === "percent" && c.roomRentLimit.value != null) {
    return `Room rent is limited to ${c.roomRentLimit.value}% of sum insured — confirm the ₹/day equivalent with your insurer/TPA to avoid proportional deduction`;
  }
  return null;
}

export function parseCoverage(raw: unknown): CoverageSnapshot {
  const base = emptyCoverage();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) =>
    v === null || v === undefined || v === ""
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;
  const rr = (o.roomRentLimit || {}) as Record<string, unknown>;
  const wp = (o.waitingPeriods || {}) as Record<string, unknown>;
  const type =
    rr.type === "day" || rr.type === "percent" || rr.type === "none"
      ? rr.type
      : "none";
  return {
    sumInsured: num(o.sumInsured),
    usedSoFar: num(o.usedSoFar),
    roomRentLimit: { type, value: num(rr.value) },
    icuLimit: num(o.icuLimit),
    copayPercent: num(o.copayPercent),
    deductible: num(o.deductible),
    policyStartDate: o.policyStartDate ? String(o.policyStartDate) : null,
    waitingPeriods: {
      initialMonths: num(wp.initialMonths),
      specificMonths: num(wp.specificMonths),
      preExistingMonths: num(wp.preExistingMonths),
    },
    subLimitsText: String(o.subLimitsText || "").slice(0, 2000),
    restoration:
      o.restoration === true ? true : o.restoration === false ? false : null,
  };
}

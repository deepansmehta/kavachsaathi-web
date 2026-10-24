import { POLICY_TYPE_LABELS } from "./constants";
import { readPoliciesFromProfile } from "./cryptoPolicy";
import {
  formatPolicyDateDMY,
  maskPolicyNumber,
  policyStatus,
} from "./status";
import type { PublicPolicyBlock, PolicyStored } from "./types";

/**
 * Public emergency insurance blocks.
 * NEVER includes: full policyNumber, nominee, documents, sumInsured, memberId.
 */
export function publicPolicyBlocksFromProfile(
  data: Record<string, unknown> | null | undefined
): PublicPolicyBlock[] {
  const policies = readPoliciesFromProfile(data);
  const out: PublicPolicyBlock[] = [];

  for (const p of policies) {
    if (p.showOnEmergencyScan === false) continue;
    const status = policyStatus(p.endDate);
    // Show active + expiring + expired (expired gets red badge)
    const labels = POLICY_TYPE_LABELS[p.type] || POLICY_TYPE_LABELS.other;
    out.push({
      insurerName: String(p.insurerName || "").trim() || "Insurer",
      type: p.type,
      typeLabelEn: labels.en,
      typeLabelHi: labels.hi,
      tpaName: p.tpaName ? String(p.tpaName) : null,
      cashlessHelpline: p.cashlessHelpline
        ? String(p.cashlessHelpline).replace(/\s/g, "")
        : null,
      claimHelpline: p.claimHelpline
        ? String(p.claimHelpline).replace(/\s/g, "")
        : null,
      policyNumberMasked: maskPolicyNumber(p.policyNumberLast4),
      status,
      endDate: p.endDate || null,
      expiredOnLabel:
        status === "expired" ? formatPolicyDateDMY(p.endDate) : null,
    });
  }

  // Family floater: linked member profiles store coveredByPolicies
  const linked = data?.floaterPolicies as
    | Array<{
        showOnEmergencyScan?: boolean;
        insurerName?: string;
        type?: PolicyStored["type"];
        tpaName?: string | null;
        cashlessHelpline?: string | null;
        claimHelpline?: string | null;
        policyNumberLast4?: string | null;
        endDate?: string | null;
      }>
    | undefined;
  if (Array.isArray(linked)) {
    for (const p of linked) {
      if (p.showOnEmergencyScan === false) continue;
      const type = (p.type || "health") as PolicyStored["type"];
      const labels = POLICY_TYPE_LABELS[type] || POLICY_TYPE_LABELS.other;
      const status = policyStatus(p.endDate);
      out.push({
        insurerName: String(p.insurerName || "").trim() || "Insurer",
        type,
        typeLabelEn: labels.en,
        typeLabelHi: labels.hi,
        tpaName: p.tpaName || null,
        cashlessHelpline: p.cashlessHelpline
          ? String(p.cashlessHelpline).replace(/\s/g, "")
          : null,
        claimHelpline: p.claimHelpline
          ? String(p.claimHelpline).replace(/\s/g, "")
          : null,
        policyNumberMasked: maskPolicyNumber(p.policyNumberLast4),
        status,
        endDate: p.endDate || null,
        expiredOnLabel:
          status === "expired" ? formatPolicyDateDMY(p.endDate) : null,
      });
    }
  }

  return out;
}

/** Assert API JSON never leaks sensitive keys (public emergency payload). */
export function assertPublicPolicySafe(obj: unknown): boolean {
  const s = JSON.stringify(obj);
  if (/"policyNumber"\s*:/.test(s)) return false;
  if (/"policyNumberEnc"\s*:/.test(s)) return false;
  if (/"memberId"\s*:/.test(s)) return false;
  if (/"memberIdEnc"\s*:/.test(s)) return false;
  if (/"nominee"\s*:/.test(s)) return false;
  if (/"sumInsured"\s*:/.test(s)) return false;
  if (/"documents"\s*:/.test(s)) return false;
  if (/"claims"\s*:/.test(s)) return false;
  return true;
}

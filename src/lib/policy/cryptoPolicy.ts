import { encrypt, decrypt, hasEncKey } from "@/lib/crypto";
import { last4FromNumber } from "./status";
import type {
  PolicyNominee,
  PolicyNomineeStored,
  PolicyRecord,
  PolicyStored,
} from "./types";

export function safeDecryptField(enc: unknown): string | null {
  if (!enc || typeof enc !== "string") return null;
  if (!hasEncKey()) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

export function encryptField(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (!hasEncKey()) throw new Error("Encryption not configured");
  return encrypt(v);
}

export function encryptNominee(
  n: PolicyNominee | null | undefined
): PolicyNomineeStored | null {
  if (!n) return null;
  const name = String(n.name || "").trim();
  const relation = String(n.relation || "").trim();
  const phone = String(n.phone || "").trim();
  if (!name && !relation && !phone) return null;
  return {
    nameEnc: name ? encryptField(name) : null,
    relationEnc: relation ? encryptField(relation) : null,
    phoneEnc: phone ? encryptField(phone) : null,
  };
}

export function decryptNominee(
  n: PolicyNomineeStored | null | undefined
): PolicyNominee | null {
  if (!n) return null;
  const name = safeDecryptField(n.nameEnc) || "";
  const relation = safeDecryptField(n.relationEnc) || "";
  const phone = safeDecryptField(n.phoneEnc) || "";
  if (!name && !relation && !phone) return null;
  return { name, relation, phone };
}

export function toStoredPolicy(
  input: Partial<PolicyRecord> & { id: string; type: PolicyRecord["type"] },
  existing?: PolicyStored | null
): PolicyStored {
  const now = new Date().toISOString();
  const policyNumber =
    input.policyNumber !== undefined
      ? String(input.policyNumber || "").trim() || null
      : existing
        ? safeDecryptField(existing.policyNumberEnc)
        : null;
  const memberId =
    input.memberId !== undefined
      ? String(input.memberId || "").trim() || null
      : existing
        ? safeDecryptField(existing.memberIdEnc)
        : null;

  const nominee =
    input.nominee !== undefined
      ? encryptNominee(input.nominee)
      : existing?.nominee || null;

  return {
    id: input.id,
    type: input.type,
    insurerName: String(
      input.insurerName ?? existing?.insurerName ?? ""
    ).trim(),
    policyNumberEnc:
      policyNumber !== null && policyNumber !== undefined
        ? encryptField(policyNumber)
        : null,
    memberIdEnc:
      memberId !== null && memberId !== undefined
        ? encryptField(memberId)
        : null,
    policyNumberLast4: last4FromNumber(policyNumber),
    tpaName: nullishStr(input.tpaName, existing?.tpaName),
    cashlessHelpline: nullishStr(
      input.cashlessHelpline,
      existing?.cashlessHelpline
    ),
    claimHelpline: nullishStr(input.claimHelpline, existing?.claimHelpline),
    sumInsured: nullishStr(input.sumInsured, existing?.sumInsured),
    roomRentLimit: nullishStr(input.roomRentLimit, existing?.roomRentLimit),
    coPayPercent: nullishStr(input.coPayPercent, existing?.coPayPercent),
    waitingPeriodNote: nullishStr(
      input.waitingPeriodNote,
      existing?.waitingPeriodNote
    ),
    startDate: nullishStr(input.startDate, existing?.startDate),
    endDate: nullishStr(input.endDate, existing?.endDate),
    isFamilyFloater:
      input.isFamilyFloater ?? existing?.isFamilyFloater ?? false,
    coveredMembers: Array.isArray(input.coveredMembers)
      ? input.coveredMembers.map(String)
      : existing?.coveredMembers || [],
    nominee,
    agent:
      input.agent !== undefined
        ? input.agent
        : existing?.agent || null,
    documents: Array.isArray(input.documents)
      ? input.documents
      : existing?.documents || [],
    claims: Array.isArray(input.claims)
      ? input.claims
      : existing?.claims || [],
    showOnEmergencyScan:
      input.showOnEmergencyScan ?? existing?.showOnEmergencyScan ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function nullishStr(
  next: string | null | undefined,
  prev: string | null | undefined
): string | null {
  if (next !== undefined) {
    const t = String(next || "").trim();
    return t || null;
  }
  return prev ?? null;
}

export function toClientPolicy(stored: PolicyStored): PolicyRecord {
  return {
    id: stored.id,
    type: stored.type,
    insurerName: stored.insurerName,
    policyNumber: safeDecryptField(stored.policyNumberEnc),
    memberId: safeDecryptField(stored.memberIdEnc),
    tpaName: stored.tpaName,
    cashlessHelpline: stored.cashlessHelpline,
    claimHelpline: stored.claimHelpline,
    sumInsured: stored.sumInsured,
    roomRentLimit: stored.roomRentLimit,
    coPayPercent: stored.coPayPercent,
    waitingPeriodNote: stored.waitingPeriodNote,
    startDate: stored.startDate,
    endDate: stored.endDate,
    isFamilyFloater: !!stored.isFamilyFloater,
    coveredMembers: stored.coveredMembers || [],
    nominee: decryptNominee(stored.nominee),
    agent: stored.agent || null,
    documents: stored.documents || [],
    claims: stored.claims || [],
    showOnEmergencyScan: stored.showOnEmergencyScan !== false,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/** Owner list view — mask full number unless pin scope later */
export function toOwnerPolicySummary(stored: PolicyStored): PolicyRecord {
  return toClientPolicy(stored);
}

export function readPoliciesFromProfile(
  data: Record<string, unknown> | null | undefined
): PolicyStored[] {
  const raw = data?.policies;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is PolicyStored =>
      !!p && typeof p === "object" && typeof (p as PolicyStored).id === "string"
  );
}

export function readReminderPrefs(
  data: Record<string, unknown> | null | undefined
): { push: boolean; calendarExported: boolean; fcmToken: string | null } {
  const p = data?.policyReminderPrefs as
    | { push?: boolean; calendarExported?: boolean; fcmToken?: string }
    | undefined;
  return {
    push: !!p?.push,
    calendarExported: !!p?.calendarExported,
    fcmToken: p?.fcmToken ? String(p.fcmToken) : null,
  };
}

import { randomBytes } from "crypto";
import type { AgentClientView, AgentRecord, PolicyStored } from "./types";
import { policyStatus } from "./status";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short agent code e.g. AG-7K3P9 */
export function generateAgentCode(): string {
  const bytes = randomBytes(5);
  let body = "";
  for (let i = 0; i < 5; i++) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `AG-${body}`;
}

export function normalizeAgentCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidAgentCode(code: string): boolean {
  return /^AG-[A-Z0-9]{5}$/.test(normalizeAgentCode(code));
}

/** Mask card ID: KVS-2026-***45 */
export function maskCardId(healthId: string): string {
  const id = String(healthId || "").trim();
  if (id.length < 4) return "KVS-****";
  const last2 = id.slice(-2);
  const prefix = id.slice(0, Math.min(8, id.length - 2));
  return `${prefix}***${last2}`;
}

export function agentClientFromPolicy(
  holderName: string,
  healthId: string,
  policy: PolicyStored
): AgentClientView {
  const parts = String(holderName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = parts[0] || "Member";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const lastInitial = last ? last.charAt(0).toUpperCase() : "";
  return {
    firstName,
    lastInitial,
    cardIdMasked: maskCardId(healthId),
    policyType: policy.type,
    insurerName: policy.insurerName,
    endDate: policy.endDate,
    renewalStatus: policy.endDate ? policyStatus(policy.endDate) : "unknown",
  };
}

export function agentToPublic(a: AgentRecord): {
  agentCode: string;
  name: string;
  phone: string;
  company: string;
  city: string;
  status: AgentRecord["status"];
} {
  return {
    agentCode: a.agentCode,
    name: a.name,
    phone: a.phone,
    company: a.company,
    city: a.city,
    status: a.status,
  };
}

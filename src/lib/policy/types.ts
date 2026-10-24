/** Policy Saathi — additive profile.policies[] model (no migration required). */

export const POLICY_TYPES = [
  "health",
  "life",
  "motor",
  "personal_accident",
  "term",
  "travel",
  "ayushman_pmjay",
  "esic",
  "cghs",
  "state_scheme",
  "pmjjby",
  "pmsby",
  "other",
] as const;

export type PolicyType = (typeof POLICY_TYPES)[number];

export const CLAIM_STATUSES = [
  "intimated",
  "documents_submitted",
  "under_review",
  "approved",
  "settled",
  "rejected",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_TYPES = [
  "cashless_hospitalisation",
  "reimbursement",
  "accident_fir",
  "death_claim",
  "motor_accident",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export const DOC_KINDS = ["policy_copy", "card", "claim_doc"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const MAX_POLICIES = 10;
export const MAX_DOCS_PER_POLICY = 5;
export const MAX_CLAIMS_PER_POLICY = 10;
export const MAX_POLICY_FILE_BYTES = 5 * 1024 * 1024;

export type PolicyDocument = {
  storagePath: string;
  fileName: string;
  kind: DocKind;
  contentType?: string;
  uploadedAt: string;
};

export type PolicyNominee = {
  name: string;
  relation: string;
  phone: string;
};

/** Stored encrypted shape */
export type PolicyNomineeStored = {
  nameEnc: string | null;
  relationEnc: string | null;
  phoneEnc: string | null;
};

export type PolicyAgentLink = {
  agentCode: string | null;
  name: string | null;
  phone: string | null;
};

export type PolicyClaim = {
  id: string;
  claimType: ClaimType;
  hospital: string;
  admissionDate: string;
  status: ClaimStatus;
  notes: string;
  checklistTicks: Record<string, boolean>;
  documents: PolicyDocument[];
  timeline: { status: ClaimStatus; at: string; note?: string }[];
  updatedAt: string;
  createdAt: string;
};

/** Client / decrypted view */
export type PolicyRecord = {
  id: string;
  type: PolicyType;
  insurerName: string;
  policyNumber: string | null;
  memberId: string | null;
  tpaName: string | null;
  cashlessHelpline: string | null;
  claimHelpline: string | null;
  sumInsured: string | null;
  roomRentLimit: string | null;
  coPayPercent: string | null;
  waitingPeriodNote: string | null;
  startDate: string | null;
  endDate: string | null;
  isFamilyFloater: boolean;
  coveredMembers: string[];
  nominee: PolicyNominee | null;
  agent: PolicyAgentLink | null;
  documents: PolicyDocument[];
  claims: PolicyClaim[];
  showOnEmergencyScan: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Firestore stored shape (encrypted fields) */
export type PolicyStored = {
  id: string;
  type: PolicyType;
  insurerName: string;
  policyNumberEnc: string | null;
  memberIdEnc: string | null;
  policyNumberLast4: string | null;
  tpaName: string | null;
  cashlessHelpline: string | null;
  claimHelpline: string | null;
  sumInsured: string | null;
  roomRentLimit: string | null;
  coPayPercent: string | null;
  waitingPeriodNote: string | null;
  startDate: string | null;
  endDate: string | null;
  isFamilyFloater: boolean;
  coveredMembers: string[];
  nominee: PolicyNomineeStored | null;
  agent: PolicyAgentLink | null;
  documents: PolicyDocument[];
  claims: PolicyClaim[];
  showOnEmergencyScan: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PolicyReminderPrefs = {
  push: boolean;
  calendarExported: boolean;
  fcmToken?: string | null;
};

/** Safe public emergency projection — never includes full numbers / nominee / docs / sum */
export type PublicPolicyBlock = {
  insurerName: string;
  type: PolicyType;
  typeLabelEn: string;
  typeLabelHi: string;
  tpaName: string | null;
  cashlessHelpline: string | null;
  claimHelpline: string | null;
  policyNumberMasked: string;
  status: "active" | "expiring_soon" | "expired";
  endDate: string | null;
  expiredOnLabel: string | null;
};

export type AgentStatus = "pending" | "approved";

export type AgentRecord = {
  id: string;
  uid: string;
  agentCode: string;
  name: string;
  phone: string;
  company: string;
  agencyCode: string | null;
  city: string;
  status: AgentStatus;
  pushOptIn: boolean;
  fcmToken: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentClientView = {
  firstName: string;
  lastInitial: string;
  cardIdMasked: string;
  policyType: PolicyType;
  insurerName: string;
  endDate: string | null;
  renewalStatus: "active" | "expiring_soon" | "expired" | "unknown";
};

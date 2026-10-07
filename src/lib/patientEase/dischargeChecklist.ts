/**
 * F15 — Discharge Checklist
 * Pre-built checklist items for cashless and reimbursement discharge.
 */

export type ChecklistItem = {
  id: string;
  label: string;
};

export type ChecklistState = Record<string, boolean>;

export const CASHLESS_ITEMS: ChecklistItem[] = [
  { id: "cl_auth_letter", label: "Pre-authorisation letter from insurer / TPA" },
  { id: "cl_discharge_summary", label: "Discharge summary (original + 2 copies)" },
  { id: "cl_final_bill", label: "Final hospital bill with itemised breakup" },
  { id: "cl_pharmacy_bills", label: "Pharmacy / consumable bills" },
  { id: "cl_lab_reports", label: "Lab / investigation reports (original)" },
  { id: "cl_id_proof", label: "Patient photo ID proof copy" },
  { id: "cl_insurance_card", label: "Insurance card / policy copy" },
  { id: "cl_consent_form", label: "Signed cashless consent / claim form" },
  { id: "cl_sticker", label: "Hospital sticker on insurer form" },
  { id: "cl_room_category", label: "Room category proof (entitlement letter if needed)" },
  { id: "cl_referral", label: "Referral / OPD prescriptions (if applicable)" },
];

export const REIMBURSEMENT_ITEMS: ChecklistItem[] = [
  { id: "rb_discharge_summary", label: "Discharge summary (original)" },
  { id: "rb_final_bill", label: "Final hospital bill (original + receipts)" },
  { id: "rb_pharmacy_bills", label: "Pharmacy bills with prescriptions" },
  { id: "rb_lab_reports", label: "Lab reports (original)" },
  { id: "rb_claim_form", label: "Signed reimbursement claim form" },
  { id: "rb_id_proof", label: "Patient photo ID proof copy" },
  { id: "rb_policy_copy", label: "Insurance policy copy" },
  { id: "rb_bank_details", label: "Cancelled cheque / bank account details" },
  { id: "rb_admission_sheet", label: "Admission / OPD registration sheet" },
  { id: "rb_referral", label: "Referral letter / OPD prescriptions" },
  { id: "rb_pre_auth", label: "Pre-authorisation letter (if obtained)" },
  { id: "rb_room_category", label: "Room category / entitlement document" },
  { id: "rb_implants", label: "Implant / device sticker/invoice (if applicable)" },
];

export type ChecklistProgress = {
  total: number;
  done: number;
  percent: number;
  remaining: ChecklistItem[];
};

/**
 * Given a state map {id→checked} and the item list, returns progress stats.
 */
export function checklistProgress(
  items: ChecklistItem[],
  state: ChecklistState
): ChecklistProgress {
  const done = items.filter((i) => state[i.id] === true).length;
  const total = items.length;
  const remaining = items.filter((i) => !state[i.id]);
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    remaining,
  };
}

/** Merge partial state updates into existing state */
export function mergeChecklistState(
  existing: ChecklistState,
  updates: Record<string, boolean>
): ChecklistState {
  return { ...existing, ...updates };
}

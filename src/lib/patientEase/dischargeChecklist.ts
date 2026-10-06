/** F15 — Discharge checklist */

export type ChecklistItem = { id: string; label: string };

export const CASHLESS_ITEMS: ChecklistItem[] = [
  { id: "itemized_bill", label: "Itemized final bill" },
  { id: "discharge_summary", label: "Discharge summary" },
  { id: "reports", label: "Investigation / lab reports" },
  { id: "pharmacy", label: "Pharmacy bills" },
  { id: "tpa_final", label: "TPA final approval" },
  { id: "settlement", label: "Settlement letter" },
  { id: "prescription", label: "Discharge prescription" },
  { id: "followup", label: "Follow-up date noted" },
];

export const REIMBURSEMENT_ITEMS: ChecklistItem[] = [
  { id: "itemized_bill", label: "Itemized final bill" },
  { id: "discharge_summary", label: "Discharge summary" },
  { id: "reports", label: "Investigation / lab reports" },
  { id: "pharmacy", label: "Pharmacy bills" },
  { id: "claim_form", label: "Insurer claim form filled" },
  { id: "settlement", label: "Payment receipts / settlement letter" },
  { id: "prescription", label: "Discharge prescription" },
  { id: "followup", label: "Follow-up date noted" },
];

export type StayMode = "cashless" | "reimbursement";

export function itemsForMode(mode: StayMode): ChecklistItem[] {
  return mode === "cashless" ? CASHLESS_ITEMS : REIMBURSEMENT_ITEMS;
}

export function progress(
  mode: StayMode,
  checked: Record<string, boolean> | undefined
): { done: number; total: number; label: string } {
  const items = itemsForMode(mode);
  const done = items.filter((i) => checked?.[i.id] === true).length;
  return { done, total: items.length, label: `${done} of ${items.length} ready` };
}

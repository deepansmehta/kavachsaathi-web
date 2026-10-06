/** F18 — Claim deadline countdown */

import {
  buildIcs,
  googleCalendarReminderUrl,
} from "@/lib/config/links";

export const CLAIM_REQUIRED_DOCS = [
  "Itemized final bill",
  "Discharge summary",
  "Investigation reports",
  "Pharmacy bills",
  "Claim form (insurer/TPA)",
  "ID & policy card copies",
  "Cancelled cheque / bank details (if reimbursement)",
];

export function claimDueDate(dischargeDate: string, windowDays: number): Date {
  const d = new Date(dischargeDate);
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + Math.max(1, Math.min(365, Number(windowDays) || 30)));
  return d;
}

export function claimCountdown(dischargeDate: string, windowDays: number, now = new Date()) {
  const due = claimDueDate(dischargeDate, windowDays);
  const ms = due.getTime() - now.getTime();
  const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return {
    dueIso: due.toISOString(),
    daysLeft,
    overdue: daysLeft < 0,
    label:
      daysLeft < 0
        ? `Overdue by ${Math.abs(daysLeft)} day(s)`
        : daysLeft === 0
          ? "Due today"
          : `${daysLeft} day(s) left to file claim`,
  };
}

export function claimCalendarLinks(opts: {
  dischargeDate: string;
  windowDays: number;
  name?: string;
}) {
  const due = claimDueDate(opts.dischargeDate, opts.windowDays);
  const start = new Date(due);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const title = `File insurance claim — ${opts.name || "KavachSaathi"}`;
  const details = `Claim window ends. Documents: ${CLAIM_REQUIRED_DOCS.join("; ")}`;
  return {
    googleCalendarUrl: googleCalendarReminderUrl({
      title,
      details,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    }),
    ics: buildIcs({
      title,
      description: details,
      start,
      end,
      uid: `claim-${opts.dischargeDate}@kavachsaathi.in`,
    }),
  };
}

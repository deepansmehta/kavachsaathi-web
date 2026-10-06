/** F20 / F21 helpers */

import {
  buildIcs,
  googleCalendarReminderUrl,
} from "@/lib/config/links";

export type ConditionEntry = { name: string; sinceYear?: string | null };
export type SurgeryEntry = {
  name: string;
  year?: string | null;
  hospital?: string | null;
};
export type MedicineEntry = {
  name: string;
  dose?: string | null;
  frequency?: string | null;
  times?: string[];
  start?: string | null;
  end?: string | null;
};
export type VaccinationEntry = { name: string; date?: string | null };
export type FollowUpVisit = {
  id?: string;
  title: string;
  whenIso: string;
  notes?: string | null;
};

export function medicineCalendar(med: MedicineEntry) {
  const title = `Medicine: ${med.name}${med.dose ? ` (${med.dose})` : ""}`;
  const details = [med.frequency, ...(med.times || [])].filter(Boolean).join(" · ");
  const start = med.start ? new Date(med.start) : new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  return {
    googleCalendarUrl: googleCalendarReminderUrl({
      title,
      details: details || "Daily medicine reminder",
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    }),
    ics: buildIcs({
      title,
      description: `${details}\nRRULE hint: daily while on this medicine`,
      start,
      end,
      uid: `med-${med.name.replace(/\W+/g, "")}@kavachsaathi.in`,
    }),
  };
}

export function visitCalendar(v: FollowUpVisit) {
  const start = new Date(v.whenIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    googleCalendarUrl: googleCalendarReminderUrl({
      title: v.title,
      details: v.notes || "Follow-up visit",
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    }),
    ics: buildIcs({
      title: v.title,
      description: v.notes || "Follow-up visit",
      start,
      end,
      uid: `visit-${start.getTime()}@kavachsaathi.in`,
    }),
  };
}

export function needBloodWaMessage(opts: {
  bloodGroup: string;
  firstName: string;
  hospital: string;
  phone: string;
}): string {
  return `URGENT: ${opts.bloodGroup} blood needed for ${opts.firstName} at ${opts.hospital}. Please call ${opts.phone}.`;
}

export function firstNameOnly(full: string): string {
  const p = String(full || "")
    .trim()
    .split(/\s+/);
  return p[0] || "Patient";
}

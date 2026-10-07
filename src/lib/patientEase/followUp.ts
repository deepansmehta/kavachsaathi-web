/**
 * Follow-up planner helpers — medicine schedule + visit types.
 * Calendar/ICS helpers are in @/lib/config/links (googleCalendarReminderUrl, buildIcs).
 */

export type VisitType =
  | "follow_up"
  | "lab_test"
  | "specialist"
  | "vaccination"
  | "physiotherapy"
  | "dental"
  | "other";

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  follow_up: "Follow-up",
  lab_test: "Lab test",
  specialist: "Specialist",
  vaccination: "Vaccination",
  physiotherapy: "Physiotherapy",
  dental: "Dental",
  other: "Other",
};

export const ALLOWED_VISIT_TYPES: VisitType[] = [
  "follow_up",
  "lab_test",
  "specialist",
  "vaccination",
  "physiotherapy",
  "dental",
  "other",
];

export type MedFrequency =
  | "once_daily"
  | "twice_daily"
  | "thrice_daily"
  | "every_6h"
  | "every_8h"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "as_needed"
  | "other";

export const MED_FREQ_LABELS: Record<MedFrequency, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  thrice_daily: "Thrice daily",
  every_6h: "Every 6 hours",
  every_8h: "Every 8 hours",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  as_needed: "As needed",
  other: "Other",
};

export const ALLOWED_FREQUENCIES: MedFrequency[] = Object.keys(
  MED_FREQ_LABELS
) as MedFrequency[];

/** A medicine schedule entry stored in Firestore subcollection `follow_up_medicines`. */
export type FollowUpMedicine = {
  id: string;
  name: string;
  dose?: string;
  frequency: MedFrequency;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/** A visit / appointment entry stored in `follow_up_visits`. */
export type FollowUpVisit = {
  id: string;
  type: VisitType;
  title: string;
  dueDate: string; // ISO date string YYYY-MM-DD
  doctor?: string;
  hospital?: string;
  notes?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Build a Google Calendar URL for a visit. */
export function visitCalendarUrl(visit: FollowUpVisit): string {
  const start = new Date(`${visit.dueDate}T09:00:00`);
  const end = new Date(`${visit.dueDate}T10:00:00`);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: visit.title,
    details: [
      visit.doctor ? `Doctor: ${visit.doctor}` : null,
      visit.hospital ? `Hospital: ${visit.hospital}` : null,
      visit.notes || null,
    ]
      .filter(Boolean)
      .join("\n"),
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
}

/** Build an .ics blob string for a visit. */
export function visitIcs(visit: FollowUpVisit): string {
  const start = new Date(`${visit.dueDate}T09:00:00`);
  const end = new Date(`${visit.dueDate}T10:00:00`);
  const stamp = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `kavach-visit-${visit.id}@kavachsaathi.in`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KavachSaathi//FollowUp//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART;TZID=Asia/Kolkata:${stamp(start)}`,
    `DTEND;TZID=Asia/Kolkata:${stamp(end)}`,
    `SUMMARY:${visit.title.replace(/\n/g, " ")}`,
    visit.notes ? `DESCRIPTION:${visit.notes.replace(/\n/g, "\\n")}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return lines;
}

export const MAX_MEDICINES = 20;
export const MAX_VISITS = 30;

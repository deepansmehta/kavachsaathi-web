import { parsePolicyDate } from "./status";

/** Build .ics with 3 reminder events: 30, 7, and 1 day before endDate. */
export function buildPolicyRenewalIcs(opts: {
  insurerName: string;
  policyTypeLabel: string;
  endDate: string;
  healthId: string;
}): string {
  const end = parsePolicyDate(opts.endDate);
  if (!end) throw new Error("Invalid end date");

  const offsets = [30, 7, 1];
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KavachSaathi//PolicyRenewal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const days of offsets) {
    const d = new Date(end);
    d.setDate(d.getDate() - days);
    const stamp = formatIcsDate(d);
    const uid = `policy-renewal-${opts.healthId}-${days}d-${stamp}@kavachsaathi.in`;
    const summary = escapeIcs(
      `KavachSaathi: ${opts.insurerName} (${opts.policyTypeLabel}) renews in ${days} day(s)`
    );
    const desc = escapeIcs(
      `Reminder: your ${opts.policyTypeLabel} policy with ${opts.insurerName} ends soon. KavachSaathi does not sell insurance.`
    );
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatIcsUtcNow()}`,
      `DTSTART;VALUE=DATE:${stamp}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function formatIcsDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatIcsUtcNow(): string {
  const n = new Date();
  return (
    n.getUTCFullYear().toString() +
    String(n.getUTCMonth() + 1).padStart(2, "0") +
    String(n.getUTCDate()).padStart(2, "0") +
    "T" +
    String(n.getUTCHours()).padStart(2, "0") +
    String(n.getUTCMinutes()).padStart(2, "0") +
    String(n.getUTCSeconds()).padStart(2, "0") +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Count VEVENT blocks — used in tests */
export function countIcsEvents(ics: string): number {
  return (ics.match(/BEGIN:VEVENT/g) || []).length;
}

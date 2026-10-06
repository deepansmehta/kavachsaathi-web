/**
 * Public / company contact links (no secrets).
 * Used by renewal WhatsApp, lost-card helpline, order+referral, etc.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://kavachsaathi.in";

/** Digits only, with country code (default India). */
export const COMPANY_WHATSAPP = String(
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919416106511"
).replace(/\D/g, "");

export const HELPLINE_DISPLAY =
  process.env.NEXT_PUBLIC_HELPLINE_DISPLAY || "+91 94161 06511";

/** Alias used in Pack 3 docs / specs */
export const HELP_LINE_DISPLAY = HELPLINE_DISPLAY;

export const HELPLINE_EMAIL =
  process.env.NEXT_PUBLIC_HELPLINE_EMAIL || "hello@kavachsaathi.in";

export function waMeLink(text: string, phone = COMPANY_WHATSAPP): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function renewalWaMessage(serial: string, name: string): string {
  return `Namaste! I want to renew my KavachSaathi card.\n\nSerial / Health ID: ${serial}\nName: ${name}\n\nPlease guide me for renewal.`;
}

export function renewalWaLink(serial: string, name: string): string {
  return waMeLink(renewalWaMessage(serial, name));
}

export function lostCardFoundMessage(): string {
  return `This KavachSaathi card has been reported lost. If found, please contact ${HELPLINE_DISPLAY}.`;
}

export function orderWaWithRef(refCode?: string | null): string {
  const ref = refCode ? `\nReferral code: ${refCode}` : "";
  return waMeLink(
    `Namaste! I want to order KavachSaathi Smart Health Card.${ref}\n\nName: \nCity: \nPhone: `
  );
}

export function referralShareMessage(code: string, link: string): string {
  return `I use KavachSaathi — India's smart emergency health card. Get yours: ${link} (code ${code})`;
}

export function googleCalendarReminderUrl(opts: {
  title: string;
  details: string;
  startIso: string;
  endIso: string;
}): string {
  const fmt = (iso: string) =>
    iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
  const dates = `${fmt(opts.startIso)}/${fmt(opts.endIso)}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    details: opts.details,
    dates,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function buildIcs(opts: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  uid?: string;
}): string {
  const stamp = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = opts.uid || `kavach-${Date.now()}@kavachsaathi.in`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KavachSaathi//Renewal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.start)}`,
    `DTEND:${stamp(opts.end)}`,
    `SUMMARY:${opts.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

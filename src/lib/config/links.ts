/**
 * Public / company contact links (no secrets).
 * Defaults match production business settings; Firestore config/links can override at runtime (server).
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://kavachsaathi.in";

/** Digits only, with country code (WhatsApp / wa.me). */
export const COMPANY_WHATSAPP = String(
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919416106511"
).replace(/\D/g, "");

/** Primary display for WhatsApp / text contact */
export const HELPLINE_WHATSAPP_DISPLAY =
  process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY || "+91 94161 06511";

/** Call helpline (voice) */
export const HELPLINE_CALL_DISPLAY =
  process.env.NEXT_PUBLIC_HELPLINE_CALL || "+91 72730 00075";

export const HELPLINE_CALL_TEL = `tel:+${String(
  process.env.NEXT_PUBLIC_HELPLINE_CALL_DIGITS || "917273000075"
).replace(/\D/g, "")}`;

export const HELPLINE_WHATSAPP_TEL = `tel:+${COMPANY_WHATSAPP}`;

/** @deprecated use HELPLINE_WHATSAPP_DISPLAY — kept for older imports */
export const HELPLINE_DISPLAY = HELPLINE_WHATSAPP_DISPLAY;
export const HELP_LINE_DISPLAY = HELPLINE_WHATSAPP_DISPLAY;

export const HELPLINE_EMAIL =
  process.env.NEXT_PUBLIC_HELPLINE_EMAIL || "gdmtechnoworld@gmail.com";

/** Both numbers shown on renewal / lost-card contact sections */
export const CONTACT_PHONES: { label: string; display: string; tel: string }[] =
  [
    {
      label: "WhatsApp / SMS",
      display: HELPLINE_WHATSAPP_DISPLAY,
      tel: HELPLINE_WHATSAPP_TEL,
    },
    {
      label: "Call",
      display: HELPLINE_CALL_DISPLAY,
      tel: HELPLINE_CALL_TEL,
    },
  ];

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
  return `This KavachSaathi card has been reported lost. If found, please contact ${HELPLINE_WHATSAPP_DISPLAY} or ${HELPLINE_CALL_DISPLAY}.`;
}

export function orderWaWithRef(refCode?: string | null): string {
  const ref = refCode ? `\nReferral code: ${refCode}` : "";
  return waMeLink(
    `Namaste! I want to order KavachSaathi Smart Health Card.${ref}\n\nName: \nCity: \nPhone: `
  );
}

/** Hindi share copy for wa.me (F51) */
export function referralShareMessage(code: string): string {
  return `Main KavachSaathi Smart Health Card use karta/karti hu — emergency mein ek scan se meri medical info mil jaati hai. Mera referral code ${code} use karein: kavachsaathi.in`;
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

/** Profile field helpers — no external deps */

export const CRITICAL_ALERT_OPTIONS = [
  "blood thinner",
  "epilepsy",
  "pacemaker",
  "insulin-dependent",
  "other",
] as const;

export type CriticalAlertTag = (typeof CRITICAL_ALERT_OPTIONS)[number];

export type OrganDonorValue = "yes" | "no" | "unset";

export type CriticalAlerts = {
  tags: string[];
  otherText?: string;
};

/** ABHA: 14 digits, hyphens optional (e.g. 12-3456-7890-1234) */
export function normalizeAbhaId(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 14);
}

export function isValidAbhaId(raw: string): boolean {
  const d = normalizeAbhaId(raw);
  return d.length === 0 || d.length === 14;
}

export function formatAbhaId(raw: string): string {
  const d = normalizeAbhaId(raw);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10)}`;
}

export function parseOrganDonor(v: unknown): OrganDonorValue {
  const s = String(v ?? "unset").toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return "yes";
  if (s === "no" || s === "false" || s === "0") return "no";
  return "unset";
}

export function parseCriticalAlerts(raw: unknown): CriticalAlerts {
  if (!raw || typeof raw !== "object") {
    if (Array.isArray(raw)) {
      return { tags: raw.map(String).filter(Boolean) };
    }
    return { tags: [] };
  }
  const o = raw as { tags?: unknown; otherText?: unknown; other?: unknown };
  const tags = Array.isArray(o.tags)
    ? o.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const otherText = String(o.otherText || o.other || "").trim();
  const result: CriticalAlerts = { tags };
  if (otherText) result.otherText = otherText;
  return result;
}

export function criticalAlertsNonEmpty(c: CriticalAlerts): boolean {
  return c.tags.length > 0 || Boolean(c.otherText);
}

export function criticalAlertsDisplay(c: CriticalAlerts): string[] {
  const out = c.tags.filter((t) => t.toLowerCase() !== "other");
  if (c.tags.some((t) => t.toLowerCase() === "other") && c.otherText) {
    out.push(c.otherText);
  } else if (c.otherText && !out.includes(c.otherText)) {
    out.push(c.otherText);
  }
  return out;
}

/** Build wa.me link — default +91 for 10-digit Indian mobiles */
export function whatsappLink(phone: string): string | null {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

export function telLink(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits === "108") return "tel:108";
  if (digits.length === 10) return `tel:+91${digits}`;
  return `tel:+${digits}`;
}

export type CompletenessProfile = {
  full_name?: string;
  blood_group?: string;
  phone?: string;
  city?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  emergency_contacts?: unknown[];
  family_doctor?: { name?: string; phone?: string } | null;
  familyDoctorName?: string;
  familyDoctorPhone?: string;
  organDonor?: OrganDonorValue | string;
  preferredHospital?: string;
  criticalAlerts?: CriticalAlerts | unknown;
  abhaId?: string;
  fullAddress?: string;
  photo_url?: string | null;
};

type CompletenessItem = {
  key: string;
  weight: number;
  done: boolean;
  hint: string;
};

export function profileCompleteness(p: CompletenessProfile): {
  percent: number;
  hint: string | null;
} {
  const fdName =
    p.family_doctor?.name || p.familyDoctorName || "";
  const fdPhone =
    p.family_doctor?.phone || p.familyDoctorPhone || "";
  const alerts = parseCriticalAlerts(p.criticalAlerts);
  const organ = parseOrganDonor(p.organDonor);

  const items: CompletenessItem[] = [
    {
      key: "name",
      weight: 10,
      done: Boolean(p.full_name && String(p.full_name).trim().length >= 2),
      hint: "Add your full name",
    },
    {
      key: "blood",
      weight: 10,
      done: Boolean(p.blood_group && p.blood_group !== "—"),
      hint: "Add blood group",
    },
    {
      key: "city",
      weight: 10,
      done: Boolean(p.city && String(p.city).trim()),
      hint: "Add city to reach higher completeness",
    },
    {
      key: "phone",
      weight: 5,
      done: Boolean(p.phone && String(p.phone).replace(/\D/g, "").length >= 10),
      hint: "Add phone number",
    },
    {
      key: "contacts",
      weight: 15,
      done: Array.isArray(p.emergency_contacts) && p.emergency_contacts.length >= 1,
      hint: "Add an emergency contact",
    },
    {
      key: "allergies",
      weight: 10,
      done: Array.isArray(p.allergies) && p.allergies.length > 0,
      hint: "Add allergies to reach 90%",
    },
    {
      key: "conditions",
      weight: 8,
      done:
        Array.isArray(p.chronic_conditions) && p.chronic_conditions.length > 0,
      hint: "Add chronic conditions",
    },
    {
      key: "meds",
      weight: 8,
      done: Array.isArray(p.medications) && p.medications.length > 0,
      hint: "Add medications",
    },
    {
      key: "doctor",
      weight: 7,
      done: Boolean(String(fdName).trim() && String(fdPhone).trim()),
      hint: "Add family doctor details",
    },
    {
      key: "hospital",
      weight: 5,
      done: Boolean(p.preferredHospital && String(p.preferredHospital).trim()),
      hint: "Add preferred hospital",
    },
    {
      key: "organ",
      weight: 4,
      done: organ === "yes" || organ === "no",
      hint: "Set organ donor preference",
    },
    {
      key: "alerts",
      weight: 4,
      done: criticalAlertsNonEmpty(alerts),
      hint: "Add critical alerts if applicable",
    },
    {
      key: "address",
      weight: 2,
      done: Boolean(p.fullAddress && String(p.fullAddress).trim()),
      hint: "Add full address (private)",
    },
    {
      key: "abha",
      weight: 2,
      done: normalizeAbhaId(p.abhaId || "").length === 14,
      hint: "Add ABHA ID (optional)",
    },
  ];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const percent = Math.min(100, Math.round((earned / total) * 100));
  const next = items.find((i) => !i.done);
  return { percent, hint: percent >= 100 ? null : next?.hint || null };
}

/** Sections visible on the public emergency page (for consent log) */
export function publicSectionsForProfile(p: {
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  emergency_contacts?: unknown[];
  family_doctor?: unknown;
  familyDoctorName?: string;
  preferredHospital?: string;
  organDonor?: string;
  criticalAlerts?: unknown;
  city?: string;
}): string[] {
  const sections = ["basic"];
  if (criticalAlertsNonEmpty(parseCriticalAlerts(p.criticalAlerts))) {
    sections.push("critical");
  }
  if (
    (p.allergies && p.allergies.length) ||
    (p.chronic_conditions && p.chronic_conditions.length) ||
    (p.medications && p.medications.length) ||
    parseOrganDonor(p.organDonor) !== "unset"
  ) {
    sections.push("medical");
  }
  if (p.emergency_contacts && p.emergency_contacts.length) {
    sections.push("contacts");
  }
  if (p.family_doctor || p.familyDoctorName) {
    sections.push("doctor");
  }
  if (p.preferredHospital || p.city) {
    sections.push("location");
  }
  return sections;
}

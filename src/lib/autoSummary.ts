/**
 * F56 — Rule-based doctor auto summary (EN + HI). No AI; never invents fields.
 * Max ~300 characters. Empty fields skipped.
 */

export type AutoSummaryInput = {
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  criticalFlags?: string[];
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  emergencyContact?: { relation?: string; phone?: string; name?: string } | null;
  /** When true, omit age/sex (not shown on public emergency view). */
  publicOnly?: boolean;
};

const MAX_LEN = 300;

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

function sexLabel(gender: string | null | undefined, hi: boolean): string | null {
  const g = String(gender || "").trim().toLowerCase();
  if (!g) return null;
  if (g === "m" || g === "male" || g === "पुरुष") return hi ? "पुरुष" : "male";
  if (g === "f" || g === "female" || g === "महिला") return hi ? "महिला" : "female";
  if (g === "other" || g === "o") return hi ? "अन्य" : "other";
  return null;
}

function joinList(items: string[], max = 4): string {
  const clean = items.map((s) => String(s).trim()).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} +${clean.length - max}`;
}

function trimMax(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_LEN) return t;
  return `${t.slice(0, MAX_LEN - 1).trimEnd()}…`;
}

/** English clinical-style summary from structured fields only. */
export function buildAutoSummaryEn(input: AutoSummaryInput): string {
  const parts: string[] = [];
  if (!input.publicOnly) {
    const age = ageFromDob(input.dateOfBirth);
    const sex = sexLabel(input.gender, false);
    if (age != null && sex) parts.push(`${age}-year-old ${sex}`);
    else if (age != null) parts.push(`${age}-year-old`);
    else if (sex) parts.push(sex);
  }

  // Critical flags + blood group first (doctor-critical)
  const flags = (input.criticalFlags || []).map((s) => s.trim()).filter(Boolean);
  if (flags.length) parts.push(flags.join("; "));

  const bg = String(input.bloodGroup || "").trim();
  if (bg && bg !== "—") parts.push(`Blood group ${bg}`);

  const conds = joinList(input.conditions || [], 3);
  if (conds) parts.push(conds);

  const meds = joinList(input.medications || [], 4);
  if (meds) parts.push(`Medicines: ${meds}`);

  const all = joinList(input.allergies || [], 3);
  if (all) parts.push(`Allergy: ${all}`);

  // Public emergency view omits contact (shown in contacts section). Non-public may include name/relation only — never phone.
  if (!input.publicOnly) {
    const ec = input.emergencyContact;
    if (ec?.relation || ec?.name) {
      const who = [ec.relation, ec.name].filter(Boolean).join(", ") || "contact";
      parts.push(`Emergency contact: ${who}`);
    }
  }

  if (!parts.length) return "";
  // Join first clause with period; rest as sentences
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === 0) out = p.endsWith(".") ? p : `${p}.`;
    else out += ` ${p.endsWith(".") ? p : `${p}.`}`;
  }
  return trimMax(out);
}

/** Hindi clinical-style summary — same rules, Hindi labels only (data not translated). */
export function buildAutoSummaryHi(input: AutoSummaryInput): string {
  const parts: string[] = [];
  if (!input.publicOnly) {
    const age = ageFromDob(input.dateOfBirth);
    const sex = sexLabel(input.gender, true);
    if (age != null && sex) parts.push(`${age} वर्षीय ${sex}`);
    else if (age != null) parts.push(`${age} वर्ष`);
    else if (sex) parts.push(sex);
  }

  const flags = (input.criticalFlags || []).map((s) => s.trim()).filter(Boolean);
  if (flags.length) parts.push(flags.join("; "));

  const bg = String(input.bloodGroup || "").trim();
  if (bg && bg !== "—") parts.push(`रक्त समूह ${bg}`);

  const conds = joinList(input.conditions || [], 3);
  if (conds) parts.push(conds);

  const meds = joinList(input.medications || [], 4);
  if (meds) parts.push(`दवाएँ: ${meds}`);

  const all = joinList(input.allergies || [], 3);
  if (all) parts.push(`एलर्जी: ${all}`);

  if (!input.publicOnly) {
    const ec = input.emergencyContact;
    if (ec?.relation || ec?.name) {
      const who = [ec.relation, ec.name].filter(Boolean).join(", ") || "संपर्क";
      parts.push(`आपातकालीन संपर्क: ${who}`);
    }
  }

  if (!parts.length) return "";
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === 0) out = p.endsWith(".") ? p : `${p}.`;
    else out += ` ${p.endsWith(".") ? p : `${p}.`}`;
  }
  return trimMax(out);
}

export function buildAutoSummaryPair(input: AutoSummaryInput): {
  en: string;
  hi: string;
} {
  return {
    en: buildAutoSummaryEn(input),
    hi: buildAutoSummaryHi(input),
  };
}

/** Map public emergency profile fields into summary input (publicOnly). */
export function summaryFromPublicProfile(p: {
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  criticalFlagLabels?: string[];
  criticalAlertLabels?: string[];
  emergency_contacts?: { name?: string; phone?: string; relation?: string }[];
}): AutoSummaryInput {
  void p.emergency_contacts; // contacts live in their own section — never in public summary
  return {
    publicOnly: true,
    bloodGroup: p.blood_group,
    allergies: p.allergies,
    conditions: p.chronic_conditions,
    medications: p.medications,
    criticalFlags: p.criticalFlagLabels?.length
      ? p.criticalFlagLabels
      : p.criticalAlertLabels,
    emergencyContact: null,
  };
}

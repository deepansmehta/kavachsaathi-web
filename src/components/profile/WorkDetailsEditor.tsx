"use client";

import {
  WORK_TYPES,
  EMPLOYER_CONTACT_ROLES,
  type WorkDetailsEdit,
  type WorkDetailsVisibility,
  emptyWorkDetailsEdit,
} from "@/lib/workDetails";
import { GoldInput } from "@/components/ui";

type Props = {
  value: WorkDetailsEdit;
  onChange: (next: WorkDetailsEdit) => void;
  onClear?: () => void;
  /** Compact mode for activation (skip / add later) */
  compact?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  skipped?: boolean;
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-[#A8A59C]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#D4AF37]"
      />
    </label>
  );
}

export function WorkDetailsEditor({
  value,
  onChange,
  onClear,
  compact,
  showSkip,
  onSkip,
  skipped,
}: Props) {
  const set = <K extends keyof WorkDetailsEdit>(key: K, v: WorkDetailsEdit[K]) =>
    onChange({ ...value, [key]: v });

  const setVis = (key: keyof WorkDetailsVisibility, v: boolean) =>
    onChange({
      ...value,
      visibility: { ...value.visibility, [key]: v },
    });

  if (skipped) {
    return (
      <div className="space-y-2 rounded-xl border border-dashed border-[#D4AF3755] p-3">
        <p className="text-sm text-[#A8A59C]">
          Work details skipped — you can add them later in My Profile.
          <br />
          काम की जानकारी बाद में जोड़ सकते हैं।
        </p>
        {onSkip ? (
          <button
            type="button"
            className="text-sm text-[#D4AF37]"
            onClick={() => onSkip()}
          >
            Add work details / काम की जानकारी जोड़ें
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`space-y-3 rounded-xl border border-[#D4AF3755] p-3 ${
        compact ? "" : ""
      }`}
      data-testid="work-details-editor"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#D4AF37]">
            Work details / काम की जानकारी
          </p>
          <p className="mt-1 text-[11px] text-[#A8A59C]">
            Optional. Public card shows only fields you turn ON.
          </p>
        </div>
        {showSkip && onSkip ? (
          <button
            type="button"
            className="shrink-0 text-xs text-[#A8A59C] underline"
            onClick={onSkip}
          >
            Add later / बाद में
          </button>
        ) : null}
        {onClear ? (
          <button
            type="button"
            className="shrink-0 text-xs text-red-400"
            onClick={onClear}
          >
            Remove
          </button>
        ) : null}
      </div>

      <select
        className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
        value={value.workType}
        onChange={(e) => set("workType", e.target.value as WorkDetailsEdit["workType"])}
        aria-label="Work type"
      >
        <option value="">Work type / प्रकार</option>
        {WORK_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <GoldInput
        label="Organisation / संगठन"
        value={value.organisationName}
        onChange={(e) => set("organisationName", e.target.value)}
      />
      <Toggle
        label="Show organisation on public card"
        checked={value.visibility.organisationName}
        onChange={(v) => setVis("organisationName", v)}
      />

      <GoldInput
        label="Work city / शहर"
        value={value.city}
        onChange={(e) => set("city", e.target.value)}
      />
      <Toggle
        label="Show city on public card"
        checked={value.visibility.city}
        onChange={(v) => setVis("city", v)}
      />

      <GoldInput
        label="Designation / पद"
        value={value.designation}
        onChange={(e) => set("designation", e.target.value)}
      />
      <Toggle
        label="Show designation on public card (default OFF)"
        checked={value.visibility.designation}
        onChange={(v) => setVis("designation", v)}
      />

      <p className="pt-1 text-xs font-semibold text-[#D4AF37]">
        Employer contact / नियोक्ता संपर्क
      </p>
      <GoldInput
        label="Contact name"
        value={value.employerContactName}
        onChange={(e) => set("employerContactName", e.target.value)}
      />
      <GoldInput
        label="Phone (+91)"
        value={value.employerContactPhone}
        onChange={(e) =>
          set(
            "employerContactPhone",
            e.target.value.replace(/\D/g, "").slice(0, 10)
          )
        }
        inputMode="numeric"
      />
      <select
        className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
        value={value.employerContactRole}
        onChange={(e) =>
          set(
            "employerContactRole",
            e.target.value as WorkDetailsEdit["employerContactRole"]
          )
        }
        aria-label="Employer contact role"
      >
        <option value="">Role</option>
        {EMPLOYER_CONTACT_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Toggle
        label="Show employer contact on public card"
        checked={value.visibility.employerContact}
        onChange={(v) => setVis("employerContact", v)}
      />
      <label className="flex gap-2 text-xs text-[#A8A59C]">
        <input
          type="checkbox"
          checked={value.employerContactConsent}
          onChange={(e) => set("employerContactConsent", e.target.checked)}
          data-testid="employer-contact-consent"
        />
        <span>
          I confirm this employer contact has agreed to be listed / नियोक्ता ने
          सहमति दी है
        </span>
      </label>

      <p className="pt-1 text-xs font-semibold text-[#D4AF37]">
        PIN-only (never on public card)
      </p>
      <GoldInput
        label="Employee ID"
        value={value.employeeId}
        onChange={(e) => set("employeeId", e.target.value)}
      />
      <GoldInput
        label="ESIC number"
        value={value.esicNumber}
        onChange={(e) => set("esicNumber", e.target.value)}
      />
      <GoldInput
        label="Company insurer"
        value={value.companyInsurer}
        onChange={(e) => set("companyInsurer", e.target.value)}
      />
      <GoldInput
        label="Company policy no."
        value={value.companyPolicyNo}
        onChange={(e) => set("companyPolicyNo", e.target.value)}
      />
    </div>
  );
}

export { emptyWorkDetailsEdit };

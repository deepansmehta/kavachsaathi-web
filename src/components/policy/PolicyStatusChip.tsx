import type { PolicyStatus } from "@/lib/policy/status";

const LABELS: Record<PolicyStatus, { en: string; hi: string }> = {
  active: { en: "Active", hi: "सक्रिय" },
  expiring_soon: { en: "Expiring soon", hi: "जल्द समाप्त" },
  expired: { en: "Expired", hi: "समाप्त" },
};

const CLASSES: Record<PolicyStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  expiring_soon: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  expired: "border-red-500/40 bg-red-500/15 text-red-300",
};

/** Active / Expiring soon / Expired status chip — EN + HI label. */
export function PolicyStatusChip({
  status,
  className,
}: {
  status: PolicyStatus;
  className?: string;
}) {
  const label = LABELS[status] || LABELS.active;
  const cls = CLASSES[status] || CLASSES.active;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls} ${className || ""}`}
      data-testid="policy-status-chip"
      data-status={status}
    >
      {label.en} / {label.hi}
    </span>
  );
}

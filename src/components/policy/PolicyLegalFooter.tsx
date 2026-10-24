import { POLICY_LEGAL_FOOTER, POLICY_LEGAL_FOOTER_HI } from "@/lib/policy/constants";

/**
 * Small muted legal footer — required on every Policy Saathi screen.
 * EN + HI, never omitted when policy UI is shown.
 */
export function PolicyLegalFooter({ className }: { className?: string }) {
  return (
    <p
      className={`text-[11px] leading-relaxed text-[var(--text-soft)] ${className || ""}`}
      data-testid="policy-legal-footer"
    >
      {POLICY_LEGAL_FOOTER}
      <br />
      {POLICY_LEGAL_FOOTER_HI}
    </p>
  );
}

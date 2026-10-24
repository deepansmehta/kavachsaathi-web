/**
 * Optional activation-wizard step — introduces Policy Wallet and lets the new
 * cardholder choose to add a policy right after activation (in My Profile,
 * where the Policy Wallet APIs run under their logged-in session) or skip for
 * now. Never blocks activation; both actions proceed to submit.
 */
export function PolicyActivationStep({
  onAddNow,
  onSkip,
  busy,
}: {
  onAddNow: () => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="policy-activation-step">
      <p className="text-sm text-[#A8A59C]">
        Add your insurance policy to KavachSaathi&apos;s Policy Wallet — track
        renewals, nominee details, and claim helplines in one place. This is
        optional and can be done anytime from My Profile.
        <br />
        अपनी बीमा पॉलिसी कवचसाथी के पॉलिसी वॉलेट में जोड़ें — नवीनीकरण, नॉमिनी
        और दावा हेल्पलाइन एक जगह रखें। यह वैकल्पिक है, बाद में भी जोड़ सकते हैं।
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="flex-1 rounded-lg border border-[#333] px-4 py-3 text-sm font-semibold text-[#A8A59C]"
          data-testid="policy-activation-skip"
        >
          Skip for now / अभी छोड़ें
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAddNow}
          className="flex-1 rounded-lg bg-gradient-to-br from-[#FCE49A] to-[#B8860B] px-4 py-3 text-sm font-bold text-black"
          data-testid="policy-activation-add-now"
        >
          {busy ? "Activating…" : "Add policy now / अभी जोड़ें"}
        </button>
      </div>
    </div>
  );
}

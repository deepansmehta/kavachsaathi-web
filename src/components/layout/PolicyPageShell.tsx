import Link from "next/link";

const IS_PROD = process.env.NODE_ENV === "production";

export function PolicyPageShell({
  title,
  hindiSummary,
  updated = "14 October 2026",
  children,
}: {
  title: string;
  hindiSummary?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-cream">
      {!IS_PROD && (
        <p className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
          DRAFT — legal review pending
        </p>
      )}

      {hindiSummary ? (
        <p className="mb-6 rounded-xl border border-[#D4AF37]/30 bg-[#141410] p-4 text-sm leading-relaxed text-[#FCE49A]">
          <strong>हिंदी सारांश:</strong> {hindiSummary}
        </p>
      ) : null}

      <h1 className="font-rajdhani text-3xl font-bold text-[#D4AF37]">{title}</h1>
      <p className="mt-2 text-sm text-[#A8A59C]">Last updated: {updated}</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-[#F0EEE8]">
        {children}
      </section>

      <p className="mt-10 text-sm text-[#A8A59C]">
        Related:{" "}
        <Link href="/terms" className="text-[#D4AF37] underline">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="text-[#D4AF37] underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/refund-policy" className="text-[#D4AF37] underline">
          Refunds
        </Link>
        {" · "}
        <Link href="/shipping-policy" className="text-[#D4AF37] underline">
          Shipping
        </Link>
        {" · "}
        <Link href="/contact" className="text-[#D4AF37] underline">
          Contact
        </Link>
      </p>
    </main>
  );
}

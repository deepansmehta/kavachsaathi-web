import Link from "next/link";
import {
  CARD_PRICE,
  COMPANY,
  DELIVERY,
  GST_NOTE,
  LAUNCH_PACKS,
  WHAT_IS_INCLUDED,
  formatInr,
} from "@/lib/pricing";
import { GoldButton } from "@/components/ui/GoldButton";

export const metadata = {
  title: "Pricing",
  description:
    "KavachSaathi smart health card pricing — single card ₹599, family packs, lifetime free emergency access. GST inclusive. Free India delivery.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  const single = LAUNCH_PACKS[0];
  const combos = LAUNCH_PACKS.slice(1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          Pricing
        </p>
        <h1 className="mt-2 font-rajdhani text-4xl font-bold text-cream sm:text-5xl">
          Simple packs. Lifetime access.
        </h1>
        <p className="mt-4 font-body text-sm text-cream-soft sm:text-base">
          One-time card price. Emergency digital access is lifetime free — no
          yearly renewal fee.
        </p>
      </div>

      <section className="mx-auto mt-12 max-w-md">
        <article className="rounded-card border-2 border-gold/50 bg-kavach-s1 p-8 text-center shadow-gold-sm">
          <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            Single card
          </p>
          <p className="mt-4 font-mono text-5xl font-bold text-gold">
            {formatInr(CARD_PRICE)}
          </p>
          <p className="mt-2 font-body text-sm text-cream-soft">
            {single.cards} · lifetime free emergency access
          </p>
          <p className="mt-4 font-body text-sm text-emerald-300">
            No renewal fee — pay once, keep access for life
          </p>
          <div className="mt-8">
            <Link href="/order">
              <GoldButton size="lg" className="w-full sm:w-auto">
                Buy now
              </GoldButton>
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-16">
        <h2 className="text-center font-rajdhani text-2xl font-bold text-cream sm:text-3xl">
          Family &amp; combo packs
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center font-body text-sm text-cream-soft">
          Save when you protect more than one person.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {combos.map((pack) => (
            <article
              key={pack.id}
              className={`relative rounded-card border bg-kavach-s1/90 p-5 ${
                pack.best
                  ? "border-gold/60 shadow-gold-sm"
                  : "border-gold/25"
              }`}
            >
              {pack.best ? (
                <span className="absolute -top-2.5 right-3 rounded-full bg-gold px-2 py-0.5 font-rajdhani text-[10px] font-bold uppercase tracking-wider text-kavach-black">
                  Best value
                </span>
              ) : null}
              <h3 className="font-rajdhani text-lg font-bold text-cream">
                {pack.label}
              </h3>
              <p className="mt-1 font-body text-xs text-cream-soft">{pack.cards}</p>
              <p className="mt-4 font-mono text-3xl font-bold text-gold">
                {formatInr(pack.price)}
              </p>
              {pack.save > 0 ? (
                <p className="mt-1 font-body text-xs text-gold/80">
                  Save {formatInr(pack.save)} vs singles
                </p>
              ) : null}
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/order">
            <GoldButton size="lg">Buy now — choose a pack</GoldButton>
          </Link>
        </div>
      </section>

      <section className="mt-16 rounded-card border border-gold/20 bg-kavach-s1/60 p-6 sm:p-8">
        <h2 className="font-rajdhani text-2xl font-bold text-cream">
          What&apos;s included
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 font-body text-sm text-cream-soft">
          {WHAT_IS_INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-gold/20 bg-kavach-s1/40 p-6">
          <h2 className="font-rajdhani text-xl font-bold text-gold">GST</h2>
          <p className="mt-3 font-body text-sm leading-relaxed text-cream-soft">
            {GST_NOTE}
          </p>
        </div>
        <div className="rounded-card border border-gold/20 bg-kavach-s1/40 p-6">
          <h2 className="font-rajdhani text-xl font-bold text-gold">
            Delivery charges
          </h2>
          <p className="mt-3 font-body text-sm leading-relaxed text-cream-soft">
            <span className="font-semibold text-cream">{DELIVERY.label}</span>
            {DELIVERY.chargeInr === 0 ? " (₹0)." : ` (${formatInr(DELIVERY.chargeInr)}).`}{" "}
            {DELIVERY.eta}. {DELIVERY.note}
          </p>
        </div>
      </section>

      <p className="mt-12 text-center font-body text-xs text-cream-soft">
        Sold by {COMPANY.legalName}. Questions?{" "}
        <Link href="/contact" className="text-gold underline">
          Contact us
        </Link>
        .
      </p>
    </main>
  );
}

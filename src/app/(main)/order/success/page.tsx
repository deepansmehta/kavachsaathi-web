"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Package, QrCode, Shield } from "lucide-react";
import { ECGBackground, LoadingSpinner } from "@/components/ui";
import { formatInr } from "@/lib/pricing";

function SuccessContent() {
  const sp = useSearchParams();
  const orderNo = sp.get("orderNo") || "";
  const amountRaw = Number(sp.get("amount") || 0);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-lg text-center"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="font-rajdhani text-3xl font-bold text-cream sm:text-4xl">
        Payment successful
      </h1>
      <p className="mt-3 font-body text-sm text-cream-soft sm:text-base">
        Thank you for ordering KavachSaathi. Your payment is confirmed.
      </p>

      <div className="mt-8 rounded-card border border-gold/30 bg-kavach-s1/95 p-6 text-left shadow-gold-sm">
        <div className="mb-4 flex items-center gap-2 text-gold">
          <Shield className="h-5 w-5" />
          <span className="font-rajdhani text-lg font-semibold">
            Order confirmation
          </span>
        </div>
        {orderNo ? (
          <p className="font-body text-sm text-cream">
            Order number{" "}
            <span className="font-mono font-bold text-gold">{orderNo}</span>
          </p>
        ) : null}
        {amount != null ? (
          <p className="mt-1 font-body text-sm text-cream">
            Amount paid{" "}
            <span className="font-mono font-bold text-gold">
              {formatInr(amount)}
            </span>
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-gold/20 bg-kavach-black/40 p-4">
          <p className="mb-2 flex items-center gap-2 font-rajdhani text-sm font-semibold text-gold">
            <Package className="h-4 w-4" />
            What happens next
          </p>
          <p className="text-sm leading-relaxed text-cream-soft">
            Your KavachSaathi card will be shipped to your address. Once you
            receive it, scan the QR and activate it with your activation code.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs text-cream-soft">
            <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span>
              No card is auto-activated after payment — activate only after
              delivery (pay first, then activate).
            </span>
          </p>
        </div>

        <p className="mt-4 text-xs text-cream-soft">
          FREE delivery across India. Helpline{" "}
          <a className="text-gold underline" href="tel:+917273000075">
            +91 72730 00075
          </a>
          .
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-input px-8 py-4 font-rajdhani text-lg font-semibold tracking-wide text-kavach-black gold-gradient shadow-gold-sm"
        >
          Back to home
        </Link>
        <Link
          href="/activate"
          className="text-sm text-gold underline underline-offset-4"
        >
          How activation works
        </Link>
      </div>
    </motion.div>
  );
}

export default function OrderSuccessPage() {
  return (
    <div className="relative min-h-[70vh] overflow-hidden px-4 py-14 sm:py-20">
      <ECGBackground />
      <Suspense fallback={<LoadingSpinner className="py-20" />}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}

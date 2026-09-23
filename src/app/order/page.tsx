"use client";

import { Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Shield, Check, RefreshCw } from "lucide-react";
import {
  GoldButton,
  OutlineButton,
  ECGBackground,
  LoadingSpinner,
} from "@/components/ui";
import { CARD_MRP, CARD_PRICE, RENEWAL_PRICE } from "@/lib/pricing";

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919416106511";

function OrderContent() {
  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Namaste! I want to order KavachSaathi Smart Health Card.\n\nMRP: ₹${CARD_MRP}\nOffer price: ₹${CARD_PRICE}\nValidity: 1 year (renew ₹${RENEWAL_PRICE}/year)\n\nName: \nCity: \nPhone: `
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-lg"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold-glow">
          <Shield className="h-7 w-7 text-kavach-black" />
        </div>
        <h1 className="font-rajdhani text-4xl font-bold text-cream sm:text-5xl">
          Order KavachSaathi
        </h1>
        <p className="mt-3 font-body text-sm text-cream-soft sm:text-base">
          One smart PVC emergency health card. Order on WhatsApp — we confirm
          shipping with you.
        </p>
      </div>

      <div className="mb-6 rounded-card border border-gold bg-kavach-s1/95 p-6 shadow-gold-sm sm:p-8">
        <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Smart Health Card
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-4xl font-bold text-gold">
            ₹{CARD_PRICE}
          </span>
          <span className="font-mono text-lg text-cream-soft line-through decoration-danger/80">
            ₹{CARD_MRP}
          </span>
          <span className="rounded-badge border border-gold-border bg-gold-faint px-2.5 py-0.5 font-rajdhani text-xs font-bold uppercase tracking-wider text-gold">
            Limited offer
          </span>
        </div>
        <p className="mt-2 font-body text-sm text-cream-soft">
          MRP ₹{CARD_MRP} · You save ₹{CARD_MRP - CARD_PRICE}
        </p>

        <ul className="mt-6 space-y-2.5">
          {[
            "PVC smart emergency health card (same look for all)",
            "Box sticker: unique QR + 4-digit activation code",
            "Stick the QR on your card → activate online",
            "1 year validity included",
            `Renew anytime for ₹${RENEWAL_PRICE} / year`,
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 font-body text-sm text-cream"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-start gap-3 rounded-card border border-kavach-border bg-kavach-s2/60 p-4">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="font-rajdhani text-sm font-bold text-cream">
              After 1 year
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-cream-soft">
              Pay ₹{RENEWAL_PRICE} to renew — your card stays active for another
              full year.
            </p>
          </div>
        </div>

        <GoldButton
          fullWidth
          size="lg"
          className="mt-6"
          onClick={openWhatsApp}
        >
          <MessageCircle className="h-5 w-5" />
          Order for ₹{CARD_PRICE} on WhatsApp
        </GoldButton>
        <p className="mt-4 text-center font-mono text-xs text-cream-soft">
          +{WHATSAPP_NUMBER.replace(/^91/, "91 ")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/activate" className="flex-1">
          <OutlineButton fullWidth>Already have a card? Activate</OutlineButton>
        </Link>
        <Link href="/" className="flex-1">
          <OutlineButton fullWidth>Back home</OutlineButton>
        </Link>
      </div>
    </motion.div>
  );
}

export default function OrderPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-25" />
      <div className="relative z-10 mx-auto flex max-w-lg flex-col justify-center px-4 py-14 sm:py-20">
        <Suspense fallback={<LoadingSpinner className="py-20" />}>
          <OrderContent />
        </Suspense>
      </div>
    </div>
  );
}

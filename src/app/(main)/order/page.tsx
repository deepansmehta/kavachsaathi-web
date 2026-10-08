"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { ECGBackground, LoadingSpinner } from "@/components/ui";
import { PackOrderForm } from "@/components/order/PackOrderForm";

function OrderContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold-glow">
          <Shield className="h-7 w-7 text-kavach-black" />
        </div>
        <h1 className="font-rajdhani text-4xl font-bold text-cream sm:text-5xl">
          Order KavachSaathi
        </h1>
        <p className="mt-3 font-body text-sm text-cream-soft sm:text-base">
          Choose a pack · launch price from ₹499 · we call to confirm payment
          and delivery. / पैक चुनें — हम कॉल करके कन्फर्म करेंगे।
        </p>
      </div>
      <div className="rounded-card border border-gold/30 bg-kavach-s1/95 p-5 shadow-gold-sm sm:p-8">
        <PackOrderForm source="order_page" />
      </div>
    </motion.div>
  );
}

export default function OrderPage() {
  return (
    <div className="relative min-h-[70vh] overflow-hidden px-4 py-14 sm:py-20">
      <ECGBackground />
      <Suspense fallback={<LoadingSpinner className="py-20" />}>
        <OrderContent />
      </Suspense>
    </div>
  );
}

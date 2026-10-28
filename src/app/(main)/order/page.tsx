"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { ECGBackground, LoadingSpinner } from "@/components/ui";
import { PackOrderForm } from "@/components/order/PackOrderForm";

function OrderContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-5xl"
    >
      <div className="rounded-card border border-gold/30 bg-kavach-s1/95 p-4 shadow-gold-sm sm:p-8">
        <PackOrderForm source="order_page" />
      </div>
    </motion.div>
  );
}

export default function OrderPage() {
  return (
    <div className="relative min-h-[70vh] overflow-hidden px-4 py-10 sm:py-16">
      <ECGBackground />
      <Suspense fallback={<LoadingSpinner className="py-20" />}>
        <OrderContent />
      </Suspense>
    </div>
  );
}

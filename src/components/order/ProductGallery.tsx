"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const GALLERY = [
  {
    id: "front",
    label: "Front",
    src: "/images/product/card-front.jpg",
    alt: "KavachSaathi Smart QR Emergency Health Card — front",
  },
  {
    id: "back",
    label: "Back",
    src: "/images/product/card-back.jpg",
    alt: "KavachSaathi Smart QR Emergency Health Card — back",
  },
  {
    id: "features",
    label: "Detail",
    src: "/images/product/card-features.jpg",
    alt: "KavachSaathi card detail view",
  },
] as const;

export function ProductGallery() {
  const [active, setActive] = useState(0);
  const current = GALLERY[active];

  return (
    <div className="space-y-3">
      <motion.div
        className="relative aspect-square overflow-hidden rounded-2xl border border-gold/25 bg-[#0c0c0a] shadow-gold-sm"
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            className="absolute inset-0 p-2 sm:p-3"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-contain object-center"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="flex gap-2" role="tablist" aria-label="Product images">
        {GALLERY.map((g, i) => {
          const selected = i === active;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 overflow-hidden rounded-lg border transition sm:h-20 sm:w-20 ${
                selected
                  ? "border-gold ring-1 ring-gold/50"
                  : "border-gold/25 opacity-80 hover:opacity-100"
              }`}
            >
              <Image
                src={g.src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
              <span className="sr-only">{g.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

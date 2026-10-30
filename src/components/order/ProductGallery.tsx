"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const GALLERY = [
  {
    id: "front",
    label: "Front",
    src: "/images/product/card-front.webp",
    alt: "KavachSaathi Smart QR Emergency Health Card — front",
    w: 2658,
    h: 1707,
  },
  {
    id: "back",
    label: "Back",
    src: "/images/product/card-back.webp",
    alt: "KavachSaathi Smart QR Emergency Health Card — back",
    w: 2658,
    h: 1770,
  },
  {
    id: "features",
    label: "Detail",
    src: "/images/product/card-features.webp",
    alt: "KavachSaathi card detail view",
    w: 3000,
    h: 3000,
  },
] as const;

export function ProductGallery() {
  const [active, setActive] = useState(0);
  const current = GALLERY[active];

  return (
    <div className="space-y-4">
      <div className="relative mx-auto max-w-xl" style={{ perspective: "1400px" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[58%] h-[28%] w-[78%] -translate-x-1/2 rounded-[100%] bg-black/50 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[48%] h-[20%] w-[60%] -translate-x-1/2 rounded-[100%] bg-gold/20 blur-xl"
        />

        <motion.div
          className="relative w-full"
          style={{
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          initial={{ rotateX: 4, rotateY: -7 }}
          animate={{
            rotateX: [4, 3, 4],
            rotateY: [-7, -4, -7],
            y: [0, -4, 0],
          }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ rotateY: 5, scale: 1.015 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ transform: "translateZ(0)" }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                width={current.w}
                height={current.h}
                priority
                unoptimized
                sizes="(max-width: 768px) 96vw, 960px"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div
        className="flex justify-center gap-2"
        role="tablist"
        aria-label="Product images"
      >
        {GALLERY.map((g, i) => {
          const selected = i === active;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`relative h-14 w-20 overflow-hidden rounded-lg border bg-transparent transition ${
                selected
                  ? "border-gold ring-1 ring-gold/50"
                  : "border-gold/25 opacity-80 hover:opacity-100"
              }`}
            >
              <Image
                src={g.src}
                alt=""
                fill
                unoptimized
                sizes="160px"
                className="object-contain p-1"
              />
              <span className="sr-only">{g.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

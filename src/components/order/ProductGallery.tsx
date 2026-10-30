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
    w: 1332,
    h: 854,
  },
  {
    id: "back",
    label: "Back",
    src: "/images/product/card-back.webp",
    alt: "KavachSaathi Smart QR Emergency Health Card — back",
    w: 1332,
    h: 886,
  },
  {
    id: "features",
    label: "Detail",
    src: "/images/product/card-features.webp",
    alt: "KavachSaathi card detail view",
    w: 1400,
    h: 933,
  },
] as const;

export function ProductGallery() {
  const [active, setActive] = useState(0);
  const current = GALLERY[active];

  return (
    <div className="space-y-4">
      <div style={{ perspective: "1200px" }} className="mx-auto max-w-lg">
        <motion.div
          className="relative w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateX: 6, rotateY: -10 }}
          animate={{
            rotateX: [6, 4, 6],
            rotateY: [-10, -6, -10],
            y: [0, -6, 0],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ rotateY: 8, scale: 1.025 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                filter:
                  "drop-shadow(0 22px 36px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(212,175,55,0.25))",
              }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                width={current.w}
                height={current.h}
                priority
                quality={100}
                sizes="(max-width: 768px) 94vw, 480px"
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
                quality={90}
                sizes="80px"
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

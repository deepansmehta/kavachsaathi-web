"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const GALLERY = [
  {
    id: "front",
    label: "Front",
    src: "/images/product/card-front.png",
    alt: "KavachSaathi Smart QR Emergency Health Card — front",
    w: 1317,
    h: 836,
  },
  {
    id: "back",
    label: "Back",
    src: "/images/product/card-back.png",
    alt: "KavachSaathi Smart QR Emergency Health Card — back",
    w: 1316,
    h: 868,
  },
  {
    id: "features",
    label: "Detail",
    src: "/images/product/card-features.png",
    alt: "KavachSaathi card detail view",
    w: 1200,
    h: 800,
  },
] as const;

export function ProductGallery() {
  const [active, setActive] = useState(0);
  const current = GALLERY[active];

  return (
    <div className="space-y-4">
      <div style={{ perspective: "1100px" }} className="mx-auto max-w-md">
        <motion.div
          className="relative w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateX: 6, rotateY: -10 }}
          animate={{ rotateX: [6, 4, 6], rotateY: [-10, -6, -10], y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ rotateY: 8, scale: 1.02 }}
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
                  "drop-shadow(0 18px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 20px rgba(212,175,55,0.2))",
              }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                width={current.w}
                height={current.h}
                priority
                sizes="(max-width: 768px) 90vw, 420px"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="flex justify-center gap-2" role="tablist" aria-label="Product images">
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

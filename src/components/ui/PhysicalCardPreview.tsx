"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  healthId?: string;
  bloodGroup?: string;
  className?: string;
  interactive?: boolean;
};

const SIDES = {
  front: {
    src: "/images/product/card-front.webp",
    w: 2658,
    h: 1707,
    alt: "KavachSaathi card — front",
  },
  back: {
    src: "/images/product/card-back.webp",
    w: 2658,
    h: 1770,
    alt: "KavachSaathi card — back",
  },
} as const;

/**
 * HD PVC cutout — served unoptimized (no Next recompress) so text stays razor-clear.
 */
export function PhysicalCardPreview({
  name,
  healthId,
  bloodGroup,
  className,
  interactive = true,
}: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const current = SIDES[side];

  return (
    <div className={cn("mx-auto w-full max-w-[460px]", className)}>
      <div className="relative" style={{ perspective: "1400px" }}>
        {/* Soft ground glow — no CSS filter on the card bitmap (filters blur text) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[58%] h-[28%] w-[78%] -translate-x-1/2 rounded-[100%] bg-black/55 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[48%] h-[22%] w-[62%] -translate-x-1/2 rounded-[100%] bg-gold/25 blur-xl"
        />

        <motion.button
          type="button"
          className="relative mx-auto block w-full cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          style={{
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          initial={{ rotateX: 5, rotateY: -8 }}
          animate={{
            rotateX: [5, 3.5, 5],
            rotateY: [-8, -5, -8],
            y: [0, -5, 0],
          }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{
            rotateX: 2,
            rotateY: 5,
            scale: 1.02,
            transition: { duration: 0.3 },
          }}
          onClick={() =>
            interactive && setSide((s) => (s === "front" ? "back" : "front"))
          }
          aria-label={
            interactive
              ? `KavachSaathi card ${side}. Click to flip.`
              : "KavachSaathi card"
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={side}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative w-full"
              style={{
                transform: "translateZ(0)",
                WebkitTransform: "translateZ(0)",
              }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                width={current.w}
                height={current.h}
                priority
                unoptimized
                sizes="(max-width: 640px) 96vw, 920px"
                className="h-auto w-full select-none"
                style={{
                  imageRendering: "auto",
                  // Keep crisp when GPU-composited
                  transform: "translateZ(0)",
                }}
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {(name || healthId || bloodGroup) && (
        <div className="mt-4 space-y-1 text-center">
          {name ? (
            <p className="truncate font-rajdhani text-base font-bold text-cream">
              {name}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {healthId ? (
              <span className="font-mono text-xs text-gold">{healthId}</span>
            ) : null}
            {bloodGroup ? (
              <span className="rounded bg-danger/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {bloodGroup}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {interactive ? (
        <div className="mt-3 flex justify-center gap-2">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "rounded-full px-3 py-1 font-rajdhani text-[11px] font-semibold uppercase tracking-wider",
                side === s
                  ? "bg-gold text-kavach-black"
                  : "border border-gold/30 text-cream-soft"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-center font-body text-[11px] text-cream-soft">
        Lifetime free · Tap card to flip
      </p>
    </div>
  );
}

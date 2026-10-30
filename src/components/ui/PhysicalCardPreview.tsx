"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  /** Shown under the photo — not overlaid on the PVC print */
  name?: string;
  healthId?: string;
  bloodGroup?: string;
  className?: string;
  interactive?: boolean;
};

/**
 * Real marketplace PVC photos (1500×1500 square).
 * object-contain keeps the full card centered — no crop / skew.
 */
export function PhysicalCardPreview({
  name,
  healthId,
  bloodGroup,
  className,
  interactive = true,
}: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const src =
    side === "front"
      ? "/images/product/card-front.jpg"
      : "/images/product/card-back.jpg";

  return (
    <div className={cn("mx-auto w-full max-w-[320px] sm:max-w-[360px]", className)}>
      <motion.button
        type="button"
        className="relative mx-auto block aspect-square w-full overflow-hidden rounded-2xl border border-gold/30 bg-[#0c0c0a] shadow-gold-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        whileHover={interactive ? { scale: 1.01 } : undefined}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
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
            className="absolute inset-0 flex items-center justify-center p-2 sm:p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Image
              src={src}
              alt={
                side === "front"
                  ? "KavachSaathi card — front"
                  : "KavachSaathi card — back"
              }
              fill
              priority
              sizes="(max-width: 640px) 320px, 360px"
              className="object-contain object-center"
            />
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {(name || healthId || bloodGroup) && (
        <div className="mt-3 space-y-1 text-center">
          {name ? (
            <p className="font-rajdhani text-base font-bold text-cream truncate">
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

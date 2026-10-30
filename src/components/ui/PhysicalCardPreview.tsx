"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  /** Optional overlay labels (dashboard personalization) */
  name?: string;
  healthId?: string;
  bloodGroup?: string;
  className?: string;
  /** Allow flip between front / back */
  interactive?: boolean;
};

/**
 * Real PVC product photos (front / back) — used on dashboard & my-card.
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
    <div className={cn("mx-auto w-full max-w-[360px]", className)}>
      <motion.button
        type="button"
        className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-gold/35 bg-kavach-black shadow-gold-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        whileHover={interactive ? { scale: 1.015 } : undefined}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
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
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
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
              sizes="360px"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {side === "front" && (name || healthId || bloodGroup) ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-kavach-black/85 via-kavach-black/40 to-transparent px-4 pb-3 pt-10 text-left">
            {name ? (
              <p className="font-rajdhani text-sm font-bold text-cream truncate">
                {name}
              </p>
            ) : null}
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {healthId ? (
                <span className="font-mono text-[10px] text-gold">{healthId}</span>
              ) : null}
              {bloodGroup ? (
                <span className="rounded bg-danger/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {bloodGroup}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </motion.button>

      {interactive ? (
        <div className="mt-2 flex justify-center gap-2">
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
        Lifetime free emergency access · Tap to flip
      </p>
    </div>
  );
}

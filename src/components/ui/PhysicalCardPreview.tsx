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

/**
 * Real PVC card cutout (transparent PNG) — no white studio box.
 * Soft 3D tilt / float for depth.
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
      ? "/images/product/card-front.png"
      : "/images/product/card-back.png";

  return (
    <div className={cn("mx-auto w-full max-w-[380px]", className)}>
      <div style={{ perspective: "1100px" }}>
        <motion.button
          type="button"
          className="relative mx-auto block w-full cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateX: 8, rotateY: -12 }}
          animate={{
            rotateX: [8, 6, 8],
            rotateY: [-12, -8, -12],
            y: [0, -8, 0],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{
            rotateX: 4,
            rotateY: 6,
            scale: 1.03,
            transition: { duration: 0.35 },
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
              initial={{ opacity: 0, rotateY: side === "back" ? -25 : 25 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="relative w-full"
              style={{
                filter:
                  "drop-shadow(0 18px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(212,175,55,0.22))",
              }}
            >
              <Image
                src={src}
                alt={
                  side === "front"
                    ? "KavachSaathi card — front"
                    : "KavachSaathi card — back"
                }
                width={1317}
                height={836}
                priority
                sizes="(max-width: 640px) 90vw, 380px"
                className="h-auto w-full select-none"
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

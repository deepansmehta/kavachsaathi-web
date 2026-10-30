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
    w: 1332,
    h: 854,
    alt: "KavachSaathi card — front",
  },
  back: {
    src: "/images/product/card-back.webp",
    w: 1332,
    h: 886,
    alt: "KavachSaathi card — back",
  },
} as const;

/**
 * Crystal-clear PVC cutout (HQ WebP, no white box) + soft 3D float.
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
    <div className={cn("mx-auto w-full max-w-[420px]", className)}>
      <div style={{ perspective: "1200px" }}>
        <motion.button
          type="button"
          className="relative mx-auto block w-full cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateX: 7, rotateY: -11 }}
          animate={{
            rotateX: [7, 5, 7],
            rotateY: [-11, -7, -11],
            y: [0, -8, 0],
          }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{
            rotateX: 3,
            rotateY: 7,
            scale: 1.035,
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
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.28 }}
              className="relative w-full"
              style={{
                filter:
                  "drop-shadow(0 22px 36px rgba(0,0,0,0.6)) drop-shadow(0 0 28px rgba(212,175,55,0.28))",
              }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                width={current.w}
                height={current.h}
                priority
                quality={100}
                sizes="(max-width: 640px) 94vw, 420px"
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

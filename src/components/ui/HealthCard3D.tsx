"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import { getEmergencyUrl } from "@/lib/product-flow";
import type { UserProfile, BloodGroup } from "@/lib/types";

interface HealthCard3DProps {
  bloodGroup?: BloodGroup | string;
  tier?: "STANDARD" | "PRO";
  activationCode?: string;
  className?: string;
  interactive?: boolean;
  autoFlip?: boolean;
  data?: Partial<UserProfile>;
  name?: string;
  healthId?: string;
}

function SoftShine() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[16px]"
    >
      <motion.div
        className="absolute -left-1/3 top-0 h-full w-1/3 skew-x-[-18deg]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(242,208,96,0.14), transparent)",
        }}
        animate={{ x: ["-20%", "320%"] }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          repeatDelay: 2.2,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

export function HealthCard3D({
  bloodGroup,
  tier = "STANDARD",
  activationCode,
  className,
  interactive = true,
  data,
  name,
  healthId,
}: HealthCard3DProps) {
  const [flipped, setFlipped] = useState(false);

  const code = data?.activation_code || activationCode || "XXXX";
  const emergencyUrl = getEmergencyUrl(code);
  const displayName = data?.full_name || name || "KavachSaathi Member";
  const displayHealthId =
    data?.health_id || healthId || (code !== "XXXX" ? `KVS-${code}` : "KVS-····");
  const displayBlood = data?.blood_group || bloodGroup || "";
  const displayTier = (data?.tier || tier || "STANDARD").toUpperCase();
  const isPro = displayTier === "PRO";

  return (
    <div
      className={cn("relative mx-auto w-full max-w-[360px]", className)}
      style={{ perspective: "1400px" }}
    >
      <motion.div
        className="relative w-full cursor-pointer"
        style={{
          aspectRatio: "85.6 / 54",
          transformStyle: "preserve-3d",
        }}
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          rotateY: flipped ? 180 : 0,
        }}
        transition={{
          opacity: { duration: 0.5 },
          y: { duration: 0.5 },
          scale: { type: "spring", stiffness: 220, damping: 18 },
          rotateY: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
        }}
        onClick={() => interactive && setFlipped((f) => !f)}
        whileHover={interactive ? { scale: 1.025 } : undefined}
        whileTap={interactive ? { scale: 0.985 } : undefined}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[16px] border border-gold/45 bg-[#0a0a08]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            boxShadow:
              "0 0 0 1px rgba(212,175,55,0.12), 0 18px 40px rgba(0,0,0,0.45), 0 0 32px rgba(212,175,55,0.18)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #1c1914 0%, #0d0c0a 38%, #16140f 72%, #090908 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.28) 0%, transparent 68%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-14 -left-8 h-40 w-40 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.14) 0%, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-8 top-0 h-full w-14 -skew-x-12 opacity-[0.12]"
            style={{
              background:
                "linear-gradient(180deg, transparent 5%, #F2D060 48%, #D4AF37 58%, transparent 95%)",
            }}
          />
          <div className="pointer-events-none absolute inset-[6px] rounded-[12px] border border-gold/25" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <SoftShine />

          <div className="relative z-10 flex h-full flex-col px-5 py-3.5 sm:px-6 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient shadow-gold-sm sm:h-10 sm:w-10"
                  animate={{ rotate: [0, -3, 3, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Shield className="h-5 w-5 text-kavach-black" strokeWidth={2.4} />
                </motion.div>
                <div>
                  <p className="font-rajdhani text-base font-bold leading-none tracking-wide text-gold sm:text-lg">
                    KavachSaathi
                  </p>
                  <p className="mt-1 font-dm text-[7px] font-medium uppercase tracking-[0.22em] text-cream-soft/70 sm:text-[8px]">
                    Smart Health Card
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-rajdhani text-xs font-bold tracking-[0.18em] text-gold sm:text-sm">
                  GDM
                </p>
                <motion.span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 font-rajdhani text-[8px] font-bold tracking-wider",
                    isPro
                      ? "bg-gold/20 text-gold"
                      : "border border-gold/30 text-gold/70"
                  )}
                  animate={isPro ? { opacity: [0.75, 1, 0.75] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {displayTier}
                </motion.span>
              </div>
            </div>

            <div className="mt-3 min-w-0 sm:mt-4">
              <p className="truncate font-rajdhani text-lg font-bold leading-tight text-cream sm:text-xl">
                {displayName}
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-gold/80 sm:text-[11px]">
                {displayHealthId}
              </p>
            </div>

            <div className="flex-1" />

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 pb-0.5">
                <p className="font-dm text-[7px] uppercase tracking-[0.24em] text-cream-soft/50">
                  Blood Group
                </p>
                <p className="mt-0.5 font-rajdhani text-[11px] font-semibold tracking-wide text-cream/85">
                  Affix sticker
                </p>
                <p className="mt-0.5 font-dm text-[8px] text-cream-soft/45">
                  Included in packaging
                </p>
              </div>

              <motion.div
                className="relative shrink-0"
                aria-label={
                  displayBlood
                    ? `Blood group ${displayBlood}`
                    : "Blood group sticker area"
                }
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[#F2D060] via-[#D4AF37] to-[#9A7A18]" />
                <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#B71C1C] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_6px_16px_rgba(183,28,28,0.35)] sm:h-[58px] sm:w-[58px]">
                  {displayBlood ? (
                    <span className="font-rajdhani text-lg font-bold leading-none text-white sm:text-xl">
                      {displayBlood}
                    </span>
                  ) : (
                    <div className="absolute inset-[5px] rounded-full border border-dashed border-white/40" />
                  )}
                </div>
              </motion.div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-gold/20 pt-2">
              <p className="font-rajdhani text-[8px] font-semibold tracking-[0.12em] text-gold/55">
                GDM TECHNOWORLD
              </p>
              <p className="font-dm text-[8px] tracking-[0.06em] text-cream-soft/50">
                Made in India · 1 Year
              </p>
            </div>
          </div>
        </div>

        {/* BACK — content sized to fit PVC aspect ratio */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[16px] border border-gold/40 bg-[#0c0c0a]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            boxShadow:
              "0 0 0 1px rgba(212,175,55,0.1), 0 18px 40px rgba(0,0,0,0.45), 0 0 28px rgba(212,175,55,0.14)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 70% 30%, rgba(212,175,55,0.1), transparent 55%), linear-gradient(160deg, #14120e 0%, #080808 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-[5px] rounded-[11px] border border-gold/18" />
          <SoftShine />

          <div className="relative z-10 box-border flex h-full flex-col justify-between px-3.5 py-2.5 sm:px-4 sm:py-3">
            {/* Top row */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="font-rajdhani text-[9px] font-bold uppercase tracking-[0.14em] text-gold">
                  Emergency scan
                </p>
                <p className="mt-1 font-dm text-[8px] leading-snug text-cream-soft/65">
                  Medical profile opens instantly — no app needed.
                </p>
              </div>
              <div className="shrink-0 rounded-[5px] bg-cream p-1">
                <QRCode
                  value={emergencyUrl}
                  size={58}
                  bgColor="#E6DFC8"
                  fgColor="#080808"
                  level="M"
                />
              </div>
            </div>

            {/* Dedication — compact */}
            <div className="my-1.5 border-y border-gold/15 py-1.5 text-center">
              <p className="font-body text-[8px] italic leading-snug text-gold/75">
                Dedicated to five brothers whose love shields our family.
              </p>
              <p className="mt-1 font-rajdhani text-[7px] font-semibold tracking-[0.06em] text-cream-soft/50">
                Late Shri Ganga Dhar Mehta Ji · 1949–2012
              </p>
            </div>

            {/* Footer — single clean line inside card */}
            <div className="flex items-center justify-between gap-2">
              <p className="shrink-0 font-rajdhani text-[10px] font-bold tracking-wide text-gold">
                KavachSaathi
              </p>
              <p className="truncate text-right font-dm text-[7px] tracking-wide text-cream-soft/50">
                GDM Technoworld Pvt. Ltd.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {interactive && (
        <motion.p
          className="mt-3 text-center font-dm text-[11px] tracking-wide text-cream-soft/65"
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          Tap to flip · Front &amp; back
        </motion.p>
      )}
    </div>
  );
}

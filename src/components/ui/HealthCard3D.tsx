"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import { getEmergencyUrl } from "@/lib/product-flow";
import type { UserProfile, BloodGroup } from "@/lib/types";

interface HealthCard3DProps {
  /** Kept for callers — not printed on card (physical sticker goes in red circle) */
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

export function HealthCard3D({
  activationCode,
  className,
  interactive = true,
  data,
}: HealthCard3DProps) {
  const [flipped, setFlipped] = useState(false);

  const code = data?.activation_code || activationCode || "XXXX";
  const emergencyUrl = getEmergencyUrl(code);

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
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => interactive && setFlipped((f) => !f)}
        whileHover={interactive ? { scale: 1.015 } : undefined}
      >
        {/* ─── FRONT ─── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[14px] border border-gold/40 bg-[#0a0a08] shadow-gold-glow"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Layered premium metal look */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #1a1812 0%, #0c0c0a 42%, #14120e 78%, #0a0908 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 68%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full opacity-30"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
            }}
          />
          {/* Diagonal gold foil slash */}
          <div
            className="pointer-events-none absolute -left-6 top-0 h-full w-16 -skew-x-12 opacity-[0.14]"
            style={{
              background:
                "linear-gradient(180deg, transparent 8%, #F2D060 45%, #D4AF37 55%, transparent 92%)",
            }}
          />
          {/* Inner gold frame */}
          <div className="pointer-events-none absolute inset-[7px] rounded-[10px] border border-gold/20" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />

          <div className="relative z-10 flex h-full flex-col px-5 py-3.5 sm:px-6 sm:py-4">
            {/* Brand strip */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg gold-gradient shadow-gold-sm">
                    <Shield
                      className="h-5 w-5 text-kavach-black"
                      strokeWidth={2.25}
                    />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0a0a08] bg-gold" />
                </div>
                <div>
                  <p className="font-rajdhani text-lg font-bold leading-none tracking-wide text-gold sm:text-[19px]">
                    KavachSaathi
                  </p>
                  <p className="mt-1.5 font-dm text-[8px] font-medium uppercase tracking-[0.28em] text-cream-soft/65">
                    Smart Health Card
                  </p>
                </div>
              </div>
              <p className="mt-1 font-rajdhani text-sm font-bold tracking-[0.2em] text-gold">
                GDM
              </p>
            </div>

            {/* Mid identity line */}
            <div className="mt-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
              <p className="shrink-0 font-rajdhani text-[8px] font-semibold uppercase tracking-[0.35em] text-gold/55">
                Protect · Inform · Save
              </p>
              <div className="h-px flex-1 bg-gradient-to-l from-gold/50 to-transparent" />
            </div>

            <div className="flex-1" />

            {/* Blood medallion zone */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 pb-1">
                <p className="font-dm text-[7px] uppercase tracking-[0.28em] text-cream-soft/45">
                  Blood Group
                </p>
                <p className="mt-1 font-rajdhani text-[11px] font-semibold tracking-wide text-cream/85">
                  Affix sticker
                </p>
                <p className="mt-0.5 font-dm text-[8px] text-cream-soft/40">
                  Included in packaging
                </p>
              </div>

              <div className="relative shrink-0" aria-label="Blood group sticker area">
                {/* Gold outer ring */}
                <div className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[#F2D060] via-[#D4AF37] to-[#9A7A18] opacity-90" />
                <div className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#B71C1C] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_6px_18px_rgba(183,28,28,0.4)] sm:h-[58px] sm:w-[58px]">
                  <div className="absolute inset-[5px] rounded-full border border-dashed border-white/35" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-gold/15 pt-2">
              <p className="font-rajdhani text-[8px] font-semibold tracking-[0.12em] text-gold/50">
                GDM TECHNOWORLD
              </p>
              <p className="font-dm text-[8px] tracking-[0.08em] text-cream-soft/45">
                Made in India · 1 Year
              </p>
            </div>
          </div>
        </div>

        {/* ─── BACK ─── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[14px] border border-gold/35 bg-[#0c0c0a] shadow-gold-glow"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 70% 30%, rgba(212,175,55,0.08), transparent 50%), linear-gradient(160deg, #12110e 0%, #080808 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

          <div className="relative z-10 flex h-full flex-col px-5 py-4 sm:px-6 sm:py-5">
            {/* Top: Emergency label + QR row */}
            <div className="flex items-start justify-between gap-4">
              <div className="pt-0.5">
                <p className="font-rajdhani text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Scan in emergency
                </p>
                <p className="mt-1.5 max-w-[9rem] font-dm text-[9px] leading-relaxed text-cream-soft/65">
                  Opens medical profile instantly — no app, no login.
                </p>
              </div>
              <div className="shrink-0 rounded-[6px] bg-cream p-1.5 shadow-sm">
                <QRCode
                  value={emergencyUrl}
                  size={72}
                  bgColor="#E6DFC8"
                  fgColor="#080808"
                  level="M"
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* Dedication — one calm block */}
            <div className="border-y border-gold/12 py-2.5 text-center">
              <p className="font-body text-[9px] italic leading-relaxed text-gold/75 sm:text-[10px]">
                Dedicated to the five brothers —
                <br />
                whose love still shields our family.
              </p>
              <p className="mt-1.5 font-rajdhani text-[8px] font-semibold uppercase tracking-[0.12em] text-cream-soft/45">
                Shri Ganga Dhar Mehta Ji &amp; brothers
              </p>
            </div>

            {/* Brand footer */}
            <div className="mt-2.5 flex items-center justify-between">
              <p className="font-rajdhani text-xs font-bold text-gold">
                KavachSaathi
              </p>
              <p className="font-dm text-[8px] text-cream-soft/50">
                GDM Technoworld Pvt. Ltd.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {interactive && (
        <p className="mt-3 text-center font-dm text-[11px] tracking-wide text-cream-soft/60">
          Tap to flip
        </p>
      )}
    </div>
  );
}

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
  const displayName =
    data?.full_name || name || "KavachSaathi Member";
  const displayHealthId =
    data?.health_id || healthId || (code !== "XXXX" ? `KVS-${code}` : "KVS-····");
  const displayBlood =
    data?.blood_group || bloodGroup || "";
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
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => interactive && setFlipped((f) => !f)}
        whileHover={interactive ? { scale: 1.02 } : undefined}
      >
        {/* ─── FRONT ─── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[16px] border border-gold/45 bg-[#0a0a08] shadow-gold-glow"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
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

          <div className="relative z-10 flex h-full flex-col px-5 py-3.5 sm:px-6 sm:py-4">
            {/* Top brand */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient shadow-gold-sm sm:h-10 sm:w-10">
                  <Shield
                    className="h-4.5 w-4.5 text-kavach-black sm:h-5 sm:w-5"
                    strokeWidth={2.4}
                  />
                </div>
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
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 font-rajdhani text-[8px] font-bold tracking-wider",
                    isPro
                      ? "bg-gold/20 text-gold"
                      : "border border-gold/30 text-gold/70"
                  )}
                >
                  {displayTier}
                </span>
              </div>
            </div>

            {/* Identity */}
            <div className="mt-3 min-w-0 sm:mt-4">
              <p className="truncate font-rajdhani text-lg font-bold leading-tight text-cream sm:text-xl">
                {displayName}
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-gold/80 sm:text-[11px]">
                {displayHealthId}
              </p>
            </div>

            <div className="flex-1" />

            {/* Blood + code */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 pb-0.5">
                <p className="font-dm text-[7px] uppercase tracking-[0.24em] text-cream-soft/50">
                  Activation
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold tracking-[0.2em] text-gold">
                  {String(code).padStart(4, "0")}
                </p>
                <p className="mt-0.5 font-dm text-[8px] text-cream-soft/45">
                  Emergency QR on reverse
                </p>
              </div>

              <div
                className="relative shrink-0"
                aria-label={
                  displayBlood
                    ? `Blood group ${displayBlood}`
                    : "Blood group sticker area"
                }
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
              </div>
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

        {/* ─── BACK ─── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[16px] border border-gold/40 bg-[#0c0c0a] shadow-gold-glow"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 70% 30%, rgba(212,175,55,0.1), transparent 55%), linear-gradient(160deg, #14120e 0%, #080808 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-[6px] rounded-[12px] border border-gold/18" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

          <div className="relative z-10 flex h-full flex-col px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="pt-0.5">
                <p className="font-rajdhani text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                  Scan in emergency
                </p>
                <p className="mt-1.5 max-w-[9.5rem] font-dm text-[9px] leading-relaxed text-cream-soft/70">
                  Opens medical profile instantly — no app, no login.
                </p>
                <p className="mt-3 font-mono text-[10px] tracking-[0.16em] text-gold/75">
                  {String(code).padStart(4, "0")}
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-cream p-1.5 shadow-sm">
                <QRCode
                  value={emergencyUrl}
                  size={76}
                  bgColor="#E6DFC8"
                  fgColor="#080808"
                  level="M"
                />
              </div>
            </div>

            <div className="flex-1" />

            <div className="border-y border-gold/15 py-2.5 text-center">
              <p className="font-body text-[9px] italic leading-relaxed text-gold/80 sm:text-[10px]">
                Dedicated to the five brothers —
                <br />
                whose love still shields our family.
              </p>
              <p className="mt-1.5 font-rajdhani text-[8px] font-semibold uppercase tracking-[0.1em] text-cream-soft/50">
                Shri Ganga Dhar Mehta Ji &amp; brothers
              </p>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <p className="font-rajdhani text-xs font-bold text-gold">
                KavachSaathi
              </p>
              <p className="font-dm text-[8px] text-cream-soft/55">
                GDM Technoworld Pvt. Ltd.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {interactive && (
        <p className="mt-3 text-center font-dm text-[11px] tracking-wide text-cream-soft/65">
          Tap to flip · Front &amp; back
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BloodGroup, CardTier } from "@/lib/types";

/** Fields the 3D card can display (legacy + current schema) */
type CardDisplayData = {
  user_name?: string;
  blood_group?: BloodGroup | string;
  health_id?: string;
  tier?: CardTier;
  activation_code?: string;
};

interface HealthCard3DProps {
  name?: string;
  bloodGroup?: BloodGroup | string;
  healthId?: string;
  tier?: "STANDARD" | "PRO";
  activationCode?: string;
  className?: string;
  interactive?: boolean;
  autoFlip?: boolean;
  data?: Partial<CardDisplayData>;
}

export function HealthCard3D({
  name = "YOUR NAME",
  bloodGroup = "O+",
  healthId = "KVS-2026-XXXXX",
  tier = "STANDARD",
  activationCode,
  className,
  interactive = true,
  data,
}: HealthCard3DProps) {
  const [flipped, setFlipped] = useState(false);

  const displayName = data?.user_name || name;
  const displayBg = data?.blood_group || bloodGroup;
  const displayId = data?.health_id || healthId;
  const displayTier = data?.tier || tier;
  const code = data?.activation_code || activationCode;

  return (
    <div
      className={cn("perspective-[1200px] relative mx-auto w-full max-w-[340px]", className)}
      style={{ perspective: "1200px" }}
    >
      <motion.div
        className="relative h-[210px] w-full cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        onClick={() => interactive && setFlipped((f) => !f)}
        whileHover={interactive ? { scale: 1.02 } : undefined}
      >
        {/* Front */}
        <div
          className="gold-shimmer absolute inset-0 overflow-hidden rounded-card border border-gold/40 bg-gradient-to-br from-kavach-s2 via-kavach-s1 to-kavach-black p-5 shadow-gold-glow"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-0 grid-pattern opacity-60" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
                  <Shield className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="font-rajdhani text-sm font-bold leading-none text-gold">
                    KavachSaathi
                  </p>
                  <p className="font-dm text-[10px] text-cream-soft">
                    Smart Health Card
                  </p>
                </div>
              </div>
              <span className="rounded-badge border border-gold-border bg-gold-faint px-2.5 py-0.5 font-rajdhani text-[10px] font-bold uppercase tracking-wider text-gold">
                {displayTier}
              </span>
            </div>

            <div>
              <p className="font-rajdhani text-xl font-bold uppercase tracking-wide text-cream">
                {displayName}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="font-dm text-[10px] uppercase tracking-widest text-cream-soft">
                    Health ID
                  </p>
                  <p className="font-mono text-sm text-gold">{displayId}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger font-mono text-sm font-bold text-white">
                  {displayBg}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 overflow-hidden rounded-card border border-gold/40 bg-gradient-to-br from-black-2 to-black p-5 shadow-gold-glow"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="font-rajdhani text-sm font-bold text-gold">
                Emergency Access
              </p>
              <QrCode className="h-8 w-8 text-gold" />
            </div>
            <div className="space-y-2">
              <p className="font-dm text-xs text-cream-soft">
                Scan QR or visit
              </p>
              <p className="font-mono text-sm text-cream">
                kavachsaathi.in/e/{code || "XXXX"}
              </p>
              {code && (
                <p className="font-mono text-xs text-cream-soft">
                  Code: {code}
                </p>
              )}
            </div>
            <p className="font-dm text-[10px] text-cream-soft">
              GDM Technoworld Pvt. Ltd. · Made in India
            </p>
          </div>
        </div>
      </motion.div>
      {interactive && (
        <p className="mt-3 text-center font-dm text-xs text-cream-soft">
          Tap to flip
        </p>
      )}
    </div>
  );
}

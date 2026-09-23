"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ECGBackgroundProps {
  className?: string;
  showParticles?: boolean;
}

export function ECGBackground({
  className,
  showParticles = true,
}: ECGBackgroundProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 11) % 100}%`,
        top: `${(i * 53 + 7) % 100}%`,
        delay: `${(i % 6) * 0.4}s`,
        size: 2 + (i % 3),
      })),
    []
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden
    >
      <svg
        className="absolute left-0 top-1/3 h-32 w-full opacity-30 md:h-40"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="ecg-line"
          d="M0 60 H180 L200 60 L220 20 L240 100 L260 60 H400 L420 60 L440 5 L460 115 L480 60 H650 L670 60 L690 25 L710 95 L730 60 H900 L920 60 L940 15 L960 105 L980 60 H1200"
          stroke="#D4AF37"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showParticles &&
        particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-gold"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animation: `float-particle ${3 + (p.id % 3)}s ease-in-out infinite`,
              animationDelay: p.delay,
              opacity: 0.45,
            }}
          />
        ))}
    </div>
  );
}

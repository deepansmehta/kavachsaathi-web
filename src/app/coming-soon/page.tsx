"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { getTimeLeft, type TimeLeft } from "@/lib/launch";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function LogoMark() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl gold-gradient shadow-gold-glow sm:h-24 sm:w-24 sm:rounded-3xl">
      <Shield className="h-10 w-10 text-kavach-black sm:h-12 sm:w-12" strokeWidth={2.25} />
      <svg
        className="absolute bottom-2.5 left-1/2 h-3 w-10 -translate-x-1/2"
        viewBox="0 0 40 12"
        fill="none"
        aria-hidden
      >
        <path
          d="M0 6 H8 L10 3 L14 9 L18 2 L22 10 L26 6 H40"
          stroke="#080808"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

function CountdownGrid({ t }: { t: TimeLeft }) {
  const units = [
    { label: "Days", value: t.days },
    { label: "Hours", value: t.hours },
    { label: "Minutes", value: t.minutes },
    { label: "Seconds", value: t.seconds },
  ];

  return (
    <div
      className="mt-12 flex items-center justify-center gap-2 sm:gap-4"
      aria-live="polite"
    >
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-4">
          <div className="min-w-[4.25rem] text-center sm:min-w-[5.5rem]">
            <p className="font-mono text-3xl font-bold tabular-nums text-gold sm:text-5xl">
              {pad(u.value)}
            </p>
            <p className="mt-2 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-soft/50">
              {u.label}
            </p>
          </div>
          {i < units.length - 1 && (
            <span className="mb-5 font-mono text-2xl text-gold/35 sm:text-3xl">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ComingSoonPage() {
  const [t, setT] = useState<TimeLeft>(() => getTimeLeft());

  useEffect(() => {
    const tick = () => {
      const next = getTimeLeft();
      setT(next);
      if (next.done) {
        // Hard navigation so middleware re-evaluates launch server-side
        window.location.replace("/");
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#080808] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 35%, rgba(212,175,55,0.12), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        <div className="relative mb-8 flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
          <div className="absolute inset-0 animate-gold-pulse rounded-full bg-gold/25 blur-xl" />
          <LogoMark />
        </div>

        <h1 className="font-rajdhani text-5xl font-bold tracking-tight text-gold sm:text-6xl md:text-7xl">
          KavachSaathi
        </h1>

        <p className="mt-4 font-body text-sm tracking-wide text-cream-soft/70 sm:text-base">
          Something Is Coming
        </p>

        <CountdownGrid t={t} />

        <p className="mt-16 font-rajdhani text-xs font-semibold uppercase tracking-[0.2em] text-cream-soft/40">
          GDM Technoworld Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { getTimeLeft, type TimeLeft } from "@/lib/launch";

const BROTHERS = [
  { name: "Shri Ganga Dhar Mehta Ji", memorial: true, years: "1949 — 2011" },
  { name: "Shri Narender Bajaj Ji", memorial: false },
  { name: "Shri Surender Bajaj Ji", memorial: false },
  { name: "Shri Bansi Dhar Bajaj Ji", memorial: false },
  { name: "Shri Pawan Bajaj Ji", memorial: true, years: "1962 — 2015" },
] as const;

const PARTICLES = [
  { x: "8%", y: "18%", d: 0, s: 2 },
  { x: "88%", y: "22%", d: 0.4, s: 3 },
  { x: "18%", y: "72%", d: 0.8, s: 2 },
  { x: "78%", y: "68%", d: 0.2, s: 2.5 },
  { x: "50%", y: "10%", d: 0.6, s: 2 },
  { x: "42%", y: "88%", d: 1.1, s: 2 },
  { x: "92%", y: "48%", d: 0.3, s: 2.5 },
  { x: "6%", y: "48%", d: 0.9, s: 3 },
];

/** Unlock ceremony before opening the full site */
const UNLOCK_MS = 4800;

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function LogoMark({ size = "md" }: { size?: "md" | "xl" }) {
  const box =
    size === "xl"
      ? "h-28 w-28 rounded-[1.75rem] sm:h-32 sm:w-32"
      : "h-20 w-20 rounded-2xl sm:h-24 sm:w-24 sm:rounded-3xl";
  const icon =
    size === "xl" ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10 sm:h-12 sm:w-12";

  return (
    <div
      className={`relative flex items-center justify-center gold-gradient shadow-gold-glow ${box}`}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        <div className="cs-logo-shine absolute -inset-y-4 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </div>
      <Shield className={`relative text-kavach-black ${icon}`} strokeWidth={2.25} />
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
      className="mt-12 flex items-center justify-center gap-2 sm:gap-3"
      aria-live="polite"
    >
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-3">
          <div className="cs-timer-cell relative min-w-[4.5rem] overflow-hidden rounded-2xl px-2 py-3 text-center sm:min-w-[5.75rem] sm:px-3 sm:py-4">
            <p
              className="font-mono text-3xl font-bold tabular-nums text-gold sm:text-5xl"
              suppressHydrationWarning
            >
              {pad(u.value)}
            </p>
            <p className="mt-2 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-soft/50">
              {u.label}
            </p>
          </div>
          {i < units.length - 1 && (
            <span className="cs-colon mb-5 font-mono text-2xl text-gold/45 sm:text-3xl">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function UnlockCeremony() {
  return (
    <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-4 text-center">
      <div className="cs-unlock-burst pointer-events-none absolute left-1/2 top-[30%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/35" />
      <div className="cs-unlock-burst-2 pointer-events-none absolute left-1/2 top-[30%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/20" />

      <div className="cs-unlock-in relative mb-8">
        <div className="absolute inset-0 animate-gold-pulse rounded-full bg-gold/35 blur-2xl" />
        <LogoMark size="xl" />
      </div>

      <p className="cs-unlock-in cs-unlock-d1 font-rajdhani text-xs font-semibold uppercase tracking-[0.45em] text-gold sm:text-sm">
        The Wait Is Over
      </p>
      <h1 className="cs-unlock-in cs-unlock-d2 mt-3 font-rajdhani text-5xl font-bold tracking-tight gold-text-shimmer sm:text-6xl md:text-7xl">
        KavachSaathi
      </h1>
      <p className="cs-unlock-in cs-unlock-d3 mt-4 font-body text-base text-cream-soft/80 sm:text-lg">
        A new chapter begins.
      </p>

      <div className="cs-unlock-in cs-unlock-d4 mt-10 w-full max-w-xs">
        <div className="h-px w-full overflow-hidden rounded-full bg-gold/15">
          <div className="cs-unlock-bar h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light" />
        </div>
        <p className="mt-3 font-rajdhani text-xs font-semibold uppercase tracking-[0.3em] text-gold/75">
          Opening the site…
        </p>
      </div>
    </div>
  );
}

export default function ComingSoonPage() {
  const [t, setT] = useState<TimeLeft>(() => getTimeLeft());
  const [phase, setPhase] = useState<"countdown" | "unlock">("countdown");

  useEffect(() => {
    const tick = () => {
      const next = getTimeLeft();
      setT(next);
      if (next.done) setPhase("unlock");
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "unlock") return;
    const id = window.setTimeout(() => {
      window.location.replace("/");
    }, UNLOCK_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  return (
    <div className="cs-stage relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 cs-atmosphere" aria-hidden />
      <div className="pointer-events-none absolute inset-0 cs-vignette" aria-hidden />
      <div className="pointer-events-none absolute inset-0 cs-grain" aria-hidden />

      {phase === "unlock" ? (
        <UnlockCeremony />
      ) : (
        <>
          <div
            className="pointer-events-none absolute left-1/2 top-[22%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 sm:top-[20%] sm:h-80 sm:w-80"
            aria-hidden
          >
            <div className="cs-orbit absolute inset-0 rounded-full border border-gold/10" />
            <div className="cs-orbit-rev absolute inset-6 rounded-full border border-dashed border-gold/15" />
            <div className="cs-orbit absolute inset-12 rounded-full border border-gold/8" />
          </div>

          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-gold"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.s,
                  height: p.s,
                  boxShadow: "0 0 10px rgba(212,175,55,0.65)",
                }}
                animate={{
                  y: [0, -18, 0],
                  opacity: [0.15, 0.7, 0.15],
                  scale: [1, 1.35, 1],
                }}
                transition={{
                  duration: 4 + i * 0.35,
                  delay: p.d,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
            <div className="cs-enter relative mb-8 flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
              <div className="absolute inset-0 animate-gold-pulse rounded-full bg-gold/30 blur-2xl" />
              <div className="cs-logo-float">
                <LogoMark />
              </div>
            </div>

            <h1 className="cs-enter cs-enter-d1 cs-brand-title font-rajdhani text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              KavachSaathi
            </h1>

            <p className="cs-enter cs-enter-d2 mt-3 font-rajdhani text-base font-semibold tracking-[0.14em] text-gold/90 sm:text-lg">
              Born from Legacy · Built to Protect
            </p>

            <p className="cs-enter cs-enter-d3 mt-2 font-body text-sm tracking-[0.2em] text-cream-soft/60 sm:text-base">
              Something Is Coming
            </p>

            <p className="cs-enter cs-enter-d3 mt-1 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.28em] text-gold/50">
              Launching 11 Oct 2026 · 12:00 PM IST
            </p>

            <div className="cs-enter cs-enter-d4 w-full">
              <CountdownGrid t={t} />
            </div>

            <div className="bajaj-legacy mt-14 flex w-full max-w-sm flex-col items-center gap-3">
              <div className="bajaj-legacy-rule w-full" />
              <div className="flex items-center gap-3">
                <span className="bajaj-legacy-diamond h-1.5 w-1.5 bg-gold" />
                <p className="bajaj-legacy-text text-xl sm:text-2xl md:text-[1.7rem]">
                  The Bajaj Brothers
                </p>
                <span className="bajaj-legacy-diamond h-1.5 w-1.5 bg-gold" />
              </div>
              <p className="font-rajdhani text-[10px] font-semibold uppercase tracking-[0.32em] text-gold/65 sm:text-[11px]">
                Bhirdana · Fatehabad
              </p>
              <div className="bajaj-legacy-rule w-full" />
            </div>

            <section
              className="mt-11 w-full max-w-md"
              aria-label="Dedicated to The Bajaj Brothers of Bhirdana, Fatehabad — Five Brothers One Legacy"
            >
              <h2 className="font-rajdhani text-[10px] font-semibold uppercase tracking-[0.35em] text-cream-soft/55 sm:text-xs">
                Dedicated to Five Brothers · One Legacy
              </h2>
              <p className="mt-2 font-body text-xs text-cream-soft/55 sm:text-sm">
                The Bajaj Family · Bhirdana, Fatehabad
              </p>

              <p className="sr-only">
                KavachSaathi launches 11 October 2026 at 12:00 PM IST. Born from
                Legacy, Built to Protect. Dedicated to The Bajaj Brothers of
                Bhirdana, Fatehabad. Shri Ganga Dhar Mehta Ji (1949 to 2011),
                Shri Narender Bajaj Ji, Shri Surender Bajaj Ji, Shri Bansi Dhar
                Bajaj Ji, and Shri Pawan Bajaj Ji (1962 to 2015).
              </p>

              <ul className="mt-6 space-y-3">
                {BROTHERS.map((b, i) => (
                  <li
                    key={b.name}
                    className="cs-brother-card launch-brother-row flex flex-col items-center rounded-xl px-3 py-2.5"
                    style={{ animationDelay: `${0.35 + i * 0.1}s` }}
                  >
                    <span className="font-rajdhani text-base font-bold text-cream sm:text-lg">
                      {b.memorial ? "🪔 " : ""}
                      {b.name}
                    </span>
                    {"years" in b && b.years ? (
                      <span
                        className="memorial-years"
                        aria-label={`Years ${b.years}`}
                      >
                        {b.years}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>

              <p className="mt-6 font-body text-xs italic text-cream-soft/50">
                With love, respect &amp; eternal gratitude
              </p>
            </section>

            <p className="mt-12 font-rajdhani text-xs font-semibold uppercase tracking-[0.22em] text-cream-soft/40">
              GDM Technoworld Pvt. Ltd.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

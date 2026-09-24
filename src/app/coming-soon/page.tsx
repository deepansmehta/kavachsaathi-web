"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  { x: "65%", y: "35%", d: 1.4, s: 1.5 },
  { x: "30%", y: "42%", d: 0.5, s: 2 },
];

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PLACEHOLDER: TimeLeft = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalSeconds: 0,
  done: false,
};

function LogoMark() {
  return (
    <motion.div
      className="relative flex h-20 w-20 items-center justify-center rounded-2xl gold-gradient shadow-gold-glow sm:h-24 sm:w-24 sm:rounded-3xl"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl sm:rounded-3xl"
        aria-hidden
      >
        <motion.div
          className="absolute -inset-y-4 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.6 }}
        />
      </motion.div>
      <Shield className="relative h-10 w-10 text-kavach-black sm:h-12 sm:w-12" strokeWidth={2.25} />
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
    </motion.div>
  );
}

function CountdownGrid({ t, ready }: { t: TimeLeft; ready: boolean }) {
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
          <motion.div
            className="cs-timer-cell relative min-w-[4.5rem] overflow-hidden rounded-2xl px-2 py-3 text-center sm:min-w-[5.75rem] sm:px-3 sm:py-4"
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.7,
              delay: ready ? 0.15 + i * 0.08 : 0,
              ease: easeOut,
            }}
          >
            {ready ? (
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={`${u.label}-${u.value}`}
                  className="font-mono text-3xl font-bold tabular-nums text-gold sm:text-5xl"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.35 }}
                >
                  {pad(u.value)}
                </motion.p>
              </AnimatePresence>
            ) : (
              <p className="font-mono text-3xl font-bold tabular-nums text-gold/40 sm:text-5xl">
                --
              </p>
            )}
            <p className="mt-2 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-soft/50">
              {u.label}
            </p>
          </motion.div>
          {i < units.length - 1 && (
            <motion.span
              className="mb-5 font-mono text-2xl text-gold/40 sm:text-3xl"
              animate={ready ? { opacity: [0.25, 0.85, 0.25] } : { opacity: 0.4 }}
              transition={
                ready
                  ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
            >
              :
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, delay, ease: easeOut },
  }),
};

export default function ComingSoonPage() {
  const [ready, setReady] = useState(false);
  const [t, setT] = useState<TimeLeft>(PLACEHOLDER);

  useEffect(() => {
    setReady(true);
    const tick = () => {
      const next = getTimeLeft();
      setT(next);
      if (next.done) {
        window.location.replace("/");
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="cs-stage relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 cs-atmosphere" aria-hidden />
      <div className="pointer-events-none absolute inset-0 cs-vignette" aria-hidden />
      <div className="pointer-events-none absolute inset-0 cs-grain" aria-hidden />

      {/* Soft orbit rings behind logo */}
      <div className="pointer-events-none absolute left-1/2 top-[22%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 sm:top-[20%] sm:h-80 sm:w-80" aria-hidden>
        <div className="cs-orbit absolute inset-0 rounded-full border border-gold/10" />
        <div className="cs-orbit-rev absolute inset-6 rounded-full border border-dashed border-gold/15" />
        <div className="cs-orbit absolute inset-12 rounded-full border border-gold/8" />
      </div>

      {/* Floating particles */}
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
        <motion.div
          className="relative mb-8 flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28"
          custom={0.05}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="absolute inset-0 animate-gold-pulse rounded-full bg-gold/30 blur-2xl" />
          <LogoMark />
        </motion.div>

        <motion.h1
          className="cs-brand-title font-rajdhani text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl"
          custom={0.18}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          KavachSaathi
        </motion.h1>

        <motion.p
          className="mt-3 font-rajdhani text-base font-semibold tracking-[0.14em] text-gold/90 sm:text-lg"
          custom={0.32}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          Born from Legacy · Built to Protect
        </motion.p>

        <motion.p
          className="mt-2 font-body text-sm tracking-[0.2em] text-cream-soft/60 sm:text-base"
          custom={0.42}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          Something Is Coming
        </motion.p>

        <CountdownGrid t={t} ready={ready} />

        {/* Signature — The Bajaj Brothers */}
        <motion.div
          className="bajaj-legacy mt-14 flex w-full max-w-sm flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
        >
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
        </motion.div>

        <section
          className="mt-11 w-full max-w-md"
          aria-label="Dedicated to The Bajaj Brothers of Bhirdana, Fatehabad — Five Brothers One Legacy"
        >
          <motion.h2
            className="font-rajdhani text-[10px] font-semibold uppercase tracking-[0.35em] text-cream-soft/55 sm:text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25, duration: 0.6 }}
          >
            Dedicated to Five Brothers · One Legacy
          </motion.h2>
          <motion.p
            className="mt-2 font-body text-xs text-cream-soft/55 sm:text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.35, duration: 0.6 }}
          >
            The Bajaj Family · Bhirdana, Fatehabad
          </motion.p>

          <p className="sr-only">
            KavachSaathi — Born from Legacy, Built to Protect. Dedicated to The
            Bajaj Brothers of Bhirdana, Fatehabad, Haryana. The entire Bajaj
            family belongs to Bhirdana. Five Brothers One Legacy: Shri Ganga
            Dhar Mehta Ji (1949 to 2011), Shri Narender Bajaj Ji, Shri Surender
            Bajaj Ji, Shri Bansi Dhar Bajaj Ji, and Shri Pawan Bajaj Ji (1962 to
            2015). GDM Technoworld Pvt. Ltd.
          </p>

          <ul className="mt-6 space-y-3">
            {BROTHERS.map((b, i) => (
              <motion.li
                key={b.name}
                className="cs-brother-card flex flex-col items-center rounded-xl px-3 py-2.5"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.55,
                  delay: 1.45 + i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <span className="font-rajdhani text-base font-bold text-cream sm:text-lg">
                  {b.memorial ? (
                    <motion.span
                      className="mr-1 inline-block"
                      animate={{ opacity: [0.55, 1, 0.65, 1], scale: [0.96, 1.06, 0.98, 1] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    >
                      🪔
                    </motion.span>
                  ) : null}
                  {b.name}
                </span>
                {"years" in b && b.years ? (
                  <span className="memorial-years" aria-label={`Years ${b.years}`}>
                    {b.years}
                  </span>
                ) : null}
              </motion.li>
            ))}
          </ul>

          <motion.p
            className="mt-6 font-body text-xs italic text-cream-soft/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 0.7 }}
          >
            With love, respect &amp; eternal gratitude
          </motion.p>
        </section>

        <motion.p
          className="mt-12 font-rajdhani text-xs font-semibold uppercase tracking-[0.22em] text-cream-soft/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.7 }}
        >
          GDM Technoworld Pvt. Ltd.
        </motion.p>
      </div>
    </div>
  );
}

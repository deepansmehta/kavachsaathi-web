"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { BROTHERS, BROTHERS_DEDICATION_LINE } from "@/lib/brothers";
import { LAUNCH_REVEAL_DAY_START_MS } from "@/lib/launchReveal";

const PARTICLES = [
  { x: "8%", y: "18%", s: 2 },
  { x: "88%", y: "22%", s: 3 },
  { x: "18%", y: "72%", s: 2 },
  { x: "78%", y: "68%", s: 2.5 },
  { x: "50%", y: "10%", s: 2 },
  { x: "42%", y: "88%", s: 2 },
];

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

type Left = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function leftFromServer(nowMs: number): Left {
  const diff = Math.max(0, LAUNCH_REVEAL_DAY_START_MS - nowMs);
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const sec = Math.floor(diff / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: false,
  };
}

function LogoMark() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl gold-gradient shadow-gold-glow sm:h-24 sm:w-24 sm:rounded-3xl">
      <Shield className="h-10 w-10 text-kavach-black sm:h-12 sm:w-12" strokeWidth={2.25} />
    </div>
  );
}

function totalSeconds(t: Left) {
  return t.days * 86400 + t.hours * 3600 + t.minutes * 60 + t.seconds;
}

function CountdownGrid({ t }: { t: Left }) {
  const left = totalSeconds(t);
  const heartbeat = left <= 5 && left > 0;
  const hideTimer = left <= 3 && left > 0;
  const units = [
    { label: "Days", value: t.days },
    { label: "Hours", value: t.hours },
    { label: "Minutes", value: t.minutes },
    { label: "Seconds", value: t.seconds },
  ];
  return (
    <div
      className={`mt-12 flex items-center justify-center gap-2 sm:gap-3${heartbeat ? " cs-heartbeat" : ""}${hideTimer ? " cs-timer-hide" : ""}`}
      aria-live="polite"
    >
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-3">
          <div className="cs-timer-cell relative min-w-[4.5rem] overflow-hidden rounded-2xl px-2 py-3 text-center sm:min-w-[5.75rem] sm:px-3 sm:py-4">
            <p className="font-mono text-3xl font-bold tabular-nums text-gold sm:text-5xl" suppressHydrationWarning>
              {pad(u.value)}
            </p>
            <p className="mt-2 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-soft/50">
              {u.label}
            </p>
          </div>
          {i < units.length - 1 && (
            <span className="cs-colon mb-5 font-mono text-2xl text-gold/45 sm:text-3xl">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ComingSoonPage() {
  const [t, setT] = useState<Left>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    done: false,
  });
  const [skew, setSkew] = useState(0); // serverNow - Date.now()

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const r = await fetch("/api/time", { cache: "no-store" });
        const j = (await r.json()) as { nowMs?: number };
        if (!alive || !j.nowMs) return;
        setSkew(j.nowMs - Date.now());
        setT(leftFromServer(j.nowMs));
      } catch {
        /* */
      }
    };
    void sync();
    const id = window.setInterval(() => {
      const serverNow = Date.now() + skew;
      setT(leftFromServer(serverNow));
    }, 250);
    const resync = window.setInterval(() => void sync(), 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(resync);
    };
  }, [skew]);

  const leftSec = totalSeconds(t);
  const showBig = !t.done && leftSec <= 3 && leftSec > 0;

  return (
    <div className="cs-stage relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 cs-atmosphere" aria-hidden />
      <div className="pointer-events-none absolute inset-0 cs-vignette" aria-hidden />
      {showBig ? (
        <div className="cs-bignum" key={leftSec} aria-hidden>
          {leftSec}
        </div>
      ) : null}

      {t.done ? (
        <div className="relative z-10 text-center">
          <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.4em] text-gold">
            Now live
          </p>
          <h1 className="mt-3 font-rajdhani text-4xl font-bold text-cream sm:text-5xl">
            Opening KavachSaathi…
          </h1>
          <p className="mt-3 text-sm text-cream-soft">
            Launch reveal playing · then the live site
          </p>
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className="cs-particle absolute rounded-full bg-gold"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.s,
                  height: p.s,
                  animationDelay: `${i * 0.45}s`,
                }}
              />
            ))}
          </div>
          <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
            <div className="mb-8">
              <LogoMark />
            </div>
            <h1 className="font-rajdhani text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              KavachSaathi
            </h1>
            <p className="mt-3 font-rajdhani text-base font-semibold tracking-[0.14em] text-gold/90">
              Born from Legacy · Built to Protect
            </p>
            <p className="mt-2 font-body text-sm tracking-[0.2em] text-cream-soft/60">
              Something Is Coming
            </p>
            <p className="mt-1 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.28em] text-gold/50">
              Launching 11 Oct 2026, 12:00 PM IST
            </p>
            <CountdownGrid t={t} />
            <div className="bajaj-legacy mt-14 flex w-full max-w-sm flex-col items-center gap-3">
              <div className="bajaj-legacy-rule w-full" />
              <p className="bajaj-legacy-text text-xl sm:text-2xl">The Bajaj Brothers</p>
              <p className="font-rajdhani text-[10px] font-semibold uppercase tracking-[0.32em] text-gold/65">
                Bhirdana · Fatehabad
              </p>
              <div className="bajaj-legacy-rule w-full" />
            </div>
            <section className="mt-11 w-full max-w-md" aria-label={BROTHERS_DEDICATION_LINE}>
              <ul className="mt-6 space-y-2.5">
                {BROTHERS.map((b) => (
                  <li
                    key={b.name}
                    className="cs-brother-card rounded-xl px-3 py-3 font-rajdhani text-base font-bold text-cream"
                  >
                    {b.name}
                  </li>
                ))}
              </ul>
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

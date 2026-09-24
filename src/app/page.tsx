"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";
import {
  Shield,
  Zap,
  Lock,
  QrCode,
  Smartphone,
  HeartPulse,
  Fingerprint,
  WifiOff,
} from "lucide-react";
import {
  GoldButton,
  OutlineButton,
  HealthCard3D,
  ECGBackground,
} from "@/components/ui";
import { cn } from "@/lib/utils";

function ShieldPulse() {
  return (
    <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center sm:mb-10 sm:h-24 sm:w-24">
      <motion.div
        className="absolute inset-0 rounded-full border border-gold/40"
        animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.div
        className="absolute inset-2 rounded-full border border-gold/25"
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.35 }}
      />
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold-glow sm:h-20 sm:w-20"
        animate={{ rotate: [0, -4, 4, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Shield className="h-8 w-8 text-kavach-black sm:h-10 sm:w-10" strokeWidth={2.2} />
      </motion.div>
    </div>
  );
}

function HeroProductCard() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), {
    stiffness: 140,
    damping: 18,
  });

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        mx.set((e.clientX - rect.left) / rect.width - 0.5);
        my.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.25 }}
      className="pointer-events-auto mx-auto mt-10 w-full max-w-[320px] sm:mt-12 sm:max-w-[360px]"
    >
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          filter: undefined,
        }}
      >
        <motion.div
          animate={{
            boxShadow: [
              "0 12px 36px rgba(0,0,0,0.35)",
              "0 20px 48px rgba(212,175,55,0.18)",
              "0 12px 36px rgba(0,0,0,0.35)",
            ],
          }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-[18px]"
        >
          <HealthCard3D interactive />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const HOW = [
  {
    icon: QrCode,
    title: "Stick your unique QR",
    desc: "Box sticker (QR + 4-digit code) goes on the back of your PVC card.",
  },
  {
    icon: Zap,
    title: "Activate once",
    desc: "Enter the 4-digit code online, set your health profile and PIN.",
  },
  {
    icon: Smartphone,
    title: "Scan in emergency",
    desc: "Anyone scans your card QR — only your details open. No app needed.",
  },
];

const FEATURES = [
  {
    icon: HeartPulse,
    title: "Emergency-first",
    desc: "Doctors see what matters first — blood group large and clear.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    desc: "QR opens a fast SSR page. No login. No waiting.",
  },
  {
    icon: Lock,
    title: "PIN-locked account",
    desc: "Your full profile is Phone + PIN. Never plain PIN storage.",
  },
  {
    icon: Fingerprint,
    title: "Health ID forever",
    desc: "Space Mono ID like KVS-2026-XXXXX on every card.",
  },
];

type BrotherVariant = "elder" | "pillar" | "memorial";

const BROTHERS: {
  name: string;
  label: string;
  variant: BrotherVariant;
  years?: string;
}[] = [
  {
    name: "Shri Ganga Dhar Mehta Ji",
    label: "The Eldest · Our Grandfather",
    years: "1949 — 2012",
    variant: "memorial",
  },
  {
    name: "Shri Narender Bajaj Ji",
    label: "The Pillar of Our Family",
    variant: "pillar",
  },
  {
    name: "Shri Surender Bajaj Ji",
    label: "The Pillar of Our Family",
    variant: "pillar",
  },
  {
    name: "Shri Bansi Dhar Bajaj Ji",
    label: "The Pillar of Our Family",
    variant: "pillar",
  },
  {
    name: "Shri Pawan Bajaj Ji",
    label: "The Youngest · In Loving Memory",
    variant: "memorial",
  },
];

function BrotherCard({
  brother,
  index,
}: {
  brother: (typeof BROTHERS)[number];
  index: number;
}) {
  const isMemorial = brother.variant === "memorial";
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: 0.08 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={cn(
        "relative flex w-[min(72vw,220px)] shrink-0 flex-col items-center rounded-card border border-gold/35 bg-[#0e0e0c] px-4 py-6 text-center lg:w-auto",
        "min-h-[200px] gold-shimmer transition-shadow duration-300",
        "hover:border-gold/60 hover:shadow-[0_12px_40px_rgba(212,175,55,0.18)]",
        isMemorial && "memorial-card border-slate-300/30 bg-[#0c0e10]/90"
      )}
    >
      {isMemorial ? (
        <motion.span
          className="mb-3 block text-2xl leading-none"
          aria-hidden
          animate={{ opacity: [0.55, 1, 0.65, 1], scale: [0.96, 1.04, 0.98, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          🪔
        </motion.span>
      ) : (
        <motion.div
          className="mb-4 h-1.5 w-8 rounded-full bg-gold/40"
          animate={{ scaleX: [1, 1.25, 1], opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
        />
      )}

      <h3 className="font-rajdhani text-base font-bold leading-snug text-cream sm:text-lg">
        {brother.name}
      </h3>
      {brother.years ? (
        <p className="mt-1.5 font-mono text-[11px] tracking-wide text-gold/80">
          {brother.years}
        </p>
      ) : null}
      <p
        className={cn(
          "mt-2 font-body text-xs leading-relaxed sm:text-sm",
          isMemorial ? "text-slate-300/80" : "text-gold/65"
        )}
      >
        {brother.label}
      </p>
      {isMemorial && (
        <p className="mt-auto pt-4 font-body text-xs italic text-slate-200/70">
          Forever in our hearts
        </p>
      )}
    </motion.article>
  );
}

export default function HomePage() {
  return (
    <div className="bg-kavach-black">
      {/* HERO — one composition: brand, headline, line, CTAs, product */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(212,175,55,0.14), transparent 55%), linear-gradient(180deg, #111111 0%, #080808 100%)",
          }}
        />
        <div
          className="float-blob left-[8%] top-[18%] h-40 w-40 bg-gold/20"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="float-blob right-[10%] top-[40%] h-32 w-32 bg-gold/15"
          style={{ animationDelay: "2.5s" }}
        />
        <div
          className="float-blob bottom-[12%] left-[35%] h-28 w-28 bg-gold/10"
          style={{ animationDelay: "1.2s" }}
        />
        <ECGBackground className="opacity-25" />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <ShieldPulse />
            <motion.p
              className="font-rajdhani text-xs font-semibold uppercase tracking-[0.35em] text-gold sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              GDM Technoworld Pvt. Ltd.
            </motion.p>
            <h1 className="mt-3 font-rajdhani text-5xl font-bold leading-none tracking-tight text-gold gold-text-shimmer sm:text-6xl md:text-7xl lg:text-8xl">
              KavachSaathi
            </h1>
            <motion.p
              className="mx-auto mt-5 max-w-md font-body text-base leading-relaxed text-cream-soft sm:text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
            >
              India&apos;s first smart PVC emergency health card — scan once,
              save a life.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <Link href="/order">
                <GoldButton size="lg">Order Card</GoldButton>
              </Link>
              <Link href="/activate">
                <OutlineButton size="lg">Activate</OutlineButton>
              </Link>
            </motion.div>
          </motion.div>
          <HeroProductCard />
        </div>
      </section>

      {/* FIVE BROTHERS · ONE LEGACY — visible right after hero on open */}
      <section
        className="relative overflow-hidden border-t border-kavach-border px-4 py-16 sm:px-6 sm:py-20"
        style={{ backgroundColor: "#0A0A08" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(212,175,55,0.08), transparent 55%), radial-gradient(ellipse 40% 40% at 85% 80%, rgba(200,210,220,0.04), transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.div
            className="mb-10 text-center sm:mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-rajdhani text-3xl font-bold tracking-tight text-cream sm:text-4xl md:text-5xl">
              Five Brothers · One Legacy
            </h2>
            <p className="mx-auto mt-5 max-w-2xl font-body text-sm italic leading-relaxed text-gold/70 sm:text-base">
              KavachSaathi is humbly dedicated to five brothers whose love,
              strength and sacrifices built the foundation of our family. Their
              blessings are the shield behind every card.
            </p>
          </motion.div>

          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:pb-0">
            {BROTHERS.map((b, i) => (
              <BrotherCard key={b.name} brother={b} index={i} />
            ))}
          </div>

          <motion.div
            className="mt-10 text-center sm:mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <div className="mx-auto mb-5 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="font-body text-sm italic text-cream-soft">
              Directors — Saurabh Mehta &amp; Jyoti Mehta
            </p>
            <p className="mt-1 font-body text-xs text-cream-soft/70">
              GDM Technoworld Pvt. Ltd.
            </p>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-kavach-border bg-kavach-s1 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="mb-12 text-center">
            <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              How it works
            </p>
            <h2 className="mt-2 font-rajdhani text-3xl font-bold text-cream sm:text-4xl">
              Three steps. Zero friction.
            </h2>
          </FadeIn>
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {HOW.map((step, i) => (
              <FadeIn key={step.title} delay={i * 0.1}>
                <motion.div
                  className="group text-center md:text-left"
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/25 bg-gold/5 text-gold md:mx-0"
                    whileHover={{ scale: 1.08, rotate: [-2, 2, 0] }}
                    transition={{ duration: 0.35 }}
                  >
                    <step.icon className="h-7 w-7" strokeWidth={1.5} />
                  </motion.div>
                  <p className="font-mono text-xs text-gold/70">0{i + 1}</p>
                  <h3 className="mt-1 font-rajdhani text-xl font-bold text-cream transition-colors group-hover:text-gold">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-cream-soft">
                    {step.desc}
                  </p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-kavach-border px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="mb-12 text-center">
            <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              Features
            </p>
            <h2 className="mt-2 font-rajdhani text-3xl font-bold text-cream sm:text-4xl">
              Built for the worst day.
            </h2>
            <p className="mx-auto mt-3 max-w-lg font-body text-sm text-cream-soft sm:text-base">
              When seconds matter, KavachSaathi puts the right info in a
              doctor&apos;s hands — instantly.
            </p>
          </FadeIn>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <motion.div
                  className="group flex gap-4 rounded-card border border-transparent p-3 transition-colors hover:border-gold/20 hover:bg-gold/[0.03]"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <motion.div
                    className="icon-bob mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-gold"
                    whileHover={{ scale: 1.1 }}
                  >
                    <f.icon className="h-5 w-5" strokeWidth={1.5} />
                  </motion.div>
                  <div>
                    <h3 className="font-rajdhani text-lg font-bold text-cream transition-colors group-hover:text-gold">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 font-body text-sm leading-relaxed text-cream-soft">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ORDER CTA */}
      <section className="relative overflow-hidden border-t border-kavach-border bg-kavach-s1 px-4 py-20 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(212,175,55,0.12), transparent 60%)",
          }}
        />
        <FadeIn className="relative z-10 mx-auto max-w-2xl text-center">
          <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.3em] text-gold">
            Order
          </p>
          <h2 className="mt-2 font-rajdhani text-3xl font-bold text-cream sm:text-5xl">
            Get your KavachSaathi card
          </h2>
          <p className="mx-auto mt-4 max-w-md font-body text-sm text-cream-soft sm:text-base">
            <span className="font-mono text-gold">₹649</span>
            <span className="mx-2 text-cream-soft/50">·</span>
            <span className="font-mono line-through">₹1399</span>
            <span className="mx-2 text-cream-soft/50">·</span>
            1 year validity · Renew ₹101/year
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/order">
              <GoldButton size="lg">Order on WhatsApp</GoldButton>
            </Link>
            <Link href="/login">
              <OutlineButton size="lg">Already have a card?</OutlineButton>
            </Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

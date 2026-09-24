"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { Share2, Copy, BookOpen, Sticker } from "lucide-react";
import {
  LoadingSpinner,
  OutlineButton,
  GoldButton,
  HealthCard3D,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getDemoProfile } from "@/lib/demo";
import { getEmergencyUrl, PACKAGING_STEPS } from "@/lib/product-flow";

export default function MyCardPage() {
  const router = useRouter();
  const { user, profile, loading, isDemo } = useAuth();
  const data = profile || (isDemo ? getDemoProfile() : null);
  const [origin, setOrigin] = useState("https://kavachsaathi.in");

  useEffect(() => {
    if (!loading && !user && !isDemo && !profile) {
      router.replace("/login?next=/my-card");
    }
  }, [loading, user, isDemo, profile, router]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Loading card..." />
      </div>
    );
  }

  const emergencyUrl = getEmergencyUrl(data.activation_code, origin);

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "KavachSaathi Emergency",
        text: `${data.full_name} — Emergency health profile`,
        url: emergencyUrl,
      });
    } else {
      await navigator.clipboard.writeText(emergencyUrl);
      toast.success("Emergency link copied");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-kavach-black grid-pattern px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md space-y-8"
      >
        <div className="text-center">
          <h1 className="font-rajdhani text-3xl font-bold text-cream">
            My Card
          </h1>
          <p className="mt-1 font-mono text-gold">{data.health_id}</p>
        </div>

        <div className="mx-auto w-full max-w-[360px]">
          <HealthCard3D
            bloodGroup={data.blood_group}
            activationCode={data.activation_code}
            interactive
          />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-card border border-gold/40 bg-kavach-s1 p-6 shadow-gold-sm">
          <div className="flex items-center gap-2">
            <Sticker className="h-5 w-5 text-gold" />
            <p className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-gold">
              Your unique QR sticker
            </p>
          </div>
          <p className="text-center font-body text-xs text-cream-soft">
            This is the QR from your box. Stick it on the back of your PVC card.
            After activation, scanning it shows only your details.
          </p>
          <div className="rounded-card bg-cream p-4">
            <QRCode value={emergencyUrl} size={160} fgColor="#080808" />
          </div>
          <p className="break-all text-center font-mono text-[10px] text-cream-soft">
            {emergencyUrl}
          </p>
          <div className="flex w-full gap-2">
            <OutlineButton
              fullWidth
              onClick={() => {
                navigator.clipboard.writeText(emergencyUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-4 w-4" />
              Copy
            </OutlineButton>
            <GoldButton fullWidth onClick={share}>
              <Share2 className="h-4 w-4" />
              Share
            </GoldButton>
          </div>
        </div>

        <div className="rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-rajdhani text-lg font-bold text-cream">
            <BookOpen className="h-5 w-5 text-gold" />
            Box → Card → Scan
          </h2>
          <ol className="space-y-3">
            {PACKAGING_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="font-mono text-sm text-gold">0{i + 1}</span>
                <div>
                  <p className="font-rajdhani font-semibold text-cream">
                    {s.title}
                  </p>
                  <p className="font-body text-xs text-cream-soft">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </motion.div>
    </div>
  );
}

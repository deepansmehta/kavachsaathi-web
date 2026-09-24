"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Shield } from "lucide-react";
import {
  GoldButton,
  OutlineButton,
  GoldInput,
  ECGBackground,
  LoadingSpinner,
  PinInput,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { user, profile, loading, isDemo, loginWithPin } = useAuth();

  const [tab, setTab] = useState<"phone" | "health_id">("phone");
  const [phone, setPhone] = useState("");
  const [healthId, setHealthId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"id" | "pin">("id");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (user || isDemo || profile)) {
      router.replace(next);
    }
  }, [user, isDemo, profile, loading, router, next]);

  const goToPin = () => {
    if (tab === "phone") {
      if (!/^[6-9]\d{9}$/.test(phone)) {
        toast.error("Enter a valid 10-digit mobile number");
        return;
      }
    } else {
      if (!/^KVS-\d{4}-[A-Z0-9]{5}$/i.test(healthId.trim())) {
        toast.error("Enter Health ID like KVS-2026-A7X3K");
        return;
      }
    }
    setStep("pin");
    setPin("");
  };

  const handleLogin = async () => {
    if (pin.length !== 4) {
      toast.error("Enter your 4-digit PIN");
      return;
    }
    setSubmitting(true);
    const identifier = tab === "phone" ? phone : healthId.trim().toUpperCase();
    const result = await loginWithPin(identifier, pin, tab);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error || "Invalid credentials");
      return;
    }
    toast.success("Welcome back!");
    router.replace(next);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Checking session..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-card border border-gold-border bg-kavach-s1/95 p-6 shadow-gold-sm sm:p-8"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card gold-gradient">
          <Shield className="h-6 w-6 text-kavach-black" />
        </div>
        <h1 className="font-rajdhani text-3xl font-bold text-cream">Login</h1>
        <p className="mt-1 font-body text-sm text-cream-soft">
          Phone / Health ID + 4-digit PIN
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-input bg-kavach-s2 p-1">
        {(
          [
            ["phone", "Phone + PIN"],
            ["health_id", "Health ID + PIN"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setStep("id");
              setPin("");
            }}
            className={cn(
              "rounded-input py-2.5 font-rajdhani text-sm font-semibold uppercase tracking-wider transition-all",
              tab === key
                ? "bg-gold text-kavach-black"
                : "text-cream-soft hover:text-cream"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {step === "id" ? (
        <div className="space-y-4">
          {tab === "phone" ? (
            <div>
              <label className="mb-1.5 block font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
                Mobile Number
              </label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-input border border-gold-border bg-kavach-s2 px-3 font-mono text-gold">
                  +91
                </span>
                <GoldInput
                  bare
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Mobile number"
                  inputMode="numeric"
                />
              </div>
            </div>
          ) : (
            <GoldInput
              label="Health ID"
              value={healthId}
              onChange={(e) => setHealthId(e.target.value.toUpperCase())}
              placeholder="KVS-2026-XXXXX"
              className="font-mono"
            />
          )}
          <GoldButton fullWidth size="lg" onClick={goToPin}>
            Continue
          </GoldButton>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-center font-body text-sm text-cream-soft">
            Enter your 4-digit PIN
            <br />
            <span className="font-mono text-gold">
              {tab === "phone" ? `+91 ${phone}` : healthId.toUpperCase()}
            </span>
          </p>
          <PinInput value={pin} onChange={setPin} disabled={submitting} />
          <GoldButton
            fullWidth
            size="lg"
            loading={submitting}
            onClick={handleLogin}
          >
            Login
          </GoldButton>
          <div className="flex items-center justify-between">
            <OutlineButton
              size="sm"
              onClick={() => {
                setStep("id");
                setPin("");
              }}
            >
              Back
            </OutlineButton>
            <Link
              href="/forgot-pin"
              className="font-rajdhani text-sm font-semibold text-gold hover:underline"
            >
              Forgot PIN?
            </Link>
          </div>
        </div>
      )}

      <p className="mt-6 text-center font-body text-sm text-cream-soft">
        New card?{" "}
        <Link href="/activate" className="font-semibold text-gold hover:underline">
          Activate here
        </Link>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-30" />
      <div className="relative z-10 mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <Suspense fallback={<LoadingSpinner className="py-20" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { KeyRound } from "lucide-react";
import {
  GoldButton,
  OutlineButton,
  ECGBackground,
  LoadingSpinner,
  PinInput,
} from "@/components/ui";
import { hashPin } from "@/lib/firebase";

function ResetPinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"new" | "confirm">("new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      setError("Invalid or missing reset token");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/reset-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, validateOnly: true }),
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          setValid(true);
          setName(data.name || "");
        } else {
          setValid(false);
          setError(data.error || "Invalid or expired reset link");
        }
      } catch {
        setValid(false);
        setError("Network error. Try again.");
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    if (pin.length !== 4) {
      toast.error("Enter a 4-digit PIN");
      return;
    }
    if (step === "new") {
      setStep("confirm");
      return;
    }
    if (pin !== confirm) {
      toast.error("PINs do not match");
      setConfirm("");
      return;
    }
    setSaving(true);
    try {
      const newPinHash = await hashPin(pin);
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPinHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Reset failed");
        setSaving(false);
        return;
      }
      toast.success("PIN updated! Please login.");
      router.replace("/login");
    } catch {
      toast.error("Network error");
      setSaving(false);
    }
  };

  if (checking) {
    return <LoadingSpinner className="py-20" label="Validating link..." />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-card border border-gold-border bg-kavach-s1/95 p-6 shadow-gold-sm sm:p-8"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-gold-faint text-gold">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="font-rajdhani text-3xl font-bold text-cream">
          Reset PIN
        </h1>
        {valid && name && (
          <p className="mt-1 font-body text-sm text-cream-soft">Hi, {name}</p>
        )}
      </div>

      {!valid ? (
        <div className="space-y-4 text-center">
          <p className="font-body text-sm text-danger">{error}</p>
          <Link href="/forgot-pin">
            <GoldButton fullWidth>Request New Link</GoldButton>
          </Link>
          <Link href="/login">
            <OutlineButton fullWidth>Back to Login</OutlineButton>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-center font-body text-sm text-cream-soft">
            {step === "new"
              ? "Choose a new 4-digit PIN"
              : "Confirm your new PIN"}
          </p>
          {step === "new" ? (
            <PinInput value={pin} onChange={setPin} />
          ) : (
            <PinInput value={confirm} onChange={setConfirm} />
          )}
          <GoldButton fullWidth size="lg" loading={saving} onClick={submit}>
            {step === "new" ? "Continue" : "Save New PIN"}
          </GoldButton>
          {step === "confirm" && (
            <OutlineButton
              fullWidth
              onClick={() => {
                setStep("new");
                setConfirm("");
              }}
            >
              Back
            </OutlineButton>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function ResetPinPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-25" />
      <div className="relative z-10 mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <Suspense fallback={<LoadingSpinner className="py-20" />}>
          <ResetPinForm />
        </Suspense>
      </div>
    </div>
  );
}

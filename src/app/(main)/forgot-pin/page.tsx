"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { KeyRound, Shield } from "lucide-react";
import {
  GoldButton,
  GoldInput,
  ECGBackground,
  OutlineButton,
} from "@/components/ui";

export default function ForgotPinPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit registered mobile");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setDone(true);
    } catch {
      setDone(true); // still show success
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-25" />
      <div className="relative z-10 mx-auto flex max-w-md flex-col justify-center px-4 py-16">
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
              Forgot PIN
            </h1>
            <p className="mt-1 font-body text-sm text-cream-soft">
              Enter your registered phone number
            </p>
          </div>

          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/20 text-success">
                <Shield className="h-7 w-7" />
              </div>
              <p className="font-rajdhani text-lg font-semibold text-cream">
                Request received
              </p>
              <p className="font-body text-sm leading-relaxed text-cream-soft">
                Humari team{" "}
                <span className="text-gold">gdmtechnoworld@gmail.com</span> se
                reset link bhejegi — apna phone / email check karo. Link 24
                hours valid rahega.
              </p>
              <Link href="/login">
                <GoldButton fullWidth className="mt-4">
                  Back to Login
                </GoldButton>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
                  Registered Mobile
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
              <GoldButton fullWidth size="lg" loading={loading} onClick={submit}>
                Request Reset Link
              </GoldButton>
              <Link href="/login">
                <OutlineButton fullWidth>Back to Login</OutlineButton>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

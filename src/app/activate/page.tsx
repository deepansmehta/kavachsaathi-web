"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { Shield } from "lucide-react";
import {
  GoldButton,
  OutlineButton,
  GoldInput,
  StepIndicator,
  TagInput,
  ECGBackground,
  PinInput,
} from "@/components/ui";
import {
  BLOOD_GROUPS,
  RELATIONS,
  emptyContact,
  emptyProfile,
} from "@/lib/types";
import type { BloodGroup, EmergencyContact } from "@/lib/types";
import { hashPin, loginWithCustomToken } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { cn, setSessionCookie } from "@/lib/utils";

const DRAFT_KEY = "kavach_activate_draft";
const STEPS = ["Code", "Health", "PIN"];

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -280 : 280, opacity: 0 }),
};

export default function ActivatePage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [healthIdPreview, setHealthIdPreview] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinPhase, setPinPhase] = useState<"set" | "confirm">("set");
  const [profile, setProfile] = useState(emptyProfile());
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setStep(Math.min(draft.step || 0, 2));
      setCode(draft.code || "");
      setPhone(draft.phone || "");
      setHealthIdPreview(draft.health_id || "");
      if (draft.profile) setProfile({ ...emptyProfile(), ...draft.profile });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (done) return;
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        step,
        code,
        phone,
        health_id: healthIdPreview,
        profile,
      })
    );
  }, [step, code, phone, healthIdPreview, profile, done]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const verifyCode = async () => {
    setCodeError("");
    if (code.length !== 4) {
      setCodeError("Enter the 4-digit code from the back of your card");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.valid) {
        setCodeError(data.error || "Invalid code");
        return;
      }
      setHealthIdPreview(data.card?.health_id || "");
      toast.success("Card verified");
      go(1);
    } catch {
      setCodeError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const setField = <K extends keyof typeof profile>(
    key: K,
    value: (typeof profile)[K]
  ) => setProfile((p) => ({ ...p, [key]: value }));

  const setContact = (
    which: "emergency_contact_1" | "emergency_contact_2",
    patch: Partial<EmergencyContact>
  ) =>
    setProfile((p) => ({
      ...p,
      [which]: { ...(p[which] || emptyContact()), ...patch },
    }));

  const validateHealth = () => {
    if (!profile.full_name.trim()) {
      toast.error("Full name required");
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Valid 10-digit mobile required");
      return false;
    }
    if (!profile.dob) {
      toast.error("Date of birth required");
      return false;
    }
    if (!profile.blood_group) {
      toast.error("Blood group required");
      return false;
    }
    if (
      !profile.emergency_contact_1.name ||
      !/^[6-9]\d{9}$/.test(profile.emergency_contact_1.phone)
    ) {
      toast.error("Emergency contact 1 required");
      return false;
    }
    return true;
  };

  const finalize = async () => {
    if (pin.length !== 4) {
      toast.error("Enter a 4-digit PIN");
      return;
    }
    if (pinPhase === "set") {
      setPinPhase("confirm");
      setPinConfirm("");
      return;
    }
    if (pin !== pinConfirm) {
      toast.error("PINs do not match");
      setPinConfirm("");
      return;
    }

    setLoading(true);
    try {
      const pinHash = await hashPin(pin);
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activationCode: code,
          phone,
          pinHash,
          healthProfile: {
            full_name: profile.full_name,
            dob: profile.dob,
            blood_group: profile.blood_group,
            allergies: profile.allergies,
            medical_conditions: profile.medical_conditions,
            emergency_contacts: [
              profile.emergency_contact_1,
              profile.emergency_contact_2,
            ].filter((c) => c.name || c.phone),
            emergency_contact_1: profile.emergency_contact_1,
            emergency_contact_2: profile.emergency_contact_2,
            doctor_name: profile.doctor_name,
            doctor_phone: profile.doctor_phone,
            doctor_clinic: profile.doctor_clinic,
            insurance_number: profile.insurance_number,
            gender: profile.gender,
            address: profile.address,
            medications: profile.medications,
            organ_donor: profile.organ_donor,
            blood_donor: profile.blood_donor,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.customToken) {
        toast.error(data.error || "Activation failed");
        setLoading(false);
        return;
      }

      await loginWithCustomToken(data.customToken);
      setSessionCookie(true);
      await refreshProfile();
      localStorage.removeItem(DRAFT_KEY);
      setDone(true);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#D4AF37", "#F2D060", "#E6DFC8"],
      });
      toast.success(`Activated! ${data.healthId || data.health_id}`);
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-25" />
      <div className="relative z-10 mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card gold-gradient">
            <Shield className="h-6 w-6 text-kavach-black" />
          </div>
          <h1 className="font-rajdhani text-3xl font-bold text-cream sm:text-4xl">
            Activate Card
          </h1>
          <p className="mt-1 font-body text-sm text-cream-soft">
            3 steps · Phone + PIN · No SMS
          </p>
        </div>

        <StepIndicator steps={STEPS} current={step} className="mb-8" />

        <div className="overflow-hidden rounded-card border border-gold-border bg-kavach-s1/95 p-5 shadow-gold-sm sm:p-8">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 && (
              <motion.div
                key="code"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-gold">
                    Step 1
                  </p>
                  <h2 className="mt-1 font-rajdhani text-2xl font-bold text-cream">
                    Activation Code
                  </h2>
                  <p className="mt-1 font-body text-sm text-cream-soft">
                    Enter the 4-digit code from the sticker inside your box
                  </p>
                </div>

                <div className="rounded-card border border-gold/25 bg-kavach-s2/50 p-4 text-left">
                  <p className="font-rajdhani text-xs font-bold uppercase tracking-widest text-gold">
                    From your box
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 font-body text-xs leading-relaxed text-cream-soft sm:text-sm">
                    <li>
                      Cards look the same — your unique QR is on a small sticker
                      in the box (with a 4-digit code).
                    </li>
                    <li>
                      Stick that QR on the back of your PVC card (QR area).
                    </li>
                    <li>
                      Type the same 4-digit code below to link the card to your
                      profile.
                    </li>
                  </ol>
                </div>

                <PinInput
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setCodeError("");
                  }}
                  error={codeError}
                />
                {healthIdPreview && (
                  <p className="text-center font-mono text-sm text-gold">
                    {healthIdPreview}
                  </p>
                )}
                <GoldButton
                  fullWidth
                  size="lg"
                  loading={loading}
                  onClick={verifyCode}
                >
                  Continue
                </GoldButton>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="health"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-gold">
                    Step 2
                  </p>
                  <h2 className="mt-1 font-rajdhani text-2xl font-bold text-cream">
                    Health Profile
                  </h2>
                </div>

                <GoldInput
                  label="Full Name"
                  value={profile.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                  placeholder="As on ID"
                />

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
                      placeholder="9876543210"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <GoldInput
                  label="Date of Birth"
                  type="date"
                  value={profile.dob}
                  onChange={(e) => setField("dob", e.target.value)}
                />

                <div>
                  <label className="mb-1.5 block font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
                    Blood Group
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {BLOOD_GROUPS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() =>
                          setField("blood_group", bg as BloodGroup)
                        }
                        className={cn(
                          "rounded-input border py-2.5 font-mono text-sm font-bold transition-all",
                          profile.blood_group === bg
                            ? "border-danger bg-danger/20 text-danger"
                            : "border-gold-border bg-kavach-s2 text-cream-soft hover:border-gold"
                        )}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <TagInput
                  label="Allergies"
                  value={profile.allergies}
                  onChange={(v) => setField("allergies", v)}
                  placeholder="e.g. Penicillin"
                />
                <TagInput
                  label="Medical Conditions"
                  value={profile.medical_conditions}
                  onChange={(v) => setField("medical_conditions", v)}
                  placeholder="e.g. Diabetes"
                />

                <div className="space-y-3 rounded-card border border-kavach-border bg-kavach-s2/50 p-4">
                  <p className="font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
                    Emergency Contact 1
                  </p>
                  <GoldInput
                    label="Name"
                    value={profile.emergency_contact_1.name}
                    onChange={(e) =>
                      setContact("emergency_contact_1", { name: e.target.value })
                    }
                  />
                  <GoldInput
                    label="Phone"
                    value={profile.emergency_contact_1.phone}
                    onChange={(e) =>
                      setContact("emergency_contact_1", {
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    inputMode="numeric"
                  />
                  <div>
                    <label className="mb-1.5 block font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
                      Relation
                    </label>
                    <select
                      value={profile.emergency_contact_1.relation}
                      onChange={(e) =>
                        setContact("emergency_contact_1", {
                          relation: e.target.value,
                        })
                      }
                      className="w-full rounded-input border border-gold-border bg-kavach-s2 px-3 py-2.5 font-body text-cream outline-none focus:border-gold"
                    >
                      <option value="">Select</option>
                      {RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 rounded-card border border-kavach-border bg-kavach-s2/50 p-4">
                  <p className="font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
                    Emergency Contact 2 (optional)
                  </p>
                  <GoldInput
                    label="Name"
                    value={profile.emergency_contact_2.name}
                    onChange={(e) =>
                      setContact("emergency_contact_2", { name: e.target.value })
                    }
                  />
                  <GoldInput
                    label="Phone"
                    value={profile.emergency_contact_2.phone}
                    onChange={(e) =>
                      setContact("emergency_contact_2", {
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    inputMode="numeric"
                  />
                </div>

                <GoldInput
                  label="Doctor Name"
                  value={profile.doctor_name}
                  onChange={(e) => setField("doctor_name", e.target.value)}
                />
                <GoldInput
                  label="Doctor Phone"
                  value={profile.doctor_phone}
                  onChange={(e) =>
                    setField(
                      "doctor_phone",
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  inputMode="numeric"
                />
                <GoldInput
                  label="Insurance Number"
                  value={profile.insurance_number}
                  onChange={(e) =>
                    setField("insurance_number", e.target.value.trim())
                  }
                  placeholder="Policy / Member ID"
                  className="font-mono"
                />
                <p className="-mt-2 font-body text-xs text-cream-soft">
                  Shown when someone scans your emergency QR
                </p>

                <div className="flex gap-3">
                  <OutlineButton fullWidth onClick={() => go(0)}>
                    Back
                  </OutlineButton>
                  <GoldButton
                    fullWidth
                    size="lg"
                    onClick={() => {
                      if (validateHealth()) go(2);
                    }}
                  >
                    Continue
                  </GoldButton>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="pin"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="font-rajdhani text-sm font-semibold uppercase tracking-widest text-gold">
                    Step 3
                  </p>
                  <h2 className="mt-1 font-rajdhani text-2xl font-bold text-cream">
                    {pinPhase === "set" ? "Set Your PIN" : "Confirm PIN"}
                  </h2>
                  <p className="mt-1 font-body text-sm text-cream-soft">
                    4-digit PIN · SHA-256 hashed · never stored plain
                  </p>
                </div>
                <PinInput
                  value={pinPhase === "set" ? pin : pinConfirm}
                  onChange={pinPhase === "set" ? setPin : setPinConfirm}
                  disabled={loading}
                />
                <div className="flex gap-3">
                  <OutlineButton
                    fullWidth
                    disabled={loading}
                    onClick={() => {
                      if (pinPhase === "confirm") {
                        setPinPhase("set");
                        setPinConfirm("");
                      } else go(1);
                    }}
                  >
                    Back
                  </OutlineButton>
                  <GoldButton
                    fullWidth
                    size="lg"
                    loading={loading}
                    onClick={finalize}
                  >
                    {pinPhase === "set" ? "Continue" : "Activate Card"}
                  </GoldButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

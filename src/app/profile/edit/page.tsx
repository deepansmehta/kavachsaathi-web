"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  GoldButton,
  GoldInput,
  TagInput,
  LoadingSpinner,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/firestore";
import {
  BLOOD_GROUPS,
  RELATIONS,
  GENDERS,
  emptyProfile,
} from "@/lib/types";
import type { BloodGroup, Gender, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getDemoProfile } from "@/lib/demo";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, profile, loading, isDemo, refreshProfile } = useAuth();
  const [form, setForm] = useState<UserProfile>(emptyProfile());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user && !isDemo && !profile) {
      router.replace("/login?next=/profile/edit");
    }
  }, [loading, user, isDemo, profile, router]);

  useEffect(() => {
    if (profile) setForm(profile);
    else if (isDemo) setForm(getDemoProfile());
  }, [profile, isDemo]);

  const save = async () => {
    if (form.full_name.trim().length < 2) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const uid = user?.uid || form.uid || "demo-uid";
      await updateUserProfile(uid, form);
      if (isDemo) {
        localStorage.setItem("kavach_demo_profile", JSON.stringify(form));
      } else {
        await refreshProfile();
      }
      toast.success("Profile saved");
    } catch {
      toast.error("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Loading profile..." />
      </div>
    );
  }

  const selectClass =
    "w-full rounded-input border border-gold-border bg-kavach-s2 px-4 py-3 font-body text-cream outline-none focus:border-gold";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-kavach-black grid-pattern px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg space-y-5"
      >
        <h1 className="font-rajdhani text-3xl font-bold text-cream">
          Edit Health Profile
        </h1>

        <section className="space-y-3 rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <h2 className="font-rajdhani font-bold text-gold">Personal</h2>
          <GoldInput
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <GoldInput
            label="DOB"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          <select
            className={selectClass}
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as Gender | "" })
            }
          >
            <option value="">Gender</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <GoldInput
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                    setForm({ ...form, blood_group: bg as BloodGroup })
                  }
                  className={cn(
                    "rounded-input border py-2 font-mono text-sm font-bold",
                    form.blood_group === bg
                      ? "border-danger bg-danger text-white"
                      : "border-gold-border bg-kavach-s2 text-cream"
                  )}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <h2 className="font-rajdhani font-bold text-gold">Medical</h2>
          <TagInput
            label="Allergies"
            value={form.allergies}
            onChange={(allergies) => setForm({ ...form, allergies })}
          />
          <TagInput
            label="Conditions"
            value={form.medical_conditions}
            onChange={(medical_conditions) =>
              setForm({ ...form, medical_conditions })
            }
          />
          <TagInput
            label="Medications"
            value={form.medications}
            onChange={(medications) => setForm({ ...form, medications })}
          />
          <TagInput
            label="Surgeries"
            value={form.surgeries}
            onChange={(surgeries) => setForm({ ...form, surgeries })}
          />
        </section>

        <section className="space-y-3 rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <h2 className="font-rajdhani font-bold text-gold">
            Emergency Contacts
          </h2>
          {(["emergency_contact_1", "emergency_contact_2"] as const).map(
            (key, i) => (
              <div key={key} className="space-y-2 border-t border-kavach-border pt-3 first:border-0 first:pt-0">
                <p className="font-rajdhani text-xs uppercase text-cream-soft">
                  Contact {i + 1}
                </p>
                <GoldInput
                  label="Name"
                  value={form[key].name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: { ...form[key], name: e.target.value },
                    })
                  }
                />
                <GoldInput
                  label="Phone"
                  value={form[key].phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: {
                        ...form[key],
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      },
                    })
                  }
                />
                <select
                  className={selectClass}
                  value={form[key].relation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: { ...form[key], relation: e.target.value },
                    })
                  }
                >
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
        </section>

        <section className="space-y-3 rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <h2 className="font-rajdhani font-bold text-gold">Doctor</h2>
          <GoldInput
            label="Name"
            value={form.doctor_name}
            onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
          />
          <GoldInput
            label="Phone"
            value={form.doctor_phone}
            onChange={(e) =>
              setForm({
                ...form,
                doctor_phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              })
            }
          />
          <GoldInput
            label="Clinic"
            value={form.doctor_clinic}
            onChange={(e) =>
              setForm({ ...form, doctor_clinic: e.target.value })
            }
          />
          <GoldInput
            label="Insurance Number"
            value={form.insurance_number || ""}
            onChange={(e) =>
              setForm({ ...form, insurance_number: e.target.value.trim() })
            }
            placeholder="Policy / Member ID"
            className="font-mono"
            hint="Shown on emergency QR scan"
          />
          {(
            [
              ["organ_donor", "Organ Donor"],
              ["blood_donor", "Blood Donor"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm({ ...form, [key]: !form[key] })}
              className={cn(
                "flex w-full items-center justify-between rounded-card border p-4",
                form[key]
                  ? "border-success bg-success/10"
                  : "border-gold-border bg-kavach-s2"
              )}
            >
              <span className="font-rajdhani font-semibold text-cream">
                {label}
              </span>
              <span className="font-mono text-gold">
                {form[key] ? "YES" : "NO"}
              </span>
            </button>
          ))}
        </section>

        <GoldButton fullWidth size="lg" loading={saving} onClick={save}>
          Save Profile
        </GoldButton>
      </motion.div>
    </div>
  );
}

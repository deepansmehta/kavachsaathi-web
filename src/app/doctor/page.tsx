"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import OTPInput from "react-otp-input";
import toast from "react-hot-toast";
import {
  Search,
  Stethoscope,
  AlertTriangle,
  Pill,
  Heart,
  Phone,
} from "lucide-react";
import {
  GoldButton,
  GoldInput,
  OutlineButton,
  BloodGroupBadge,
  EmergencyContactCard,
  Badge,
  ECGBackground,
  LoadingSpinner,
} from "@/components/ui";
import { getCard, getUserByActivationCode, addDoctorVisitNote } from "@/lib/firestore";
import { getDemoProfile, isDemoCode } from "@/lib/demo";
import type { UserProfile, CardDoc } from "@/lib/types";
import { telHref, formatPhone } from "@/lib/utils";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function DoctorPortalPage() {
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [card, setCard] = useState<CardDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [hospital, setHospital] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const search = async (q?: string) => {
    const trimmed = (q ?? code).trim().toUpperCase();
    if (!trimmed) {
      toast.error("Enter activation code or Health ID");
      return;
    }
    setLoading(true);
    setProfile(null);
    try {
      if (isDemoCode(trimmed) || !isFirebaseConfigured) {
        if (isDemoCode(trimmed) || trimmed.length >= 4) {
          const p = getDemoProfile({ activation_code: trimmed.slice(0, 4) });
          setProfile(p);
          setCard({
            activation_code: p.activation_code,
            health_id: p.health_id,
            tier: "PRO",
            status: "active",
            user_uid: p.uid,
          });
          setLoading(false);
          return;
        }
      }

      const found = await getUserByActivationCode(trimmed);
      const c = await getCard(trimmed);
      if (!found && trimmed.startsWith("KVS-")) {
        toast.error("Search by activation code for now");
      }
      if (!found || !c || c.status !== "active") {
        toast.error("No active patient found");
        setLoading(false);
        return;
      }
      setProfile(found);
      setCard(c);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!profile || !card) return;
    if (!doctorName.trim()) {
      toast.error("Enter your name");
      return;
    }
    setSavingNote(true);
    try {
      await addDoctorVisitNote({
        activation_code: card.activation_code,
        user_uid: profile.uid,
        scanned_by: doctorName,
        hospital,
        notes,
      });
      toast.success("Visit note saved");
      setNotes("");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-kavach-black grid-pattern">
      <ECGBackground className="opacity-25" />
      <div className="relative z-10 mx-auto max-w-lg px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-gold-faint text-gold">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="font-rajdhani text-3xl font-bold text-cream">
            Doctor Portal
          </h1>
          <p className="mt-2 font-body text-cream-soft">
            Look up patient by activation code. Add visit notes.
          </p>
        </motion.div>

        <div className="mb-6 rounded-card border border-kavach-border bg-kavach-s1 p-5">
          <p className="mb-3 font-rajdhani text-xs font-bold uppercase tracking-widest text-gold">
            Enter Code
          </p>
          <OTPInput
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            numInputs={4}
            inputType="text"
            containerStyle={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "16px",
            }}
            renderInput={(props) => (
              <input
                {...props}
                className="!h-12 !w-12 rounded-input border border-gold-border bg-kavach-s2 text-center font-mono text-xl text-gold outline-none focus:border-gold"
              />
            )}
          />
          <GoldInput
            label="Or paste Health ID / code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Health ID or card code"
          />
          <GoldButton
            fullWidth
            className="mt-4"
            loading={loading}
            onClick={() => search()}
          >
            <Search className="h-4 w-4" />
            Find Patient
          </GoldButton>
        </div>

        {loading && <LoadingSpinner className="py-10" />}

        {profile && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 rounded-card border border-kavach-border bg-kavach-s1 p-5"
          >
            <div className="flex flex-col items-center">
              <BloodGroupBadge bloodGroup={profile.blood_group} size="xl" />
              <h2 className="mt-4 font-rajdhani text-2xl font-bold text-cream">
                {profile.full_name}
              </h2>
              <p className="font-mono text-sm text-gold">{profile.health_id}</p>
              {profile.dob && (
                <p className="font-body text-sm text-cream-soft">
                  DOB: {profile.dob} · {profile.gender}
                </p>
              )}
              {(profile.height_cm || profile.weight_kg) && (
                <p className="font-mono text-xs text-cream-soft">
                  {profile.height_cm ? `${profile.height_cm} cm` : ""}{" "}
                  {profile.weight_kg ? `· ${profile.weight_kg} kg` : ""}
                </p>
              )}
            </div>

            {profile.organ_donor && (
              <div className="flex items-center gap-2 rounded-card border border-success/40 bg-success/15 px-3 py-2">
                <Heart className="h-5 w-5 fill-success text-success" />
                <span className="font-rajdhani font-semibold text-success">
                  Organ Donor
                </span>
              </div>
            )}

            <div className="space-y-2">
              <EmergencyContactCard contact={profile.emergency_contact_1} />
              <EmergencyContactCard contact={profile.emergency_contact_2} />
            </div>

            {profile.allergies.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 font-rajdhani text-xs font-bold uppercase text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" /> Allergies
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a) => (
                    <Badge key={a} variant="red">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.medical_conditions.length > 0 && (
              <div>
                <p className="mb-2 font-rajdhani text-xs font-bold uppercase text-orange-400">
                  Conditions
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.medical_conditions.map((c) => (
                    <Badge key={c} variant="orange">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.medications.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 font-rajdhani text-xs font-bold uppercase text-blue-400">
                  <Pill className="h-3.5 w-3.5" /> Meds
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.medications.map((m) => (
                    <Badge key={m} variant="blue">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.surgeries?.length > 0 && (
              <div>
                <p className="mb-2 font-rajdhani text-xs font-bold uppercase text-cream-soft">
                  Surgeries
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.surgeries.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(profile.doctor_name || profile.doctor_phone) && (
              <div className="rounded-card border border-kavach-border bg-kavach-s2 p-3">
                <p className="font-rajdhani font-semibold text-cream">
                  {profile.doctor_name}
                </p>
                {profile.doctor_clinic && (
                  <p className="font-body text-xs text-cream-soft">
                    {profile.doctor_clinic}
                  </p>
                )}
                {profile.doctor_phone && (
                  <a
                    href={telHref(profile.doctor_phone)}
                    className="mt-1 inline-flex items-center gap-1 font-mono text-sm text-gold"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {formatPhone(profile.doctor_phone)}
                  </a>
                )}
              </div>
            )}

            {/* Visit notes */}
            <div className="space-y-3 border-t border-kavach-border pt-4">
              <h3 className="font-rajdhani font-bold text-gold">Add Visit Note</h3>
              <GoldInput
                label="Your Name"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
              />
              <GoldInput
                label="Hospital"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
              />
              <div>
                <label className="mb-1.5 block font-rajdhani text-sm font-semibold uppercase tracking-widest text-cream-soft">
                  Notes / Diagnosis / Prescription
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-input border border-gold-border bg-kavach-s2 px-4 py-3 font-body text-cream outline-none focus:border-gold"
                />
              </div>
              <GoldButton fullWidth loading={savingNote} onClick={saveNote}>
                Save Visit Note
              </GoldButton>
              <OutlineButton fullWidth onClick={() => setProfile(null)}>
                Clear Patient
              </OutlineButton>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

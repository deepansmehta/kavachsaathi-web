"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Shield, Plus, Trash2, Printer } from "lucide-react";import {
  GoldButton,
  OutlineButton,
  GoldInput,
  TagInput,
  ECGBackground,
} from "@/components/ui";
import { BLOOD_GROUPS, RELATIONS } from "@/lib/types";
import { COMMON_TPAS } from "@/lib/documentTypes";
import type { BloodGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pack3ProfileTools } from "@/components/profile/Pack3ProfileTools";
import {
  CRITICAL_ALERT_OPTIONS,
  profileCompleteness,
  type CriticalAlerts,
  type OrganDonorValue,
} from "@/lib/profileFields";

type Contact = { name: string; phone: string; relation?: string };
type Captcha = { token: string; question: string };

type Profile = {
  id: string;
  health_id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  emergency_contacts: Contact[];
  family_doctor: { name: string; phone: string } | null;
  familyDoctorName?: string;
  familyDoctorPhone?: string;
  photo_url?: string | null;
  city?: string;
  fullAddress?: string;
  organDonor?: OrganDonorValue;
  preferredHospital?: string;
  criticalAlerts?: CriticalAlerts;
  abhaId?: string;
  gender?: string;
  dateOfBirth?: string;
  occupation?: string;
  alternateContact?: string;
  hasFamilyPhysician?: boolean | null;
  insurance?: {
    coverageType?: string;
    private?: {
      insurerName?: string;
      policyNumber?: string;
      policyHolderName?: string;
      validTill?: string;
      tpaName?: string;
      memberId?: string;
      isGroupPolicy?: boolean;
      corporateName?: string;
      employeeId?: string;
    };
    government?: { schemeName?: string; govtCardNumber?: string };
    otherMediclaim?: {
      hasOther?: boolean;
      companyName?: string;
      policyNumber?: string;
    };
  } | null;
  cardStatus?: "unactivated" | "activated" | "blocked";
  validTill?: string | null;
  validFrom?: string | null;
};

type ScanRow = {
  id: string;
  scannedAtIST: string;
  cityApprox: string | null;
  locationShared: boolean;
  emergencyMode: boolean;
  sectionsRendered?: string[];
};

type Mode = "login" | "forgot" | "edit";

export default function MyProfilePage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [accessLogs, setAccessLogs] = useState<
    {
      id: string;
      mode: string;
      hospitalName: string | null;
      staffName: string | null;
      atIST: string;
    }[]
  >([]);
  const [newScans, setNewScans] = useState(0);
  const [sectionsNote, setSectionsNote] = useState("");
  const [includePrivatePrint, setIncludePrivatePrint] = useState(false);
  const [blockPin, setBlockPin] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const [fpPhone, setFpPhone] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPin, setFpPin] = useState("");

  // Feature flags
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});

  // F5: Records Vault
  const [vaultRecords, setVaultRecords] = useState<{
    id: string;
    type: string;
    date: string;
    hospital: string;
    url: string | null;
    uploadedAt?: string;
  }[]>([]);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [vaultUploading, setVaultUploading] = useState(false);
  const [vaultForm, setVaultForm] = useState({ type: "discharge_summary", date: "", hospital: "" });

  // F7: Family Plan
  const [familyGroup, setFamilyGroup] = useState<{
    groupId?: string;
    members: { healthId: string; displayName?: string; status: string; addedAt?: string }[];
  } | null>(null);
  const [familyLoaded, setFamilyLoaded] = useState(false);
  const [familyTargetId, setFamilyTargetId] = useState("");
  const [familyPin, setFamilyPin] = useState("");
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const completeness = useMemo(
    () => (profile ? profileCompleteness(profile) : { percent: 0, hint: null }),
    [profile]
  );

  const renewalSoon = useMemo(() => {
    if (!profile?.validTill) return false;
    const till = new Date(profile.validTill);
    if (Number.isNaN(till.getTime())) return false;
    const days = (till.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }, [profile?.validTill]);

  const loadScans = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/scans");
      if (!res.ok) return;
      const data = await res.json();
      setScans(data.scans || []);
      setAccessLogs(data.accessLogs || []);
      setNewScans(Number(data.newSinceLastVisit || 0));
      setSectionsNote(String(data.publicSectionsNote || ""));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/me");
        if (res.ok) {
          const data = await res.json();
          setProfile(normalizeProfile(data.profile));
          setMode("edit");
          await loadScans();
        }
      } catch {
        /* ignore */
      } finally {
        setChecking(false);
      }
    })();
  }, [loadScans]);

  // Load feature flags once
  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFeatureFlags(d.flags || {}))
      .catch(() => {});
  }, []);

  // Load vault when mode=edit and feature on
  useEffect(() => {
    if (mode === "edit" && featureFlags.recordsVault && !vaultLoaded) {
      setVaultLoaded(true);
      fetch("/api/vault")
        .then((r) => r.json())
        .then((d) => setVaultRecords(d.records || []))
        .catch(() => {});
    }
  }, [mode, featureFlags.recordsVault, vaultLoaded]);

  // Load family plan when mode=edit and feature on
  useEffect(() => {
    if (mode === "edit" && featureFlags.familyPlan && !familyLoaded) {
      setFamilyLoaded(true);
      fetch("/api/family")
        .then((r) => r.json())
        .then((d) => {
          setFamilyGroup(d);
          // Check for pending invitation
          if (d.pending) setPendingGroupId(String(d.pending));
        })
        .catch(() => {});
    }
  }, [mode, featureFlags.familyPlan, familyLoaded]);

  const login = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          pin,
          captchaToken: captcha?.token,
          captchaAnswer,
        }),
      });
      const data = await res.json();
      if (data.captchaRequired && data.captcha) {
        setCaptcha(data.captcha);
        toast.error(data.error || "Complete CAPTCHA");
        return;
      }
      if (!res.ok) {
        if (typeof data.attemptsLeft === "number") {
          toast.error(
            `${data.error || "Login failed"} (${data.attemptsLeft} attempts left)`
          );
        } else {
          toast.error(data.error || "Login failed");
        }
        return;
      }
      const me = await fetch("/api/profile/me");
      const meData = await me.json();
      setProfile(normalizeProfile(meData.profile));
      setMode("edit");
      await loadScans();
      toast.success("Welcome back");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fpPhone,
          activation_code: fpCode,
          new_pin: fpPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Reset failed");
        return;
      }
      toast.success("PIN reset — log in now");
      setMode("login");
      setPin(fpPin);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/profile/me", { method: "DELETE" });
    setProfile(null);
    setScans([]);
    setMode("login");
    setPin("");
  };

  const save = async () => {
    if (!profile) return;
    if (!profile.city || profile.city.trim().length < 2) {
      toast.error("City is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          blood_group: profile.blood_group,
          city: profile.city,
          fullAddress: profile.fullAddress,
          organDonor: profile.organDonor,
          preferredHospital: profile.preferredHospital,
          criticalAlerts: profile.criticalAlerts,
          abhaId: profile.abhaId,
          allergies: profile.allergies,
          chronic_conditions: profile.chronic_conditions,
          medications: profile.medications,
          emergency_contacts: profile.emergency_contacts,
          familyDoctorName: profile.familyDoctorName,
          familyDoctorPhone: profile.familyDoctorPhone,
          family_doctor: {
            name: profile.familyDoctorName || profile.family_doctor?.name || "",
            phone:
              profile.familyDoctorPhone || profile.family_doctor?.phone || "",
          },
          photo_url: profile.photo_url,
          gender: profile.gender || "",
          dateOfBirth: profile.dateOfBirth || "",
          occupation: profile.occupation || "",
          alternateContact: profile.alternateContact || "",
          hasFamilyPhysician: profile.hasFamilyPhysician ?? null,
          insuranceExtras: {
            tpaName: profile.insurance?.private?.tpaName || "",
            memberId: profile.insurance?.private?.memberId || "",
            isGroupPolicy: Boolean(profile.insurance?.private?.isGroupPolicy),
            corporateName: profile.insurance?.private?.corporateName || "",
            employeeId: profile.insurance?.private?.employeeId || "",
            otherMediclaim: {
              hasOther: Boolean(profile.insurance?.otherMediclaim?.hasOther),
              companyName: profile.insurance?.otherMediclaim?.companyName || "",
              policyNumber: profile.insurance?.otherMediclaim?.policyNumber || "",
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      toast.success("Profile saved");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const markReviewed = async () => {
    const res = await fetch("/api/profile/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-reviewed" }),
    });
    if (res.ok) {
      setNewScans(0);
      toast.success("Marked as reviewed");
    }
  };

  const toggleBlock = async (action: "block" | "unblock") => {
    if (!/^\d{4,6}$/.test(blockPin)) {
      toast.error("Re-enter your PIN");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pin: blockPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      setProfile((p) =>
        p
          ? {
              ...p,
              cardStatus: action === "block" ? "blocked" : "activated",
            }
          : p
      );
      setBlockPin("");
      toast.success(action === "block" ? "Card blocked" : "Card unblocked");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  // F5: Upload vault record
  const uploadVaultRecord = async (file: File) => {
    setVaultUploading(true);
    try {
      // Get signed PUT URL
      const signRes = await fetch("/api/vault/signed-put", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) { toast.error(signData.error || "Failed to get upload URL"); return; }

      // Upload file
      const putRes = await fetch(signData.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) { toast.error("Upload failed"); return; }

      // Confirm
      const confirmRes = await fetch("/api/vault/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: signData.path,
          contentType: file.type,
          type: vaultForm.type,
          date: vaultForm.date,
          hospital: vaultForm.hospital,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) { toast.error(confirmData.error || "Confirm failed"); return; }

      toast.success("Record uploaded");
      // Refresh vault
      const vRes = await fetch("/api/vault");
      const vData = await vRes.json();
      setVaultRecords(vData.records || []);
      setVaultForm({ type: "discharge_summary", date: "", hospital: "" });
    } catch {
      toast.error("Upload error");
    } finally {
      setVaultUploading(false);
    }
  };

  // F5: Delete vault record
  const deleteVaultRecord = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    const res = await fetch(`/api/vault/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVaultRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Record deleted");
    } else {
      toast.error("Delete failed");
    }
  };

  // F7: Link family member
  const linkFamilyMember = async () => {
    if (!familyTargetId.trim()) { toast.error("Enter Health ID"); return; }
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetHealthId: familyTargetId.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Failed"); return; }
    toast.success(data.message || "Invitation sent");
    setFamilyTargetId("");
    // Refresh family
    const fRes = await fetch("/api/family");
    const fData = await fRes.json();
    setFamilyGroup(fData);
  };

  // F7: Confirm family invitation with PIN
  const confirmFamilyInvitation = async () => {
    if (!/^\d{4,6}$/.test(familyPin)) { toast.error("Enter your PIN"); return; }
    const res = await fetch("/api/family/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: familyPin }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Failed"); return; }
    toast.success("Family link confirmed");
    setFamilyPin("");
    setPendingGroupId(null);
    const fRes = await fetch("/api/family");
    const fData = await fRes.json();
    setFamilyGroup(fData);
  };

  // F7: Leave family group
  const leaveFamilyGroup = async () => {
    const leavePin = prompt("Enter your PIN to leave family group");
    if (!leavePin || !/^\d{4,6}$/.test(leavePin)) { toast.error("Invalid PIN"); return; }
    const res = await fetch("/api/family", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: leavePin }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Failed"); return; }
    toast.success("Left family group");
    setFamilyGroup(null);
  };

  if (checking) {
    return (
      <Shell>
        <p className="text-center text-[var(--text-soft)]">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-profile,
          #print-profile * {
            visibility: visible !important;
          }
          #print-profile {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: #000 !important;
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3 no-print">
          <Shield className="h-8 w-8 text-[var(--gold)]" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
              Protect · Inform · Save
            </p>
            <h1 className="text-2xl text-white">My Profile</h1>
          </div>
        </div>

        {mode === "login" && (
          <div className="space-y-4 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
            <p className="text-sm text-[var(--text-soft)]">
              Log in with your Health ID <em>or</em> phone + the PIN you set at
              activation. This page is not linked from the QR.
            </p>
            <GoldInput
              label="Health ID or phone"
              placeholder="KVS-2026-XXXXX or 10-digit phone"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <GoldInput
              label="PIN"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            {captcha && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm text-amber-200">{captcha.question}</p>
                <GoldInput
                  label="Answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                />
              </div>
            )}
            <GoldButton className="w-full" onClick={login} disabled={loading}>
              {loading ? "…" : "Log in"}
            </GoldButton>
            <button
              type="button"
              className="w-full text-sm text-[var(--gold)]"
              onClick={() => setMode("forgot")}
            >
              Forgot PIN?
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div className="space-y-4 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
            <p className="text-sm text-[var(--text-soft)]">
              Prove you have the physical card: enter packaging activation code
              + the phone you registered.
            </p>
            <GoldInput
              label="Registered phone"
              value={fpPhone}
              onChange={(e) =>
                setFpPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
            />
            <GoldInput
              label="Activation code"
              value={fpCode}
              onChange={(e) =>
                setFpCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
            />
            <GoldInput
              label="New PIN (4–6 digits)"
              type="password"
              value={fpPin}
              onChange={(e) =>
                setFpPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
            />
            <GoldButton className="w-full" onClick={forgot} disabled={loading}>
              {loading ? "…" : "Reset PIN"}
            </GoldButton>
            <button
              type="button"
              className="w-full text-sm text-[var(--gold)]"
              onClick={() => setMode("login")}
            >
              Back to login
            </button>
          </div>
        )}

        {mode === "edit" && profile && (
          <div className="space-y-4">
            {newScans > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 no-print">
                <p className="text-sm text-amber-100">
                  Your card was scanned {newScans} time(s) since your last
                  visit
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm text-[var(--gold)]"
                  onClick={markReviewed}
                >
                  This was me / mark as reviewed
                </button>
              </div>
            )}

            <div
              id="print-profile"
              className="space-y-4 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5"
            >
              <div className="flex items-center justify-between no-print">
                <div>
                  <p className="font-mono text-sm text-[var(--gold)]">
                    {profile.health_id}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    Phone on file: {profile.phone}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    Status: {profile.cardStatus || "activated"}
                  </p>
                  {profile.validTill && (
                    <p className="text-xs text-[var(--gold)]">
                      Valid till {profile.validTill}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm text-[var(--text-soft)]"
                  onClick={logout}
                >
                  Log out
                </button>
              </div>

              {renewalSoon && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-100 no-print">
                  Renewal due soon — valid till {profile.validTill}
                </p>
              )}

              <Pack3ProfileTools
                flags={featureFlags}
                healthId={profile.health_id}
                name={profile.full_name}
                bloodGroup={profile.blood_group}
                allergies={profile.allergies || []}
                criticalTags={Object.entries(profile.criticalAlerts || {})
                  .filter(([, v]) => v)
                  .map(([k]) => k)}
                contacts={profile.emergency_contacts || []}
                validFrom={profile.validFrom}
                validTill={profile.validTill}
                cardStatus={profile.cardStatus}
                onProfileRefresh={() => {
                  void (async () => {
                    const r = await fetch("/api/profile/me");
                    if (r.ok) {
                      const d = await r.json();
                      if (d.profile) setProfile(d.profile);
                    }
                  })();
                }}
              />


              <div className="no-print">
                <div className="mb-1 flex justify-between text-xs text-[var(--text-soft)]">
                  <span>Profile completeness</span>
                  <span>{completeness.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full bg-gradient-to-r from-[#B8860B] to-[#FCE49A]"
                    style={{ width: `${completeness.percent}%` }}
                  />
                </div>
                {completeness.hint && (
                  <p className="mt-1 text-xs text-[var(--gold)]">
                    {completeness.hint}
                  </p>
                )}
              </div>

              <GoldInput
                label="Full name"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
              />

              <GoldInput
                label="City (public on emergency page)"
                value={profile.city || ""}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
              />

              <div className={includePrivatePrint ? "" : "no-print"}>
                <GoldInput
                  label="Full address (private)"
                  value={profile.fullAddress || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, fullAddress: e.target.value })
                  }
                />
                <GoldInput
                  label="ABHA ID (private)"
                  value={profile.abhaId || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      abhaId: e.target.value
                        .replace(/[^\d-]/g, "")
                        .slice(0, 17),
                    })
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--gold)]">
                  Blood group
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          blood_group: bg as BloodGroup,
                        })
                      }
                      className={cn(
                        "rounded-lg border py-2 text-sm font-semibold",
                        profile.blood_group === bg
                          ? "border-[var(--gold)] bg-[var(--gold-faint)] text-[var(--gold)]"
                          : "border-[var(--gold-border)] text-[var(--text-soft)]"
                      )}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--gold)]">
                  Organ donor
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["yes", "no", "unset"] as OrganDonorValue[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setProfile({ ...profile, organDonor: v })
                      }
                      className={cn(
                        "rounded-lg border py-2 text-sm capitalize",
                        profile.organDonor === v
                          ? "border-[var(--gold)] bg-[var(--gold-faint)] text-[var(--gold)]"
                          : "border-[var(--gold-border)] text-[var(--text-soft)]"
                      )}
                    >
                      {v === "unset" ? "Prefer not" : v}
                    </button>
                  ))}
                </div>
              </div>

              <GoldInput
                label="Preferred hospital"
                value={profile.preferredHospital || ""}
                onChange={(e) =>
                  setProfile({ ...profile, preferredHospital: e.target.value })
                }
              />

              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--gold)]">
                  Critical alerts
                </label>
                <div className="flex flex-wrap gap-2">
                  {CRITICAL_ALERT_OPTIONS.map((opt) => {
                    const tags = profile.criticalAlerts?.tags || [];
                    const on = tags.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? tags.filter((x) => x !== opt)
                            : [...tags, opt];
                          setProfile({
                            ...profile,
                            criticalAlerts: {
                              tags: next,
                              otherText: profile.criticalAlerts?.otherText,
                            },
                          });
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs capitalize",
                          on
                            ? "border-red-400 bg-red-500/20 text-red-200"
                            : "border-[var(--gold-border)] text-[var(--text-soft)]"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {(profile.criticalAlerts?.tags || []).includes("other") && (
                  <GoldInput
                    label="Other alert"
                    value={profile.criticalAlerts?.otherText || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        criticalAlerts: {
                          tags: profile.criticalAlerts?.tags || [],
                          otherText: e.target.value,
                        },
                      })
                    }
                  />
                )}
              </div>

              <TagInput
                label="Allergies"
                value={profile.allergies}
                onChange={(allergies) => setProfile({ ...profile, allergies })}
              />
              <TagInput
                label="Chronic conditions"
                value={profile.chronic_conditions}
                onChange={(chronic_conditions) =>
                  setProfile({ ...profile, chronic_conditions })
                }
              />
              <TagInput
                label="Medications"
                value={profile.medications}
                onChange={(medications) =>
                  setProfile({ ...profile, medications })
                }
              />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <p className="text-xs uppercase tracking-wider text-[var(--gold)]">
                    Emergency contacts
                  </p>
                  {(profile.emergency_contacts?.length || 0) < 3 && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm text-[var(--gold)]"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          emergency_contacts: [
                            ...(profile.emergency_contacts || []),
                            { name: "", phone: "", relation: "Friend" },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  )}
                </div>
                {(profile.emergency_contacts || []).map((c, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-xl border border-[var(--gold-border)] p-3"
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--text-soft)]">
                        #{i + 1}
                      </span>
                      {(profile.emergency_contacts || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              emergency_contacts:
                                profile.emergency_contacts.filter(
                                  (_, idx) => idx !== i
                                ),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      )}
                    </div>
                    <GoldInput
                      label="Name"
                      value={c.name}
                      onChange={(e) => {
                        const emergency_contacts = [
                          ...profile.emergency_contacts,
                        ];
                        emergency_contacts[i] = {
                          ...c,
                          name: e.target.value,
                        };
                        setProfile({ ...profile, emergency_contacts });
                      }}
                    />
                    <GoldInput
                      label="Phone"
                      value={c.phone}
                      onChange={(e) => {
                        const emergency_contacts = [
                          ...profile.emergency_contacts,
                        ];
                        emergency_contacts[i] = {
                          ...c,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        };
                        setProfile({ ...profile, emergency_contacts });
                      }}
                      inputMode="numeric"
                    />
                    <select
                      className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                      value={c.relation || ""}
                      onChange={(e) => {
                        const emergency_contacts = [
                          ...profile.emergency_contacts,
                        ];
                        emergency_contacts[i] = {
                          ...c,
                          relation: e.target.value,
                        };
                        setProfile({ ...profile, emergency_contacts });
                      }}
                    >
                      {RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>


              <div className="space-y-3 rounded-xl border border-[var(--gold-border)] p-3">
                <p className="text-xs uppercase tracking-wider text-[var(--gold)]">
                  Insurance — optional cashless pre-fill
                </p>
                <p className="text-[11px] text-[var(--text-soft)]">
                  All fields optional. Used to pre-fill the IRDAI cashless form and admission sheet.
                </p>
                <select
                  className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                  value={profile.gender || ""}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Third Gender">Third Gender</option>
                </select>
                <GoldInput
                  label="Date of birth"
                  type="date"
                  value={profile.dateOfBirth || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, dateOfBirth: e.target.value })
                  }
                />
                <GoldInput
                  label="Occupation"
                  value={profile.occupation || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, occupation: e.target.value })
                  }
                />
                <GoldInput
                  label="Alternate contact"
                  value={profile.alternateContact || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      alternateContact: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10),
                    })
                  }
                  inputMode="numeric"
                />
                <select
                  className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                  value={
                    COMMON_TPAS.includes(
                      (profile.insurance?.private?.tpaName || "") as (typeof COMMON_TPAS)[number]
                    )
                      ? profile.insurance?.private?.tpaName || ""
                      : profile.insurance?.private?.tpaName
                        ? "Other"
                        : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    const priv = {
                      ...(profile.insurance?.private || {}),
                      tpaName: v === "Other" ? "Other" : v,
                    };
                    setProfile({
                      ...profile,
                      insurance: { ...(profile.insurance || {}), private: priv },
                    });
                  }}
                >
                  <option value="">TPA name</option>
                  {COMMON_TPAS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {(profile.insurance?.private?.tpaName === "Other" ||
                  (profile.insurance?.private?.tpaName &&
                    !COMMON_TPAS.includes(
                      profile.insurance.private.tpaName as (typeof COMMON_TPAS)[number]
                    ))) && (
                  <GoldInput
                    label="TPA name (Other)"
                    value={
                      profile.insurance?.private?.tpaName === "Other"
                        ? ""
                        : profile.insurance?.private?.tpaName || ""
                    }
                    onChange={(e) => {
                      const priv = {
                        ...(profile.insurance?.private || {}),
                        tpaName: e.target.value.trim() || "Other",
                      };
                      setProfile({
                        ...profile,
                        insurance: { ...(profile.insurance || {}), private: priv },
                      });
                    }}
                  />
                )}
                <GoldInput
                  label="Insured member / health card ID"
                  value={profile.insurance?.private?.memberId || ""}
                  onChange={(e) => {
                    const priv = {
                      ...(profile.insurance?.private || {}),
                      memberId: e.target.value,
                    };
                    setProfile({
                      ...profile,
                      insurance: { ...(profile.insurance || {}), private: priv },
                    });
                  }}
                />
                <label className="flex gap-2 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={Boolean(profile.insurance?.private?.isGroupPolicy)}
                    onChange={(e) => {
                      const priv = {
                        ...(profile.insurance?.private || {}),
                        isGroupPolicy: e.target.checked,
                      };
                      setProfile({
                        ...profile,
                        insurance: { ...(profile.insurance || {}), private: priv },
                      });
                    }}
                  />
                  Group / corporate policy
                </label>
                {profile.insurance?.private?.isGroupPolicy && (
                  <>
                    <GoldInput
                      label="Corporate name"
                      value={profile.insurance?.private?.corporateName || ""}
                      onChange={(e) => {
                        const priv = {
                          ...(profile.insurance?.private || {}),
                          corporateName: e.target.value,
                        };
                        setProfile({
                          ...profile,
                          insurance: {
                            ...(profile.insurance || {}),
                            private: priv,
                          },
                        });
                      }}
                    />
                    <GoldInput
                      label="Employee ID"
                      value={profile.insurance?.private?.employeeId || ""}
                      onChange={(e) => {
                        const priv = {
                          ...(profile.insurance?.private || {}),
                          employeeId: e.target.value,
                        };
                        setProfile({
                          ...profile,
                          insurance: {
                            ...(profile.insurance || {}),
                            private: priv,
                          },
                        });
                      }}
                    />
                  </>
                )}
                <select
                  className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                  value={
                    profile.insurance?.otherMediclaim?.hasOther === true
                      ? "yes"
                      : profile.insurance?.otherMediclaim?.hasOther === false
                        ? "no"
                        : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setProfile({
                      ...profile,
                      insurance: {
                        ...(profile.insurance || {}),
                        otherMediclaim: {
                          ...(profile.insurance?.otherMediclaim || {}),
                          hasOther: v === "yes" ? true : v === "no" ? false : undefined,
                        },
                      },
                    });
                  }}
                >
                  <option value="">Other health insurance?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {profile.insurance?.otherMediclaim?.hasOther && (
                  <>
                    <GoldInput
                      label="Other company"
                      value={profile.insurance?.otherMediclaim?.companyName || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          insurance: {
                            ...(profile.insurance || {}),
                            otherMediclaim: {
                              ...(profile.insurance?.otherMediclaim || {}),
                              companyName: e.target.value,
                            },
                          },
                        })
                      }
                    />
                    <GoldInput
                      label="Other policy number"
                      value={profile.insurance?.otherMediclaim?.policyNumber || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          insurance: {
                            ...(profile.insurance || {}),
                            otherMediclaim: {
                              ...(profile.insurance?.otherMediclaim || {}),
                              policyNumber: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </>
                )}
                <select
                  className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                  value={
                    profile.hasFamilyPhysician === true
                      ? "yes"
                      : profile.hasFamilyPhysician === false
                        ? "no"
                        : ""
                  }
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      hasFamilyPhysician:
                        e.target.value === "yes"
                          ? true
                          : e.target.value === "no"
                            ? false
                            : null,
                    })
                  }
                >
                  <option value="">Family physician?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <GoldInput
                label="Family doctor"
                value={profile.familyDoctorName || ""}
                onChange={(e) =>
                  setProfile({ ...profile, familyDoctorName: e.target.value })
                }
              />
              <GoldInput
                label="Doctor phone"
                value={profile.familyDoctorPhone || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    familyDoctorPhone: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10),
                  })
                }
                inputMode="numeric"
              />

              <div className="no-print space-y-3">
                <GoldButton className="w-full" onClick={save} disabled={loading}>
                  {loading ? "Saving…" : "Save changes"}
                </GoldButton>
                <Link href={`/card/${profile.health_id}`} className="block">
                  <OutlineButton className="w-full">
                    Preview emergency page
                  </OutlineButton>
                </Link>

                <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={includePrivatePrint}
                    onChange={(e) => setIncludePrivatePrint(e.target.checked)}
                  />
                  Include private details (address / ABHA) when printing
                </label>
                <OutlineButton
                  className="w-full"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-2 inline h-4 w-4" />
                  Print / Save as PDF
                </OutlineButton>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
              <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
                What scanners can see
              </h2>
              <p className="text-sm text-[var(--text-soft)]">
                {sectionsNote ||
                  "Name, blood group, city, medical fields, contacts, doctor, hospital, organ donor, critical alerts. Not: full address, ABHA, Health ID, activation code, or PIN."}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
              <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
                Access log (Full Details)
              </h2>
              <p className="text-xs text-[var(--text-soft)]">
                PIN unlocks, hospital emergency access, and form/sheet downloads are listed here.
              </p>
              {accessLogs.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No access yet.</p>
              ) : (
                accessLogs.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-[var(--gold-border)] p-3 text-sm"
                  >
                    <p className="text-white">
                      {l.atIST} IST · {l.mode}
                    </p>
                    {(l.hospitalName || l.staffName) && (
                      <p className="text-[var(--text-soft)]">
                        {[l.hospitalName, l.staffName].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
              <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
                Recent scans
              </h2>
              <p className="text-xs text-[var(--text-soft)]">
                Showing last 20 scans from the past 180 days. Older scans are
                not shown.
              </p>
              {scans.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No scans yet.</p>
              ) : (
                scans.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-[var(--gold-border)] p-3 text-sm"
                  >
                    <p className="text-white">{s.scannedAtIST} IST</p>
                    <p className="text-[var(--text-soft)]">
                      {s.cityApprox || "Location unavailable"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s.locationShared && (
                        <span className="rounded-full bg-[var(--gold-faint)] px-2 py-0.5 text-xs text-[var(--gold)]">
                          Location shared
                        </span>
                      )}
                      {s.emergencyMode && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                          Emergency
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {newScans > 0 && (
                <GoldButton className="w-full" onClick={markReviewed}>
                  This was me / mark as reviewed
                </GoldButton>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-red-500/30 bg-[var(--kavach-s1)] p-5 no-print">
              <h2 className="text-sm uppercase tracking-wider text-red-300">
                Lost card — block / unblock
              </h2>
              <p className="text-sm text-[var(--text-soft)]">
                Blocking hides all medical data on the public QR page. Requires
                your PIN.
              </p>
              <GoldInput
                label="Re-enter PIN"
                type="password"
                inputMode="numeric"
                value={blockPin}
                onChange={(e) =>
                  setBlockPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              {profile.cardStatus === "blocked" ? (
                <GoldButton
                  className="w-full"
                  onClick={() => toggleBlock("unblock")}
                  disabled={loading}
                >
                  Unblock card
                </GoldButton>
              ) : (
                <OutlineButton
                  className="w-full border-red-400 text-red-300"
                  onClick={() => toggleBlock("block")}
                  disabled={loading}
                >
                  Block this card
                </OutlineButton>
              )}
            </div>

            {/* F5: Records Vault */}
            {featureFlags.recordsVault && (
              <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
                <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
                  Medical records vault
                </h2>
                <p className="text-xs text-[var(--text-soft)]">
                  Upload discharge summaries, lab reports, prescriptions (PDF/JPG, 8 MB max, up to 30 records).
                  Never shared in emergency mode.
                </p>

                {/* Upload form */}
                <div className="space-y-2 rounded-xl border border-[var(--gold-border)] p-3">
                  <select
                    className="w-full rounded-lg border border-[var(--gold-border)] bg-black px-3 py-2 text-sm"
                    value={vaultForm.type}
                    onChange={(e) => setVaultForm({ ...vaultForm, type: e.target.value })}
                  >
                    <option value="discharge_summary">Discharge summary</option>
                    <option value="lab_report">Lab report</option>
                    <option value="prescription">Prescription</option>
                    <option value="other">Other</option>
                  </select>
                  <GoldInput
                    label="Date (optional)"
                    type="date"
                    value={vaultForm.date}
                    onChange={(e) => setVaultForm({ ...vaultForm, date: e.target.value })}
                  />
                  <GoldInput
                    label="Hospital / clinic (optional)"
                    value={vaultForm.hospital}
                    onChange={(e) => setVaultForm({ ...vaultForm, hospital: e.target.value })}
                  />
                  <label className="block">
                    <span className="text-xs text-[var(--gold)]">Select file (PDF / JPG / PNG)</span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="mt-1 block w-full text-sm text-[var(--text-soft)]"
                      disabled={vaultUploading || vaultRecords.length >= 30}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadVaultRecord(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {vaultUploading && <p className="text-xs text-[var(--text-soft)]">Uploading…</p>}
                  {vaultRecords.length >= 30 && (
                    <p className="text-xs text-amber-300">Maximum 30 records reached.</p>
                  )}
                </div>

                {/* Records list */}
                {vaultRecords.length > 0 && (
                  <div className="space-y-2">
                    {vaultRecords.map((r) => (
                      <div key={r.id} className="flex items-start justify-between rounded-lg border border-[var(--gold-border)] p-3 text-sm">
                        <div>
                          <p className="text-white capitalize">{r.type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-[var(--text-soft)]">
                            {r.date || "No date"} · {r.hospital || "No hospital"}
                          </p>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--gold)]">
                              Open ↗
                            </a>
                          )}
                        </div>
                        <button type="button" onClick={() => void deleteVaultRecord(r.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* F7: Family Plan */}
            {featureFlags.familyPlan && (
              <div className="space-y-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5 no-print">
                <h2 className="text-sm uppercase tracking-wider text-[var(--gold)]">
                  Family plan (linked cards)
                </h2>
                <p className="text-xs text-[var(--text-soft)]">
                  Link up to 6 KavachSaathi cards. Each member must confirm with their own PIN.
                  Profiles are never merged — linked view only.
                </p>

                {/* Pending invitation */}
                {pendingGroupId && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="mb-2 text-sm text-amber-100">You have a pending family group invitation.</p>
                    <GoldInput
                      label="Your PIN to confirm"
                      type="password"
                      inputMode="numeric"
                      value={familyPin}
                      onChange={(e) => setFamilyPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <GoldButton className="mt-2 w-full" onClick={() => void confirmFamilyInvitation()}>
                      Confirm with PIN
                    </GoldButton>
                  </div>
                )}

                {/* Link new member */}
                {(!familyGroup?.members || familyGroup.members.length < 6) && (
                  <div className="flex gap-2">
                    <GoldInput
                      label=""
                      placeholder="Target Health ID (KVS-2026-XXXXX)"
                      value={familyTargetId}
                      onChange={(e) => setFamilyTargetId(e.target.value.toUpperCase())}
                    />
                    <GoldButton onClick={() => void linkFamilyMember()}>
                      <Plus className="h-4 w-4" />
                    </GoldButton>
                  </div>
                )}

                {/* Members list */}
                {familyGroup?.members && familyGroup.members.length > 0 && (
                  <div className="space-y-2">
                    {familyGroup.members.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--gold-border)] p-3 text-sm">
                        <div>
                          <p className="font-mono text-[var(--gold)]">{m.healthId}</p>
                          {m.displayName && <p className="text-xs text-[var(--text-soft)]">{m.displayName}</p>}
                          <span className={`text-xs ${m.status === "confirmed" ? "text-emerald-400" : "text-amber-300"}`}>
                            {m.status}
                          </span>
                        </div>
                        {m.healthId !== profile.health_id && (
                          <button
                            type="button"
                            onClick={() => void leaveFamilyGroup()}
                            className="text-xs text-red-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <OutlineButton className="w-full border-red-400/50 text-red-300 text-sm" onClick={() => void leaveFamilyGroup()}>
                      Leave family group
                    </OutlineButton>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function normalizeProfile(raw: Profile): Profile {
  return {
    ...raw,
    city: raw.city || "",
    fullAddress: raw.fullAddress || "",
    organDonor: raw.organDonor || "unset",
    preferredHospital: raw.preferredHospital || "",
    criticalAlerts: raw.criticalAlerts || { tags: [] },
    abhaId: raw.abhaId || "",
    familyDoctorName:
      raw.familyDoctorName || raw.family_doctor?.name || "",
    familyDoctorPhone:
      raw.familyDoctorPhone || raw.family_doctor?.phone || "",
    gender: raw.gender || "",
    dateOfBirth: raw.dateOfBirth || "",
    occupation: raw.occupation || "",
    alternateContact: raw.alternateContact || "",
    hasFamilyPhysician:
      raw.hasFamilyPhysician === true || raw.hasFamilyPhysician === false
        ? raw.hasFamilyPhysician
        : null,
    insurance: raw.insurance || null,
    allergies: raw.allergies || [],
    chronic_conditions: raw.chronic_conditions || [],
    medications: raw.medications || [],
    emergency_contacts: raw.emergency_contacts || [],
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen px-4 py-10">
      <ECGBackground />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

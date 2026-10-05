"use client";

import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { Shield, Plus, Trash2, Camera } from "lucide-react";
import { GoldButton, GoldInput, TagInput } from "@/components/ui";
import { BLOOD_GROUPS, RELATIONS } from "@/lib/types";
import type { BloodGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CRITICAL_ALERT_OPTIONS,
  type CriticalAlerts,
  type OrganDonorValue,
} from "@/lib/profileFields";
import {
  ADDRESS_PROOF_OK_TYPES,
  COMMON_TPAS,
  GOVT_SCHEMES,
  ID_PROOF_TYPES,
  PRIVATE_INSURERS,
  type CoverageType,
  type IdProofType,
} from "@/lib/documentTypes";
import { uploadViaSignedPut } from "@/lib/clientUpload";

type Contact = { name: string; phone: string; relation: string };
type Captcha = { token: string; question: string };
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Code" },
  { n: 2, label: "Medical" },
  { n: 3, label: "Photo" },
  { n: 4, label: "IDs" },
  { n: 5, label: "Address" },
  { n: 6, label: "Insurance" },
  { n: 7, label: "PIN" },
];

export function ActivationForm({
  healthId,
  onActivated,
}: {
  healthId: string;
  onActivated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  // Step 2
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([
    { name: "", phone: "", relation: "Spouse" },
  ]);
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [city, setCity] = useState("");
  const [organDonor, setOrganDonor] = useState<OrganDonorValue>("unset");
  const [preferredHospital, setPreferredHospital] = useState("");
  const [criticalTags, setCriticalTags] = useState<string[]>([]);
  const [criticalOther, setCriticalOther] = useState("");
  const [abhaId, setAbhaId] = useState("");

  // Step 3
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 4
  const [id1Type, setId1Type] = useState<IdProofType | "">("");
  const [id1Number, setId1Number] = useState("");
  const [id1Front, setId1Front] = useState<string | null>(null);
  const [id1Back, setId1Back] = useState<string | null>(null);
  const [id2Type, setId2Type] = useState<IdProofType | "">("");
  const [id2Number, setId2Number] = useState("");
  const [id2Front, setId2Front] = useState<string | null>(null);
  const [id2Back, setId2Back] = useState<string | null>(null);

  // Step 5
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPin, setAddrPin] = useState("");
  const [sameAsId, setSameAsId] = useState<0 | 1 | null>(null);
  const [addressProofPath, setAddressProofPath] = useState<string | null>(null);

  // Step 6
  const [coverageType, setCoverageType] = useState<CoverageType | "">("");
  const [insurerName, setInsurerName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyHolder, setPolicyHolder] = useState("");
  const [validTill, setValidTill] = useState("");
  const [policyCardPath, setPolicyCardPath] = useState<string | null>(null);
  const [policyBondPath, setPolicyBondPath] = useState<string | null>(null);
  const [schemeName, setSchemeName] = useState("");
  const [govtCardNumber, setGovtCardNumber] = useState("");
  const [govtCardPath, setGovtCardPath] = useState<string | null>(null);
  // Optional cashless fields (never block activation)
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [occupation, setOccupation] = useState("");
  const [alternateContact, setAlternateContact] = useState("");
  const [tpaName, setTpaName] = useState("");
  const [tpaOther, setTpaOther] = useState("");
  const [memberId, setMemberId] = useState("");
  const [isGroupPolicy, setIsGroupPolicy] = useState(false);
  const [corporateName, setCorporateName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [hasOtherMediclaim, setHasOtherMediclaim] = useState<"" | "yes" | "no">("");
  const [otherCompany, setOtherCompany] = useState("");
  const [otherPolicyNumber, setOtherPolicyNumber] = useState("");
  const [hasFamilyPhysician, setHasFamilyPhysician] = useState<"" | "yes" | "no">("");

  // Step 7
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [consentDocs, setConsentDocs] = useState(false);
  const [consentDpdp, setConsentDpdp] = useState(false);
  const [consentLegal, setConsentLegal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const progress = useMemo(
    () => STEPS.map((s) => ({ ...s, active: s.n === step, done: s.n < step })),
    [step]
  );

  const startSession = async () => {
    if (!/^\d{4}$/.test(activationCode.trim())) {
      toast.error("Enter the 4-digit activation code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/card/activation-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_id: healthId,
          activation_code: activationCode,
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
        toast.error(data.error || "Invalid code");
        return;
      }
      setSessionReady(true);
      setStep(2);
      toast.success("Code verified — continue setup");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (kind: string, file: File | null) => {
    if (!file) return null;
    setLoading(true);
    try {
      const r = await uploadViaSignedPut({ kind, file });
      toast.success("Uploaded");
      return r.path;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (s: Step): boolean => {
    if (s === 2) {
      if (fullName.trim().length < 2) {
        toast.error("Full name required");
        return false;
      }
      if (!/^[6-9]\d{9}$/.test(phone)) {
        toast.error("Valid 10-digit mobile required");
        return false;
      }
      if (!bloodGroup) {
        toast.error("Blood group required");
        return false;
      }
      if (city.trim().length < 2) {
        toast.error("City required");
        return false;
      }
      const cleaned = contacts.filter(
        (c) => c.name.trim() && /^[6-9]\d{9}$/.test(c.phone)
      );
      if (cleaned.length < 1) {
        toast.error("At least one emergency contact required");
        return false;
      }
      return true;
    }
    if (s === 3) {
      if (!photoPath) {
        toast.error("Photo is required");
        return false;
      }
      return true;
    }
    if (s === 4) {
      if (!id1Type || !id2Type || id1Type === id2Type) {
        toast.error("Select 2 different ID types");
        return false;
      }
      if (!id1Front || !id2Front) {
        toast.error("Upload front of both IDs");
        return false;
      }
      if (id1Type === "aadhaar") {
        if (!/^\d{4}$/.test(id1Number.replace(/\D/g, "").slice(-4))) {
          toast.error("Aadhaar: enter last 4 digits only");
          return false;
        }
      } else if (!id1Number.trim()) {
        toast.error("ID 1 number required");
        return false;
      }
      if (id2Type === "aadhaar") {
        if (!/^\d{4}$/.test(id2Number.replace(/\D/g, "").slice(-4))) {
          toast.error("Aadhaar: enter last 4 digits only");
          return false;
        }
      } else if (!id2Number.trim()) {
        toast.error("ID 2 number required");
        return false;
      }
      return true;
    }
    if (s === 5) {
      if (
        !addrLine.trim() ||
        !addrCity.trim() ||
        !addrState.trim() ||
        !/^\d{6}$/.test(addrPin)
      ) {
        toast.error("Complete address with 6-digit PIN");
        return false;
      }
      if (sameAsId === 0 || sameAsId === 1) {
        const t = sameAsId === 0 ? id1Type : id2Type;
        if (!ADDRESS_PROOF_OK_TYPES.includes(t as IdProofType)) {
          toast.error("That ID type cannot be used as address proof");
          return false;
        }
      } else if (!addressProofPath) {
        toast.error("Upload address proof or select same-as-ID");
        return false;
      }
      return true;
    }
    if (s === 6) {
      if (!coverageType) {
        toast.error("Select coverage type");
        return false;
      }
      if (coverageType === "none") return true;
      if (coverageType === "private" || coverageType === "both") {
        if (
          !insurerName ||
          insurerName === "Other" ||
          !policyNumber.trim() ||
          !policyHolder.trim() ||
          !policyCardPath ||
          !policyBondPath
        ) {
          toast.error("Private insurance: all fields + card + bond required");
          return false;
        }
      }
      if (coverageType === "government" || coverageType === "both") {
        if (!schemeName || !govtCardNumber.trim() || !govtCardPath) {
          toast.error("Government scheme: scheme + card number + image required");
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(7, (s + 1) as Step) as Step);
  };

  const submit = async () => {
    if (!sessionReady) {
      toast.error("Verify activation code first");
      return;
    }
    if (!validateStep(6)) {
      setStep(6);
      return;
    }
    if (!consentPhoto || !consentDocs || !consentDpdp || !consentLegal) {
      toast.error("All consents are required (including Privacy & Terms)");
      return;
    }
    if (pin !== pinConfirm) {
      toast.error("PINs do not match");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    if (!photoPath || !id1Front || !id2Front) {
      toast.error("Required documents missing");
      return;
    }

    setLoading(true);
    try {
      const cleaned = contacts.filter(
        (c) => c.name.trim() && /^[6-9]\d{9}$/.test(c.phone)
      );
      const criticalAlerts: CriticalAlerts = {
        tags: criticalTags,
        otherText: criticalOther.trim() || undefined,
      };
      const insurance: Record<string, unknown> = { coverageType };
      if (coverageType === "private" || coverageType === "both") {
        insurance.private = {
          insurerName,
          policyNumber,
          policyHolderName: policyHolder,
          validTill: validTill || null,
          policyCardPath,
          policyBondPath,
          tpaName: (tpaName === "Other" ? tpaOther : tpaName) || null,
          memberId: memberId.trim() || null,
          isGroupPolicy,
          corporateName: isGroupPolicy ? corporateName.trim() || null : null,
          employeeId: isGroupPolicy ? employeeId.trim() || null : null,
        };
      }
      if (coverageType === "government" || coverageType === "both") {
        insurance.government = {
          schemeName,
          govtCardNumber,
          govtCardPath,
        };
      }
      if (coverageType !== "none" && hasOtherMediclaim) {
        insurance.otherMediclaim = {
          hasOther: hasOtherMediclaim === "yes",
          companyName: otherCompany.trim() || null,
          policyNumber: otherPolicyNumber.trim() || null,
        };
      }

      const res = await fetch("/api/card/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_id: healthId,
          activation_code: activationCode,
          pin,
          full_name: fullName.trim(),
          phone,
          blood_group: bloodGroup,
          city: city.trim() || addrCity.trim(),
          fullAddress: addrLine.trim(),
          organDonor,
          preferredHospital: preferredHospital.trim() || null,
          criticalAlerts,
          abhaId: abhaId.trim() || null,
          gender: gender || null,
          dateOfBirth: dateOfBirth || null,
          occupation: occupation.trim() || null,
          alternateContact: alternateContact || null,
          hasFamilyPhysician:
            hasFamilyPhysician === "yes"
              ? true
              : hasFamilyPhysician === "no"
                ? false
                : null,
          allergies,
          chronic_conditions: conditions,
          medications,
          emergency_contacts: cleaned,
          family_doctor: { name: doctorName.trim(), phone: doctorPhone },
          familyDoctorName: doctorName.trim(),
          familyDoctorPhone: doctorPhone,
          photoPath,
          idProofs: [
            {
              type: id1Type,
              number: id1Number,
              frontPath: id1Front,
              backPath: id1Back,
            },
            {
              type: id2Type,
              number: id2Number,
              frontPath: id2Front,
              backPath: id2Back,
            },
          ],
          address: {
            line: addrLine.trim(),
            city: addrCity.trim(),
            district: addrDistrict.trim() || undefined,
            state: addrState.trim(),
            pincode: addrPin,
          },
          addressProof: {
            sameAsIdIndex: sameAsId,
            path: sameAsId === null ? addressProofPath : null,
          },
          insurance,
          consents: {
            photoPublic: consentPhoto,
            docsForAdmission: consentDocs,
            dpdpConsent: consentDpdp,
          },
          requireFullDocs: true,
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
        toast.error(data.error || "Activation failed");
        return;
      }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } });
      toast.success("Card activated");
      onActivated();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#FCE49A] to-[#B8860B]">
          <Shield className="h-6 w-6 text-black" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
            Protect · Inform · Save
          </p>
          <h1 className="text-2xl font-bold text-white">Activate your card</h1>
          <p className="text-xs text-[#A8A59C]">{healthId}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {progress.map((s) => (
          <span
            key={s.n}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              s.active
                ? "bg-[#D4AF37] text-black"
                : s.done
                  ? "bg-[#D4AF37]/30 text-[#FCE49A]"
                  : "bg-[#222] text-[#666]"
            )}
          >
            {s.n}. {s.label}
          </span>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-[#D4AF37]/25 bg-[#111] p-5">
        {step === 1 && (
          <>
            <p className="text-sm text-[#A8A59C]">
              Enter the secret 4-digit activation code from your packaging.
            </p>
            <GoldInput
              label="Activation code"
              value={activationCode}
              onChange={(e) =>
                setActivationCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
              maxLength={4}
            />
            {captcha && (
              <>
                <p className="text-sm text-[#FCE49A]">{captcha.question}</p>
                <GoldInput
                  label="CAPTCHA answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                />
              </>
            )}
            <GoldButton className="w-full" disabled={loading} onClick={startSession}>
              {loading ? "Checking…" : "Continue"}
            </GoldButton>
          </>
        )}

        {step === 2 && (
          <>
            <GoldInput
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <GoldInput
              label="Mobile (10 digits)"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
            />
            <label className="block text-sm text-[#A8A59C]">Blood group</label>
            <select
              className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
            >
              <option value="">Select</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <GoldInput
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <TagInput label="Allergies" value={allergies} onChange={setAllergies} />
            <TagInput
              label="Chronic conditions"
              value={conditions}
              onChange={setConditions}
            />
            <TagInput
              label="Medications"
              value={medications}
              onChange={setMedications}
            />
            <div className="space-y-2">
              <p className="text-sm text-[#A8A59C]">Emergency contacts</p>
              {contacts.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-[#333] p-3">
                  <GoldInput
                    label="Name"
                    value={c.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setContacts((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, name: v } : x))
                      );
                    }}
                  />
                  <GoldInput
                    label="Phone"
                    value={c.phone}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setContacts((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, phone: v } : x))
                      );
                    }}
                  />
                  <select
                    className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                    value={c.relation}
                    onChange={(e) => {
                      const v = e.target.value;
                      setContacts((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, relation: v } : x
                        )
                      );
                    }}
                  >
                    {RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-red-400"
                      onClick={() =>
                        setContacts((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="inline h-4 w-4" /> Remove
                    </button>
                  )}
                </div>
              ))}
              {contacts.length < 3 && (
                <button
                  type="button"
                  className="text-sm text-[#D4AF37]"
                  onClick={() =>
                    setContacts((prev) => [
                      ...prev,
                      { name: "", phone: "", relation: "Friend" },
                    ])
                  }
                >
                  <Plus className="inline h-4 w-4" /> Add contact
                </button>
              )}
            </div>
            <GoldInput
              label="Family doctor (optional)"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <GoldInput
              label="Doctor phone"
              value={doctorPhone}
              onChange={(e) =>
                setDoctorPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
            />
            <GoldInput
              label="Preferred hospital"
              value={preferredHospital}
              onChange={(e) => setPreferredHospital(e.target.value)}
            />
            <GoldInput
              label="ABHA ID (optional)"
              value={abhaId}
              onChange={(e) => setAbhaId(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {CRITICAL_ALERT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setCriticalTags((prev) =>
                      prev.includes(opt)
                        ? prev.filter((t) => t !== opt)
                        : [...prev, opt]
                    )
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    criticalTags.includes(opt)
                      ? "bg-red-600 text-white"
                      : "bg-[#222] text-[#A8A59C]"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <GoldInput
              label="Other critical alert"
              value={criticalOther}
              onChange={(e) => setCriticalOther(e.target.value)}
            />
            <label className="block text-sm text-[#A8A59C]">Organ donor</label>
            <select
              className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
              value={organDonor}
              onChange={(e) =>
                setOrganDonor(e.target.value as OrganDonorValue)
              }
            >
              <option value="unset">Prefer not to say</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(1)}>
                Back
              </GoldButton>
              <GoldButton className="flex-1" onClick={next}>
                Next
              </GoldButton>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-[#A8A59C]">
              Clear face photo required. Camera opens on phones.
            </p>
            {photoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt=""
                className="mx-auto h-28 w-28 rounded-full object-cover border-2 border-[#D4AF37]"
              />
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4AF37] p-6 text-[#FCE49A]">
              <Camera className="h-5 w-5" />
              {photoPath ? "Retake photo" : "Take / upload photo"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0] || null;
                  if (!f) return;
                  setPhotoPreview(URL.createObjectURL(f));
                  const p = await uploadFile("photo", f);
                  if (p) setPhotoPath(p);
                }}
              />
            </label>
            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(2)}>
                Back
              </GoldButton>
              <GoldButton className="flex-1" disabled={loading} onClick={next}>
                Next
              </GoldButton>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm text-[#A8A59C]">
              Exactly 2 different IDs. Aadhaar: last 4 digits only — upload masked
              Aadhaar from myAadhaar.
            </p>
            {[
              {
                label: "ID 1",
                type: id1Type,
                setType: setId1Type,
                num: id1Number,
                setNum: setId1Number,
                front: id1Front,
                setFront: setId1Front,
                back: id1Back,
                setBack: setId1Back,
                frontKind: "id1-front",
                backKind: "id1-back",
              },
              {
                label: "ID 2",
                type: id2Type,
                setType: setId2Type,
                num: id2Number,
                setNum: setId2Number,
                front: id2Front,
                setFront: setId2Front,
                back: id2Back,
                setBack: setId2Back,
                frontKind: "id2-front",
                backKind: "id2-back",
              },
            ].map((id) => (
              <div
                key={id.label}
                className="space-y-2 rounded-lg border border-[#333] p-3"
              >
                <p className="text-sm font-semibold text-[#D4AF37]">{id.label}</p>
                <select
                  className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                  value={id.type}
                  onChange={(e) =>
                    id.setType(e.target.value as IdProofType | "")
                  }
                >
                  <option value="">Type</option>
                  {ID_PROOF_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <GoldInput
                  label={
                    id.type === "aadhaar" ? "Last 4 digits only" : "ID number"
                  }
                  value={id.num}
                  onChange={(e) => id.setNum(e.target.value)}
                />
                <FileBtn
                  label={id.front ? "Front ✓" : "Upload front"}
                  accept="image/*,application/pdf"
                  disabled={loading}
                  onFile={async (f) => {
                    const p = await uploadFile(id.frontKind, f);
                    if (p) id.setFront(p);
                  }}
                />
                <FileBtn
                  label={id.back ? "Back ✓" : "Upload back (optional)"}
                  accept="image/*,application/pdf"
                  disabled={loading}
                  onFile={async (f) => {
                    const p = await uploadFile(id.backKind, f);
                    if (p) id.setBack(p);
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(3)}>
                Back
              </GoldButton>
              <GoldButton className="flex-1" disabled={loading} onClick={next}>
                Next
              </GoldButton>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <GoldInput
              label="Address line"
              value={addrLine}
              onChange={(e) => setAddrLine(e.target.value)}
            />
            <GoldInput
              label="City"
              value={addrCity}
              onChange={(e) => setAddrCity(e.target.value)}
            />
            <GoldInput
              label="District"
              value={addrDistrict}
              onChange={(e) => setAddrDistrict(e.target.value)}
            />
            <GoldInput
              label="State"
              value={addrState}
              onChange={(e) => setAddrState(e.target.value)}
            />
            <GoldInput
              label="Pincode"
              value={addrPin}
              onChange={(e) =>
                setAddrPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <label className="block text-sm text-[#A8A59C]">
              Address proof same as ID?
            </label>
            <select
              className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
              value={sameAsId === null ? "" : String(sameAsId)}
              onChange={(e) => {
                const v = e.target.value;
                setSameAsId(v === "" ? null : (Number(v) as 0 | 1));
              }}
            >
              <option value="">Upload separate proof</option>
              <option value="0">Same as ID 1</option>
              <option value="1">Same as ID 2</option>
            </select>
            {sameAsId === null && (
              <FileBtn
                label={addressProofPath ? "Address proof ✓" : "Upload address proof"}
                accept="image/*,application/pdf"
                disabled={loading}
                onFile={async (f) => {
                  const p = await uploadFile("address-proof", f);
                  if (p) setAddressProofPath(p);
                }}
              />
            )}
            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(4)}>
                Back
              </GoldButton>
              <GoldButton className="flex-1" disabled={loading} onClick={next}>
                Next
              </GoldButton>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <label className="block text-sm text-[#A8A59C]">Coverage</label>
            <select
              className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
              value={coverageType}
              onChange={(e) =>
                setCoverageType(e.target.value as CoverageType | "")
              }
            >
              <option value="">Select</option>
              <option value="private">Private</option>
              <option value="government">Government</option>
              <option value="both">Both</option>
              <option value="none">No insurance / कोई बीमा नहीं</option>
            </select>
            {coverageType === "none" && (
              <p className="rounded-lg border border-[#333] bg-[#141410] p-3 text-sm text-[#A8A59C]">
                No policy details needed — you can continue. Emergency card will
                not show an insurer. / बीमा नहीं है तो आगे बढ़ सकते हैं।
              </p>
            )}
            {(coverageType === "private" || coverageType === "both") && (
              <div className="space-y-2 rounded-lg border border-[#333] p-3">
                <select
                  className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                  value={
                    PRIVATE_INSURERS.includes(
                      insurerName as (typeof PRIVATE_INSURERS)[number]
                    )
                      ? insurerName
                      : insurerName
                        ? "Other"
                        : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "Other") setInsurerName("Other");
                    else setInsurerName(v);
                  }}
                >
                  <option value="">Insurer</option>
                  {PRIVATE_INSURERS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {(insurerName === "Other" ||
                  (insurerName &&
                    !PRIVATE_INSURERS.includes(
                      insurerName as (typeof PRIVATE_INSURERS)[number]
                    ))) && (
                  <GoldInput
                    label="Insurer name (Other)"
                    value={insurerName === "Other" ? "" : insurerName}
                    onChange={(e) =>
                      setInsurerName(e.target.value.trim() || "Other")
                    }
                    placeholder="Test Insurance Co"
                  />
                )}
                <GoldInput
                  label="Policy number"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                />
                <GoldInput
                  label="Policy holder name"
                  value={policyHolder}
                  onChange={(e) => setPolicyHolder(e.target.value)}
                />
                <GoldInput
                  label="Valid till (optional)"
                  type="date"
                  value={validTill}
                  onChange={(e) => setValidTill(e.target.value)}
                />
                <FileBtn
                  label={policyCardPath ? "Policy card ✓" : "Policy card (required)"}
                  accept="image/*"
                  disabled={loading}
                  onFile={async (f) => {
                    const p = await uploadFile("policy-card", f);
                    if (p) setPolicyCardPath(p);
                  }}
                />
                <FileBtn
                  label={policyBondPath ? "Policy bond ✓" : "Policy bond PDF/image"}
                  accept="image/*,application/pdf"
                  disabled={loading}
                  onFile={async (f) => {
                    const p = await uploadFile("policy-bond", f);
                    if (p) setPolicyBondPath(p);
                  }}
                />
              </div>
            )}
            {(coverageType === "government" || coverageType === "both") && (
              <div className="space-y-2 rounded-lg border border-[#333] p-3">
                <select
                  className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                >
                  <option value="">Scheme</option>
                  {GOVT_SCHEMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <GoldInput
                  label="Govt card number"
                  value={govtCardNumber}
                  onChange={(e) => setGovtCardNumber(e.target.value)}
                />
                <FileBtn
                  label={govtCardPath ? "Govt card ✓" : "Govt card image"}
                  accept="image/*"
                  disabled={loading}
                  onFile={async (f) => {
                    const p = await uploadFile("govt-card", f);
                    if (p) setGovtCardPath(p);
                  }}
                />
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-dashed border-[#D4AF3755] p-3">
              <p className="text-xs uppercase tracking-wider text-[#D4AF37]">
                Optional — cashless form pre-fill (skip anytime)
              </p>
              <select
                className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Gender (optional)</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Third Gender">Third Gender</option>
              </select>
              <GoldInput
                label="Date of birth (optional)"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              <GoldInput
                label="Occupation (optional)"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
              <GoldInput
                label="Alternate contact (optional)"
                value={alternateContact}
                onChange={(e) =>
                  setAlternateContact(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                inputMode="numeric"
              />
              {coverageType !== "none" && (
                <>
              <select
                className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                value={tpaName}
                onChange={(e) => setTpaName(e.target.value)}
              >
                <option value="">TPA name (optional)</option>
                {COMMON_TPAS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {tpaName === "Other" && (
                <GoldInput
                  label="TPA name (Other)"
                  value={tpaOther}
                  onChange={(e) => setTpaOther(e.target.value)}
                />
              )}
              <GoldInput
                label="Insured member / health card ID (optional)"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              />
              <label className="flex gap-2 text-sm text-[#A8A59C]">
                <input
                  type="checkbox"
                  checked={isGroupPolicy}
                  onChange={(e) => setIsGroupPolicy(e.target.checked)}
                />
                Group / corporate policy
              </label>
              {isGroupPolicy && (
                <>
                  <GoldInput
                    label="Corporate name"
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                  />
                  <GoldInput
                    label="Employee ID"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </>
              )}
              <select
                className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                value={hasOtherMediclaim}
                onChange={(e) =>
                  setHasOtherMediclaim(e.target.value as "" | "yes" | "no")
                }
              >
                <option value="">Other health insurance? (optional)</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {hasOtherMediclaim === "yes" && (
                <>
                  <GoldInput
                    label="Other insurer company"
                    value={otherCompany}
                    onChange={(e) => setOtherCompany(e.target.value)}
                  />
                  <GoldInput
                    label="Other policy number"
                    value={otherPolicyNumber}
                    onChange={(e) => setOtherPolicyNumber(e.target.value)}
                  />
                </>
              )}
                </>
              )}
              <select
                className="w-full rounded-lg border border-[#333] bg-[#1a1a14] p-3 text-white"
                value={hasFamilyPhysician}
                onChange={(e) =>
                  setHasFamilyPhysician(e.target.value as "" | "yes" | "no")
                }
              >
                <option value="">Family physician? (optional)</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <p className="text-[11px] text-[#A8A59C]">
                Family physician name/phone can be filled in Medical step — used on the IRDAI form.
              </p>
            </div>

            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(5)}>
                Back
              </GoldButton>
              <GoldButton className="flex-1" disabled={loading} onClick={next}>
                Next
              </GoldButton>
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <label className="flex gap-2 text-sm text-[#A8A59C]">
              <input
                type="checkbox"
                checked={consentPhoto}
                onChange={(e) => setConsentPhoto(e.target.checked)}
              />
              Photo may appear on the public emergency card / फोटो सार्वजनिक कार्ड पर दिखेगी
            </label>
            <label className="flex gap-2 text-sm text-[#A8A59C]">
              <input
                type="checkbox"
                checked={consentDocs}
                onChange={(e) => setConsentDocs(e.target.checked)}
              />
              Documents may be shown for hospital admission with PIN / PIN से अस्पताल भर्ती के लिए दस्तावेज़
            </label>
            <label className="flex gap-2 text-sm text-[#A8A59C]">
              <input
                type="checkbox"
                checked={consentDpdp}
                onChange={(e) => setConsentDpdp(e.target.checked)}
              />
              I consent under DPDP Act / मैं DPDP अधिनियम के तहत सहमति देता/देती हूँ
            </label>
            <label className="flex gap-2 text-sm text-[#A8A59C]">
              <input
                type="checkbox"
                checked={consentLegal}
                onChange={(e) => setConsentLegal(e.target.checked)}
              />
              <span>
                I have read the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] underline"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] underline"
                >
                  Terms
                </a>
                {" / "}
                मैंने गोपनीयता नीति और नियम पढ़ लिए हैं
              </span>
            </label>
            <GoldInput
              label="Set PIN (4–6 digits)"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <GoldInput
              label="Confirm PIN"
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) =>
                setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            {captcha && (
              <>
                <p className="text-sm text-[#FCE49A]">{captcha.question}</p>
                <GoldInput
                  label="CAPTCHA"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                />
              </>
            )}
            <div className="flex gap-2">
              <GoldButton className="flex-1" onClick={() => setStep(6)}>
                Back
              </GoldButton>
              <GoldButton
                className="flex-1"
                disabled={loading}
                onClick={submit}
              >
                {loading ? "Activating…" : "Activate card"}
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FileBtn({
  label,
  accept,
  disabled,
  onFile,
}: {
  label: string;
  accept: string;
  disabled?: boolean;
  onFile: (f: File) => void | Promise<void>;
}) {
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-lg border border-[#D4AF37]/40 px-3 py-2 text-center text-sm text-[#FCE49A]",
        disabled && "opacity-50"
      )}
    >
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
    </label>
  );
}

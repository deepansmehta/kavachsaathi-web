"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ValidityBar } from "@/components/profile/ValidityBar";
import { EmergencyWallpaper } from "@/components/profile/EmergencyWallpaper";
import { ElderlyToggle } from "@/components/ElderlyMode";
import { OfflineCardControls } from "@/components/pwa/OfflineCardControls";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

type Flags = Record<string, boolean>;

type Props = {
  flags: Flags;
  healthId: string;
  name: string;
  bloodGroup: string;
  allergies: string[];
  conditions?: string[];
  medicines?: string[];
  criticalTags: string[];
  contacts: { name: string; phone: string; relation?: string }[];
  validFrom?: string | null;
  validTill?: string | null;
  cardStatus?: string;
  onProfileRefresh?: () => void;
};

/** Pack 3 owner tools for /my-profile — each section gated by its flag. */
export function Pack3ProfileTools({
  flags,
  healthId,
  name,
  bloodGroup,
  allergies,
  conditions = [],
  medicines = [],
  criticalTags,
  contacts,
  validFrom,
  validTill,
  cardStatus,
  onProfileRefresh,
}: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentCode, setConsentCode] = useState<string | null>(null);
  const [consentExp, setConsentExp] = useState<string | null>(null);
  const [referral, setReferral] = useState<{
    code: string;
    link: string;
    clicks: number;
    conversions: number;
    shareWhatsapp: string;
    referralRewardCount?: number;
    earnedMessage?: string | null;
  } | null>(null);
  const [replaceCode, setReplaceCode] = useState("");

  const loadReferral = useCallback(async () => {
    if (!flags.referral) return;
    try {
      const r = await fetch("/api/referral");
      if (!r.ok) return;
      setReferral(await r.json());
    } catch {
      /* */
    }
  }, [flags.referral]);

  useEffect(() => {
    void loadReferral();
  }, [loadReferral]);

  const renew = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/profile/renewal-request", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Renewal request failed");
        return;
      }
      if (j.whatsappUrl) window.open(j.whatsappUrl, "_blank");
      toast.success("Renewal request recorded");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const reportLost = async () => {
    if (!confirm("Report this card as lost? Scanners will not see your data.")) {
      return;
    }
    if (!pin || pin.length < 4) {
      toast.error("Re-enter your PIN");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/profile/lost-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", pin, confirm: true }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success("Card reported lost");
      setPin("");
      onProfileRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const unblock = async () => {
    if (!pin || pin.length < 4) {
      toast.error("Re-enter your PIN");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/profile/lost-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", pin }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Unblock failed");
        return;
      }
      toast.success("Card unblocked");
      setPin("");
      onProfileRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!pin || pin.length < 4 || !replaceCode.trim()) {
      toast.error("PIN and new activation code required");
      return;
    }
    if (
      !confirm(
        "Transfer your profile to the new card? Old card stays blocked."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/profile/lost-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          pin,
          newActivationCode: replaceCode.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Replace failed");
        return;
      }
      toast.success(`Moved to ${j.newHealthId}`);
      setPin("");
      setReplaceCode("");
      onProfileRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    if (!pin || pin.length < 4) {
      toast.error("Re-enter your PIN");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/profile/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Export failed");
        return;
      }
      const blob = new Blob([JSON.stringify(j.json, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kavachsaathi-my-data.json";
      a.click();
      if (j.pdfBase64) {
        const pdf = Uint8Array.from(atob(j.pdfBase64), (c) => c.charCodeAt(0));
        const pb = new Blob([pdf], { type: "application/pdf" });
        const a2 = document.createElement("a");
        a2.href = URL.createObjectURL(pb);
        a2.download = "kavachsaathi-my-data.pdf";
        a2.click();
      }
      toast.success("Download started (JSON + PDF)");
      setPin("");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const exportFhir = async () => {
    if (!pin || pin.length < 4) {
      toast.error("Re-enter your PIN");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/profile/fhir-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "FHIR export failed");
        return;
      }
      const blob = new Blob([JSON.stringify(j.bundle, null, 2)], {
        type: "application/fhir+json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = j.filename || "kavachsaathi-fhir.json";
      a.click();
      toast.success(
        j.validation?.valid
          ? "FHIR bundle downloaded (validated)"
          : "FHIR downloaded — check validation result"
      );
      setPin("");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const shareHospital = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/profile/hospital-consent", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Could not create code");
        return;
      }
      setConsentCode(j.code);
      setConsentExp(j.expiresAt);
      toast.success("Share this code with hospital staff (10 min, once)");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const any =
    flags.cardValidity ||
    flags.lostCard ||
    flags.dataExport ||
    flags.referral ||
    flags.elderlyMode ||
    flags.offlineEmergency ||
    flags.pwaApp ||
    flags.fhirExport ||
    flags.scanRegister;
  if (!any) return null;

  return (
    <div className="no-print space-y-4">
      <PwaInstallPrompt featureOn={!!flags.pwaApp} />
      <ValidityBar
        enabled={!!flags.cardValidity}
        validFrom={validFrom}
        validTill={validTill}
        healthId={healthId}
        name={name}
        onRenew={() => void renew()}
      />

      {flags.elderlyMode && (
        <div className="rounded-xl border border-[var(--gold-border)] p-4">
          <p className="mb-2 font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
            Accessibility
          </p>
          <ElderlyToggle enabled />
        </div>
      )}

      {(flags.lostCard || flags.dataExport || flags.fhirExport) && (
        <div className="space-y-3 rounded-xl border border-[var(--gold-border)] p-4">
          <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
            Security actions
          </p>
          <label className="block text-xs text-[var(--text-soft)]">
            Re-enter PIN to confirm
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-[var(--cream)]"
            />
          </label>
          {flags.lostCard && cardStatus !== "blocked" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reportLost()}
              className="w-full rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-200"
            >
              Report card lost
            </button>
          )}
          {flags.lostCard && cardStatus === "blocked" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void unblock()}
                className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
              >
                Unblock (within 7 days)
              </button>
              <div className="flex gap-2">
                <input
                  placeholder="New card activation code"
                  value={replaceCode}
                  onChange={(e) => setReplaceCode(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void replace()}
                  className="rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
                >
                  Replace
                </button>
              </div>
            </>
          )}
          {flags.dataExport && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportData()}
              className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
            >
              Download my data (DPDP)
            </button>
          )}
          {flags.fhirExport && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportFhir()}
              className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
            >
              Download health record (FHIR)
            </button>
          )}
        </div>
      )}

      {flags.scanRegister && (
        <div className="space-y-2 rounded-xl border border-[var(--gold-border)] p-4">
          <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
            Share with hospital
          </p>
          <p className="text-xs text-[var(--text-soft)]">
            One-time 6-digit consent code for hospital Scan &amp; Register (10 min).
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void shareHospital()}
            className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
          >
            Share with hospital
          </button>
          {consentCode ? (
            <p className="rounded-lg bg-black/40 p-3 text-center font-mono text-2xl tracking-[0.3em] text-[var(--gold)]">
              {consentCode}
              {consentExp ? (
                <span className="mt-1 block font-sans text-xs tracking-normal text-[var(--text-soft)]">
                  Expires {new Date(consentExp).toLocaleTimeString("en-IN")}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      )}

      {flags.referral && referral && (
        <div className="space-y-2 rounded-xl border border-[var(--gold-border)] p-4">
          <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
            Your referrals
          </p>
          <p className="font-mono text-lg text-[var(--gold)]">{referral.code}</p>
          <p className="text-xs text-[var(--text-soft)] break-all">
            {referral.link}
          </p>
          <p className="text-sm text-[var(--cream)]">
            Clicks: {referral.clicks} · Conversions: {referral.conversions}
          </p>
          {referral.earnedMessage ? (
            <p className="rounded-lg bg-[var(--gold-faint,#2a2410)] px-3 py-2 text-sm text-[var(--gold)]">
              {referral.earnedMessage}
            </p>
          ) : null}
          <a
            href={referral.shareWhatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
          >
            Share on WhatsApp
          </a>
        </div>
      )}

      <OfflineCardControls
        featureOn={!!flags.pwaApp}
        healthId={healthId}
        name={name}
        bloodGroup={bloodGroup}
        allergies={allergies}
        conditions={conditions}
        medicines={medicines}
        criticalFlags={criticalTags}
        contacts={contacts}
        pin={pin}
      />

      <EmergencyWallpaper
        featureOn={!!flags.offlineEmergency}
        profile={{
          name,
          bloodGroup,
          allergies,
          criticalTags,
          contacts,
        }}
      />
    </div>
  );
}

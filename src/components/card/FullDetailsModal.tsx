"use client";

import { useEffect, useState, useRef, type CSSProperties } from "react";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { FeedbackModal } from "@/components/FeedbackModal";
import { NeedBloodButton } from "./NeedBloodButton";
import { JAN_AUSHADHI_INFO, SCHEMES } from "@/lib/patientEase/officialLinks";

type Captcha = { token: string; question: string };

type Details =
  | {
      scope: "pin" | "emergency";
      full_name?: string;
      photoUrl?: string | null;
      watermark?: string;
      note?: string;
      idProofs?: {
        type?: string;
        number?: string | null;
        frontUrl?: string | null;
        backUrl?: string | null;
      }[];
      address?: {
        line?: string | null;
        city?: string;
        state?: string;
        pincode?: string;
        proofUrl?: string | null;
      };
      insurance?: Record<string, unknown>;
      expiresAt?: number;
      abha?: { number: string } | null;
      donorDirective?: {
        bloodDonor?: boolean | null;
        organDonor?: string;
        nottoPledgeId?: string | null;
        advanceDirectiveUrl?: string | null;
      } | null;
    }
  | null;

type VaultRecord = {
  id: string;
  type: string;
  date: string;
  hospital: string;
  url: string | null;
  uploadedAt?: string;
};

type CashlessTimerData = {
  cashlessRequestAt: string | null;
  irdaiTimelines: {
    preAuthDecision: string;
    enhancementDecision: string;
    finalDischargeAuth: string;
    reference: string;
    referenceUrl: string;
  };
  escalation: {
    step1: string;
    step2: { name: string; url: string; phone: string };
    step3: { name: string; url: string; note: string };
  };
  insurers: Array<{ name: string; tpaHelpline?: string; claimsHelpline?: string }>;
  disclaimer: string;
};

type FeatureFlags = Record<string, boolean>;

async function downloadPdf(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    let msg = "Download failed";
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch { /* */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = fallbackName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function formatElapsed(since: string): string {
  const diff = Date.now() - new Date(since).getTime();
  const totalMins = Math.floor(diff / 60_000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function FullDetailsModal({
  healthId,
  open,
  onClose,
}: {
  healthId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"choose" | "pin" | "emergency" | "view">("choose");
  const [pin, setPin] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [role, setRole] = useState("");
  const [mobile, setMobile] = useState("");
  const [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false);

  // Feature flags (loaded once when modal opens)
  const [flags, setFlags] = useState<FeatureFlags>({});
  const flagsLoaded = useRef(false);

  // Cashless timer state
  const [cashlessData, setCashlessData] = useState<CashlessTimerData | null>(null);
  const [cashlessLoading, setCashlessLoading] = useState(false);
  const [, setTimerTick] = useState(0);

  // Vault records
  const [vaultRecords, setVaultRecords] = useState<VaultRecord[]>([]);
  const [vaultLoaded, setVaultLoaded] = useState(false);

  // ABHA copy state
  const [abhaCopied, setAbhaCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setTab("choose");
      setDetails(null);
      setPin("");
      setCashlessData(null);
      setVaultRecords([]);
      setVaultLoaded(false);
      flagsLoaded.current = false;
      return;
    }
    // Load feature flags once
    if (!flagsLoaded.current) {
      flagsLoaded.current = true;
      fetch("/api/features")
        .then((r) => r.json())
        .then((d) => setFlags(d.flags || {}))
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!details?.expiresAt) return;
    const ms = details.expiresAt - Date.now();
    if (ms <= 0) {
      toast.error("Session expired");
      setDetails(null);
      setTab("choose");
      return;
    }
    const t = window.setTimeout(() => {
      toast.error("Session expired");
      setDetails(null);
      setTab("choose");
    }, ms);
    return () => window.clearTimeout(t);
  }, [details?.expiresAt]);

  // Timer tick for elapsed display
  useEffect(() => {
    if (!cashlessData?.cashlessRequestAt) return;
    const interval = setInterval(() => setTimerTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [cashlessData?.cashlessRequestAt]);

  // Load vault records once view is shown with PIN scope
  useEffect(() => {
    if (tab === "view" && details?.scope === "pin" && flags.recordsVault && !vaultLoaded) {
      setVaultLoaded(true);
      fetch("/api/vault")
        .then((r) => r.json())
        .then((d) => setVaultRecords(d.records || []))
        .catch(() => {});
    }
  }, [tab, details?.scope, flags.recordsVault, vaultLoaded]);

  // Load cashless timer once view is shown
  useEffect(() => {
    if (tab === "view" && details?.scope === "pin" && flags.cashlessTimer && !cashlessData) {
      fetch("/api/cashless-timer")
        .then((r) => r.json())
        .then((d) => setCashlessData(d))
        .catch(() => {});
    }
  }, [tab, details?.scope, flags.cashlessTimer, cashlessData]);

  if (!open) return null;

  const unlockPin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/full-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "pin",
          health_id: healthId,
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
        toast.error(
          data.attemptsLeft != null
            ? `${data.error} (${data.attemptsLeft} left)`
            : data.error || "Failed"
        );
        return;
      }
      const view = await fetch("/api/full-details");
      const payload = await view.json();
      if (!view.ok) {
        toast.error(payload.error || "Failed to load");
        return;
      }
      setDetails(payload);
      setTab("view");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const unlockEmergency = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/full-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "emergency",
          health_id: healthId,
          hospitalName,
          staffName,
          role,
          mobile,
          reason,
          attested,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      const view = await fetch("/api/full-details");
      const payload = await view.json();
      if (!view.ok) {
        toast.error(payload.error || "Failed to load");
        return;
      }
      setDetails(payload);
      setTab("view");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async (kind: "cashless" | "admission" | "claim") => {
    setDlLoading(kind);
    try {
      if (kind === "cashless") {
        await downloadPdf("/api/forms/cashless", "kavachsaathi-cashless-irdai.pdf");
      } else if (kind === "claim") {
        await downloadPdf("/api/forms/claim", "kavachsaathi-claim-form-part-a.pdf");
      } else {
        await downloadPdf(
          "/api/forms/admission-sheet",
          details?.scope === "emergency"
            ? "kavachsaathi-admission-sheet-limited.pdf"
            : "kavachsaathi-admission-sheet.pdf"
        );
      }
      toast.success("PDF ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlLoading(null);
    }
  };

  const submitCashlessTimer = async () => {
    setCashlessLoading(true);
    try {
      const res = await fetch("/api/cashless-timer", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      setCashlessData(data);
      toast.success("Cashless request time recorded");
    } catch {
      toast.error("Network error");
    } finally {
      setCashlessLoading(false);
    }
  };

  const copyAbha = (number: string) => {
    navigator.clipboard.writeText(number).then(() => {
      setAbhaCopied(true);
      setTimeout(() => setAbhaCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          overflow: "auto",
          background: "#12120e",
          border: "1px solid #D4AF3755",
          borderRadius: 16,
          padding: 16,
          color: "#F0EEE8",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ color: "#D4AF37" }}>Full Details — Hospital Admission</strong>
          <button type="button" onClick={onClose} style={{ color: "#A8A59C" }}>
            Close
          </button>
        </div>

        {tab === "choose" && (
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" onClick={() => setTab("pin")} style={btn}>
              Patient / family has the PIN
            </button>
            <button type="button" onClick={() => setTab("emergency")} style={btnOutline}>
              Patient is unconscious — Hospital emergency access
            </button>
          </div>
        )}

        {tab === "pin" && (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 13, color: "#A8A59C" }}>Card PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={input}
            />
            {captcha && (
              <>
                <p style={{ fontSize: 13 }}>{captcha.question}</p>
                <input
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  style={input}
                />
              </>
            )}
            <button type="button" disabled={loading} onClick={unlockPin} style={btn}>
              {loading ? "Checking…" : "Unlock full details"}
            </button>
            <button type="button" onClick={() => setTab("choose")} style={btnGhost}>
              Back
            </button>
          </div>
        )}

        {tab === "emergency" && (
          <div style={{ display: "grid", gap: 8 }}>
            <input placeholder="Hospital name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} style={input} />
            <input placeholder="Staff name" value={staffName} onChange={(e) => setStaffName(e.target.value)} style={input} />
            <input placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} style={input} />
            <input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} style={input} />
            <textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...input, minHeight: 70 }} />
            <label style={{ fontSize: 12, color: "#A8A59C", display: "flex", gap: 8 }}>
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
              I am hospital staff treating this patient; misuse is an offence.
            </label>
            <button type="button" disabled={loading} onClick={unlockEmergency} style={btn}>
              {loading ? "Submitting…" : "Request emergency access"}
            </button>
            <button type="button" onClick={() => setTab("choose")} style={btnGhost}>
              Back
            </button>
          </div>
        )}

        {tab === "view" && details && (
          <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
            {details.watermark && (
              <p style={{ fontSize: 11, color: "#D4AF37", opacity: 0.85 }}>
                {details.watermark}
              </p>
            )}
            {details.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={details.photoUrl}
                alt=""
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", margin: "0 auto" }}
              />
            )}
            <p style={{ textAlign: "center", fontSize: 18, fontWeight: 700 }}>
              {details.full_name}
            </p>
            {details.note && (
              <p style={{ color: "#FCE49A", fontSize: 13 }}>{details.note}</p>
            )}

            {/* PDF Forms */}
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 10,
                border: "1px solid #D4AF3755",
                borderRadius: 10,
              }}
            >
              <p style={{ fontSize: 12, color: "#D4AF37", margin: 0 }}>Downloadable forms</p>
              {details.scope === "pin" && (
                <button
                  type="button"
                  disabled={!!dlLoading}
                  onClick={() => onDownload("cashless")}
                  style={btn}
                >
                  {dlLoading === "cashless" ? "Preparing…" : "Download Cashless Form (IRDAI)"}
                </button>
              )}
              {details.scope === "pin" && flags.claimFormPrefill && (
                <button
                  type="button"
                  disabled={!!dlLoading}
                  onClick={() => onDownload("claim")}
                  style={btnOutline}
                >
                  {dlLoading === "claim" ? "Preparing…" : "Download Claim Form (Reimbursement)"}
                </button>
              )}
              <button
                type="button"
                disabled={!!dlLoading}
                onClick={() => onDownload("admission")}
                style={details.scope === "pin" ? btnOutline : btn}
              >
                {dlLoading === "admission"
                  ? "Preparing…"
                  : details.scope === "emergency"
                    ? "Download Limited Admission Info Sheet"
                    : "Download Admission Info Sheet"}
              </button>
              {details.scope === "emergency" && (
                <p style={{ fontSize: 11, color: "#A8A59C", margin: 0 }}>
                  Emergency access: limited sheet only (no address / ID numbers / cashless form).
                </p>
              )}
            </div>

            {/* F4: Cashless Timer (PIN scope only) */}
            {details.scope === "pin" && flags.cashlessTimer && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #D4AF3755",
                  borderRadius: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <p style={{ fontSize: 12, color: "#D4AF37", margin: 0 }}>
                  Cashless hospitalisation timer
                </p>
                {cashlessData?.cashlessRequestAt ? (
                  <div>
                    <p style={{ color: "#FCE49A", fontSize: 13 }}>
                      ✅ Request submitted {formatElapsed(cashlessData.cashlessRequestAt)} ago
                    </p>
                    <p style={{ fontSize: 11, color: "#A8A59C", marginTop: 4 }}>
                      Submitted: {new Date(cashlessData.cashlessRequestAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={cashlessLoading}
                    onClick={submitCashlessTimer}
                    style={btn}
                  >
                    {cashlessLoading ? "Saving…" : "Cashless request submitted"}
                  </button>
                )}
                {cashlessData && (
                  <div style={{ fontSize: 11, color: "#A8A59C" }}>
                    <p style={{ color: "#FCE49A", marginBottom: 4 }}>
                      IRDAI decision timelines:
                    </p>
                    <p>• {cashlessData.irdaiTimelines.preAuthDecision}</p>
                    <p>• {cashlessData.irdaiTimelines.enhancementDecision}</p>
                    <p>• {cashlessData.irdaiTimelines.finalDischargeAuth}</p>
                    <p style={{ marginTop: 4 }}>
                      Ref:{" "}
                      <a
                        href={cashlessData.irdaiTimelines.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#D4AF37" }}
                      >
                        {cashlessData.irdaiTimelines.reference}
                      </a>
                    </p>
                    {cashlessData.insurers.length > 0 && (
                      <>
                        <p style={{ color: "#FCE49A", marginTop: 6, marginBottom: 2 }}>
                          Insurer helplines:
                        </p>
                        {cashlessData.insurers.map((ins, i) => (
                          <p key={i}>
                            • {ins.name}
                            {ins.tpaHelpline ? ` TPA: ${ins.tpaHelpline}` : ""}
                            {ins.claimsHelpline ? ` Claims: ${ins.claimsHelpline}` : ""}
                          </p>
                        ))}
                      </>
                    )}
                    <p style={{ color: "#FCE49A", marginTop: 6, marginBottom: 2 }}>
                      Escalation:
                    </p>
                    <p>1. {cashlessData.escalation.step1}</p>
                    <p>
                      2.{" "}
                      <a
                        href={cashlessData.escalation.step2.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#D4AF37" }}
                      >
                        {cashlessData.escalation.step2.name}
                      </a>{" "}
                      — {cashlessData.escalation.step2.phone}
                    </p>
                    <p>
                      3.{" "}
                      <a
                        href={cashlessData.escalation.step3.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#D4AF37" }}
                      >
                        {cashlessData.escalation.step3.name}
                      </a>
                    </p>
                    <p
                      style={{
                        marginTop: 6,
                        padding: "4px 8px",
                        background: "#1a1a14",
                        borderRadius: 6,
                        fontSize: 10,
                      }}
                    >
                      ⚠ {cashlessData.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ID Proofs (PIN scope) */}
            {details.scope === "pin" && details.idProofs && (
              <section>
                <h3 style={{ color: "#D4AF37", fontSize: 13 }}>ID proofs</h3>
                {details.idProofs.map((id, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div>
                      {id.type}: {id.number}
                    </div>
                    {id.frontUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={id.frontUrl} alt="" style={{ maxWidth: "100%", marginTop: 6, borderRadius: 8 }} />
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Address (PIN scope) */}
            {details.scope === "pin" && details.address && (
              <section>
                <h3 style={{ color: "#D4AF37", fontSize: 13 }}>Address</h3>
                <p>
                  {details.address.line}
                  <br />
                  {[details.address.city, details.address.state, details.address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </section>
            )}

            {/* Insurance */}
            {details.insurance && (
              <section>
                <h3 style={{ color: "#D4AF37", fontSize: 13 }}>Insurance</h3>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#F0EEE8" }}>
                  {JSON.stringify(details.insurance, null, 2)}
                </pre>
              </section>
            )}

            {/* F8: ABHA Link (PIN scope only) */}
            {details.scope === "pin" && flags.abhaLink && details.abha?.number && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #D4AF3755",
                  borderRadius: 10,
                }}
              >
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>
                  ABHA (Ayushman Bharat Health Account)
                </p>
                <p style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 2 }}>
                  {details.abha.number}
                </p>
                <button
                  type="button"
                  onClick={() => copyAbha(details?.abha?.number || "")}
                  style={{ ...btnGhost, padding: "4px 8px", fontSize: 12 }}
                >
                  {abhaCopied ? "✓ Copied" : "Copy"}
                </button>
                <div style={{ marginTop: 8, background: "#fff", display: "inline-block", padding: 4, borderRadius: 6 }}>
                  <QRCode
                    value={details.abha.number}
                    size={96}
                  />
                </div>
              </div>
            )}

            {/* F12: Donor Directive (PIN scope only) */}
            {details.scope === "pin" && flags.donorDirective && details.donorDirective !== undefined && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #D4AF3755",
                  borderRadius: 10,
                }}
              >
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>
                  Donor &amp; Advance Directive
                </p>
                <p style={{ fontSize: 10, color: "#A8A59C", marginBottom: 8, lineHeight: 1.4 }}>
                  As declared by the cardholder. Not a legal document. Doctors follow hospital protocol.
                </p>
                <p style={{ fontSize: 12 }}>
                  Blood donor:{" "}
                  <span style={{ color: "#FCE49A" }}>
                    {details.donorDirective?.bloodDonor === true
                      ? "Yes"
                      : details.donorDirective?.bloodDonor === false
                        ? "No"
                        : "Not specified"}
                  </span>
                </p>
                <p style={{ fontSize: 12 }}>
                  Organ donor:{" "}
                  <span style={{ color: "#FCE49A" }}>
                    {details.donorDirective?.organDonor === "yes"
                      ? "Yes"
                      : details.donorDirective?.organDonor === "no"
                        ? "No"
                        : "Not specified"}
                  </span>
                </p>
                {details.donorDirective?.nottoPledgeId && (
                  <p style={{ fontSize: 12 }}>
                    NOTTO Pledge ID:{" "}
                    <span style={{ fontFamily: "monospace", color: "#FCE49A" }}>
                      {details.donorDirective.nottoPledgeId}
                    </span>
                  </p>
                )}
                {details.donorDirective?.advanceDirectiveUrl && (
                  <a
                    href={details.donorDirective.advanceDirectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#D4AF37", fontSize: 12 }}
                  >
                    View advance directive document ↗
                  </a>
                )}
              </div>
            )}

            {/* F5: Records Vault (PIN scope only, latest 3) */}
            {details.scope === "pin" && flags.recordsVault && vaultRecords.length > 0 && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #D4AF3755",
                  borderRadius: 10,
                }}
              >
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>
                  Medical records vault (latest 3)
                </p>
                {vaultRecords.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      marginBottom: 8,
                      padding: 6,
                      background: "#1a1a14",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <p style={{ color: "#FCE49A", margin: 0 }}>
                      {r.type.replace(/_/g, " ")} · {r.date || "—"} · {r.hospital || "—"}
                    </p>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#D4AF37" }}
                      >
                        Open (5-min link) ↗
                      </a>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: "#A8A59C", margin: 0 }}>
                  Signed URLs expire in 5 minutes. Full vault accessible in My Profile.
                </p>
              </div>
            )}

            {/* Pack 2 — F20: Doctor Summary PDF (PIN scope only) */}
            {details.scope === "pin" && flags.doctorSummary && (
              <div style={{ padding: 10, border: "1px solid #D4AF3755", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>Doctor Summary PDF</p>
                <button
                  type="button"
                  disabled={!!dlLoading}
                  onClick={async () => {
                    setDlLoading("doctorSummary");
                    try {
                      await downloadPdf("/api/doctor-summary?action=pdf", "kavachsaathi-doctor-summary.pdf");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Download failed");
                    } finally {
                      setDlLoading(null);
                    }
                  }}
                  style={btnOutline}
                >
                  {dlLoading === "doctorSummary" ? "Preparing…" : "Download Doctor Summary (1-page)"}
                </button>
              </div>
            )}

            {/* Pack 2 — F24: Need Blood (any scope with PIN) */}
            {details.scope === "pin" && flags.needBlood && (
              <NeedBloodButton enabled />
            )}

            {/* Pack 2 — F22: Scheme Guide (PIN scope only) */}
            {details.scope === "pin" && flags.schemeGuide && (
              <div style={{ padding: 10, border: "1px solid #D4AF3755", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>Government Health Schemes</p>
                <a href="/schemes" target="_blank" rel="noopener noreferrer" style={{ color: "#FCE49A", fontSize: 13 }}>
                  View scheme guide ↗
                </a>
                <div style={{ marginTop: 6, fontSize: 11, color: "#A8A59C" }}>
                  {SCHEMES.filter((s) => s.verified).slice(0, 3).map((s) => (
                    <a key={s.id} href={s.officialUrl} target="_blank" rel="noreferrer" style={{ color: "#A8A59C", marginRight: 8 }}>
                      {s.nameEn} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Pack 2 — F23: Jan Aushadhi (PIN scope only) */}
            {details.scope === "pin" && flags.janAushadhi && (
              <div style={{ padding: 10, border: "1px solid #D4AF3755", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#D4AF37", marginBottom: 8 }}>Jan Aushadhi — Affordable Generic Medicines</p>
                <a href={JAN_AUSHADHI_INFO.url} target="_blank" rel="noreferrer" style={{ color: "#FCE49A", fontSize: 13 }}>
                  Find nearest Janaushadhi Kendra ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      <FeedbackModal
        enabled={Boolean(flags.feedback) && Boolean(details)}
        context="full_details"
      />
    </div>
  );
}

const btn: CSSProperties = {
  background: "linear-gradient(135deg,#FCE49A,#D4AF37,#B8860B)",
  color: "#0a0a08",
  border: "none",
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
};
const btnOutline: CSSProperties = {
  ...btn,
  background: "transparent",
  color: "#FCE49A",
  border: "1px solid #D4AF37",
};
const btnGhost: CSSProperties = {
  background: "transparent",
  color: "#A8A59C",
  border: "none",
  padding: 8,
  cursor: "pointer",
};
const input: CSSProperties = {
  width: "100%",
  background: "#1a1a14",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#F0EEE8",
};

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";

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
    }
  | null;

export function FullDetailsModal({
  healthId,
  open,
  onClose,
}: {
  healthId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"choose" | "pin" | "emergency" | "view">(
    "choose"
  );
  const [pin, setPin] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<Details>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [role, setRole] = useState("");
  const [mobile, setMobile] = useState("");
  const [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false);

  useEffect(() => {
    if (!open) {
      setTab("choose");
      setDetails(null);
      setPin("");
      return;
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
            <button
              type="button"
              onClick={() => setTab("pin")}
              style={btn}
            >
              Patient / family has the PIN
            </button>
            <button
              type="button"
              onClick={() => setTab("emergency")}
              style={btnOutline}
            >
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
            {details.insurance && (
              <section>
                <h3 style={{ color: "#D4AF37", fontSize: 13 }}>Insurance</h3>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#F0EEE8" }}>
                  {JSON.stringify(details.insurance, null, 2)}
                </pre>
              </section>
            )}
          </div>
        )}
      </div>
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

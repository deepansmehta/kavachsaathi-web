"use client";

/**
 * NeedBloodButton — renders only when enabled is true (or via healthId prop).
 * Used in EmergencyView (F24 — client-side WA build, no session needed)
 * and FullDetailsModal (PIN mode — uses /api/need-blood session route).
 *
 * Props:
 *  enabled       — feature-flag gate (FullDetailsModal usage)
 *  healthId      — if provided, used to build message directly (EmergencyView usage)
 *  bloodGroup    — shown in blood-request message
 *  compact       — shows a smaller button label
 */

import { useState } from "react";
import { E_RAKT_KOSH } from "@/lib/patientEase/officialLinks";
import { COMPANY_WHATSAPP } from "@/lib/config/links";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const DANGER = "#E53935";

type Props = {
  /** Feature-flag guard (set false to hide) */
  enabled?: boolean;
  /** Optional: used in EmergencyView where no profile session exists */
  healthId?: string;
  bloodGroup?: string;
  compact?: boolean;
  /** Start with the request form open (sticky-bar sheet) */
  forceOpen?: boolean;
};

/** Build a wa.me URL without calling the API (for unauthenticated emergency page). */
function buildWaUrlLocally(opts: {
  hospital: string;
  phone?: string;
  healthId?: string;
  bloodGroup?: string;
}): string {
  const bgDisplay = opts.bloodGroup ? ` (Blood Group: ${opts.bloodGroup})` : "";
  const phoneStr = opts.phone ? `\nContact: +91 ${opts.phone}` : "";
  const hid = opts.healthId ? `\nKavachSaathi Health ID: ${opts.healthId}` : "";
  const msg = `🩸 Blood needed urgently!\n\nHospital: ${opts.hospital}${bgDisplay}${phoneStr}${hid}\n\nPlease help locate blood / contact blood bank.`;
  return `https://wa.me/${COMPANY_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export function NeedBloodButton({
  enabled = true,
  healthId,
  bloodGroup,
  compact = false,
  forceOpen = false,
}: Props) {
  const [open, setOpen] = useState(forceOpen);
  const [hospital, setHospital] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ waUrl: string; eRaktKoshUrl: string } | null>(null);
  const [error, setError] = useState("");

  if (!enabled) return null;

  const submit = async () => {
    if (!hospital.trim()) {
      setError("Please enter the hospital name.");
      return;
    }
    setLoading(true);
    setError("");

    // If we have a healthId passed directly (EmergencyView), build message locally
    // to avoid requiring a session. Also try the API for logging.
    if (healthId) {
      const waUrl = buildWaUrlLocally({ hospital: hospital.trim(), phone, healthId, bloodGroup });
      // Fire-and-forget logging attempt (may fail silently if no session)
      fetch("/api/need-blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital: hospital.trim(), phone }),
      }).catch(() => { /* silent */ });
      setResult({ waUrl, eRaktKoshUrl: E_RAKT_KOSH.url });
      setLoading(false);
      return;
    }

    // Session-authenticated path (FullDetailsModal)
    try {
      const r = await fetch("/api/need-blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital: hospital.trim(), phone: phone.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        // Fallback: build locally
        const waUrl = buildWaUrlLocally({ hospital: hospital.trim(), phone });
        setResult({ waUrl, eRaktKoshUrl: E_RAKT_KOSH.url });
        return;
      }
      setResult(j);
    } catch {
      // Fallback: build locally even on network error
      const waUrl = buildWaUrlLocally({ hospital: hospital.trim(), phone });
      setResult({ waUrl, eRaktKoshUrl: E_RAKT_KOSH.url });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setHospital("");
    setPhone("");
    setResult(null);
    setError("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "block",
          width: "100%",
          padding: compact ? "10px 14px" : "13px 16px",
          borderRadius: 10,
          background: "transparent",
          border: `1px solid ${DANGER}66`,
          color: "#FF8A80",
          fontWeight: 700,
          fontSize: compact ? 14 : 15,
          cursor: "pointer",
          marginTop: 8,
          textAlign: "center",
        }}
      >
        🩸 {compact ? "Need Blood?" : "Need Blood? Get Help"}
      </button>
    );
  }

  return (
    <div
      style={{
        background: "#1a0f0f",
        border: `1px solid ${DANGER}55`,
        borderRadius: 14,
        padding: "16px",
        marginTop: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ color: "#FF8A80", fontSize: 14 }}>🩸 Request blood help</strong>
        <button type="button" onClick={reset} style={ghostBtn}>
          Close
        </button>
      </div>

      {result ? (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ color: "#FF8A80", fontSize: 13 }}>
            ✅ Request ready. Share via WhatsApp or check e-RaktKosh.
          </p>
          <a
            href={result.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={primaryLink}
          >
            📲 Share on WhatsApp
          </a>
          <a
            href={result.eRaktKoshUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...ghostLink, fontSize: 13 }}
          >
            🔗 e-RaktKosh (official blood bank portal) ↗
          </a>
          <button type="button" onClick={reset} style={ghostBtn}>
            Done
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ fontSize: 12, color: "#A8A59C" }}>
            Enter the hospital name. We will build a WhatsApp message to help locate blood.
            No location is stored.
          </p>
          <input
            placeholder="Hospital name *"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Contact phone (optional)"
            value={phone}
            inputMode="numeric"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            style={inputStyle}
          />
          {error && <p style={{ color: "#FF8A80", fontSize: 13 }}>{error}</p>}
          <button
            type="button"
            disabled={loading}
            onClick={submit}
            style={{
              padding: "12px",
              borderRadius: 10,
              background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`,
              color: "#0A0A08",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Preparing…" : "Get help link"}
          </button>
          <a
            href={E_RAKT_KOSH.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...ghostLink, fontSize: 12 }}
          >
            Also check e-RaktKosh directly ↗
          </a>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#120909",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#F0EEE8",
  fontSize: 14,
  boxSizing: "border-box",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "#A8A59C",
  border: "none",
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 13,
};

const primaryLink: React.CSSProperties = {
  display: "block",
  padding: "12px",
  borderRadius: 10,
  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
  color: "#0A0A08",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  textAlign: "center",
};

const ghostLink: React.CSSProperties = {
  display: "block",
  color: "#A8A59C",
  fontSize: 13,
  textDecoration: "none",
  textAlign: "center",
};

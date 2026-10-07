"use client";

/**
 * /pass/[token] — Attendant pass view (F19).
 * Fetches /api/pass/[token] and renders attendant info with watermark.
 * If the attendant-pass API (from sibling agent) is not yet deployed, shows a stub.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const CARD = "#141410";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";

type PassData = {
  patientName?: string;
  attendantName?: string;
  relation?: string;
  validTill?: string;
  ward?: string;
  hospital?: string;
  notes?: string;
  healthId?: string;
  issuedAt?: string;
  watermark?: string;
};

export default function AttendantPassPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";

  const [data, setData] = useState<PassData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/pass/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (r.status === 404 && (j as { code?: string }).code === "FEATURE_OFF") {
            setError("Attendant pass feature is not yet enabled.");
          } else {
            setError((j as { error?: string }).error || "Pass not found or expired.");
          }
          return;
        }
        const j = await r.json();
        setData(j);
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={page}>
        <p style={{ color: MUTED, textAlign: "center", padding: 40 }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={page}>
        <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: "#FF8A80", marginBottom: 12 }}>{error}</p>
          <a href="/" style={{ color: GOLD, fontSize: 14 }}>← Back to KavachSaathi</a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={page}>
      <div
        style={{
          maxWidth: 420,
          margin: "24px auto",
          padding: "0 16px",
          position: "relative",
        }}
      >
        {/* Watermark */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%) rotate(-32deg)",
            fontSize: 48,
            fontWeight: 800,
            color: `${GOLD}18`,
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            zIndex: 0,
          }}
        >
          KavachSaathi
        </div>

        <div
          style={{
            background: CARD,
            border: `2px solid ${GOLD}66`,
            borderRadius: 18,
            padding: "24px 18px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div
              style={{
                fontFamily: "Rajdhani, system-ui, sans-serif",
                fontSize: 13,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: GOLD,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              KavachSaathi
            </div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: GOLD_LIGHT,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Attendant Pass
            </h1>
          </div>

          {/* Patient */}
          <Row label="Patient" value={data.patientName} />
          {data.healthId && (
            <Row label="Health ID" value={data.healthId} mono />
          )}
          {data.hospital && <Row label="Hospital" value={data.hospital} />}
          {data.ward && <Row label="Ward / Room" value={data.ward} />}

          <hr style={{ border: "none", borderTop: `1px solid ${GOLD}33`, margin: "14px 0" }} />

          {/* Attendant */}
          <Row label="Attendant" value={data.attendantName} bold />
          {data.relation && <Row label="Relation" value={data.relation} />}

          {/* Validity */}
          {data.validTill && (
            <Row
              label="Valid till"
              value={new Date(data.validTill).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            />
          )}

          {data.notes && (
            <p style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
              {data.notes}
            </p>
          )}

          {data.watermark && (
            <p style={{ fontSize: 11, color: `${GOLD}99`, marginTop: 12 }}>
              {data.watermark}
            </p>
          )}

          <p style={{ fontSize: 10, color: MUTED, marginTop: 16, textAlign: "center" }}>
            {data.issuedAt
              ? `Issued: ${new Date(data.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
              : null}
          </p>
        </div>

        <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 16 }}>
          GDM Technoworld · kavachsaathi.in
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  bold?: boolean;
}) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: MUTED, minWidth: 80 }}>{label}:</span>
      <span
        style={{
          fontSize: bold ? 16 : 14,
          color: TEXT,
          fontWeight: bold ? 700 : 400,
          fontFamily: mono ? "monospace" : undefined,
          letterSpacing: mono ? 1 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0A0A08",
  color: TEXT,
  fontFamily: "system-ui, sans-serif",
};

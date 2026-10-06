"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  healthId: string;
  bloodGroup?: string | null;
  /** compact for emergency view */
  compact?: boolean;
};

/** F23 — Need Blood (allowed on emergency view when flag ON) */
export function NeedBloodButton({ healthId, bloodGroup, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [hospital, setHospital] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!hospital.trim()) {
      toast.error("Enter hospital name");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/need-blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ health_id: healthId, hospital: hospital.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      if (j.whatsappUrl) window.open(j.whatsappUrl, "_blank");
      if (j.eRaktKoshUrl) {
        // secondary tab for official blood bank portal
        window.open(j.eRaktKoshUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("WhatsApp message ready");
      setOpen(false);
      setHospital("");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: compact ? 14 : 12 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: "100%",
            padding: compact ? "14px 12px" : "10px 12px",
            borderRadius: 12,
            border: "1px solid #E53935",
            background: "#E5393518",
            color: "#F0EEE8",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Need {bloodGroup || ""} blood — share request
        </button>
      ) : (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #E5393544",
            background: "#141410",
          }}
        >
          <p style={{ fontSize: 12, color: "#A8A59C", marginBottom: 8 }}>
            Hospital name is only used in the WhatsApp message — not stored.
          </p>
          <input
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            placeholder="Hospital name"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0c0c0a",
              color: "#F0EEE8",
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "none",
                background: "#E53935",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {busy ? "…" : "Open WhatsApp"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "transparent",
                color: "#A8A59C",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

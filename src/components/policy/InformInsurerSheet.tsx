"use client";

import { useState, type CSSProperties } from "react";

/**
 * Bottom sheet / modal: tel: claim helpline, a prewritten message, Copy and
 * Share (navigator.share, falling back to copy). Used from the public
 * emergency scan (EmergencyPolicyBlock) and from owner screens (PolicyWallet,
 * FullDetailsModal) — callers supply the already-built message + helplines so
 * this component never needs network access or auth of its own.
 */
export function InformInsurerSheet({
  open,
  onClose,
  insurerName,
  message,
  cashlessHelpline,
  claimHelpline,
}: {
  open: boolean;
  onClose: () => void;
  insurerName?: string | null;
  message: string;
  cashlessHelpline?: string | null;
  claimHelpline?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const tel = (phone?: string | null): string | null => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return null;
    return digits.length === 10 ? `tel:+91${digits}` : `tel:+${digits}`;
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const shareMessage = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: message, title: "Inform Insurer" });
        return;
      }
    } catch {
      /* user cancelled or share failed — fall back to copy */
    }
    void copyMessage();
  };

  const cashlessTel = tel(cashlessHelpline);
  const claimTel = tel(claimHelpline);

  return (
    <div style={overlay} onClick={onClose} data-testid="inform-insurer-sheet">
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <strong style={{ color: GOLD }}>
            Inform Insurer{insurerName ? ` — ${insurerName}` : ""}
          </strong>
          <button type="button" onClick={onClose} style={{ color: MUTED, background: "none", border: "none" }}>
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {cashlessTel ? (
            <a href={cashlessTel} style={btn} data-testid="inform-call-cashless">
              📞 Call cashless helpline
            </a>
          ) : null}
          {claimTel ? (
            <a href={claimTel} style={btnOutline} data-testid="inform-call-claim">
              📞 Call claim helpline
            </a>
          ) : null}
          {!cashlessTel && !claimTel ? (
            <p style={{ fontSize: 12, color: MUTED }}>
              No helpline number on file for this policy. / इस पॉलिसी के लिए
              हेल्पलाइन नंबर दर्ज नहीं है।
            </p>
          ) : null}
        </div>

        <p style={{ fontSize: 12, color: GOLD, marginBottom: 6 }}>
          Pre-written message / तैयार संदेश
        </p>
        <textarea
          readOnly
          value={message}
          style={textarea}
          onFocus={(e) => e.currentTarget.select()}
          data-testid="inform-message"
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => void copyMessage()} style={{ ...btnOutline, flex: 1 }} data-testid="inform-copy">
            {copied ? "✓ Copied" : "Copy / कॉपी करें"}
          </button>
          <button type="button" onClick={() => void shareMessage()} style={{ ...btn, flex: 1 }} data-testid="inform-share">
            Share / शेयर करें
          </button>
        </div>

        <p style={{ fontSize: 10, color: MUTED, marginTop: 10 }}>
          Sent by you from your own phone. KavachSaathi does not sell
          insurance. / यह आप अपने फ़ोन से भेजते हैं। कवचसाथी बीमा नहीं बेचता।
        </p>
      </div>
    </div>
  );
}

const GOLD = "#D4AF37";
const MUTED = "#A8A59C";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: 12,
};

const sheet: CSSProperties = {
  width: "100%",
  maxWidth: 440,
  maxHeight: "88vh",
  overflow: "auto",
  background: "#12120e",
  border: `1px solid ${GOLD}55`,
  borderRadius: 16,
  padding: 16,
  color: "#F0EEE8",
};

const btn: CSSProperties = {
  background: `linear-gradient(135deg,#FCE49A,${GOLD},#B8860B)`,
  color: "#0a0a08",
  border: "none",
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  textAlign: "center",
  textDecoration: "none",
  cursor: "pointer",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnOutline: CSSProperties = {
  ...btn,
  background: "transparent",
  color: "#FCE49A",
  border: `1px solid ${GOLD}`,
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 140,
  background: "#1a1a14",
  border: `1px solid ${GOLD}44`,
  borderRadius: 8,
  padding: 10,
  color: "#F0EEE8",
  fontSize: 12.5,
  lineHeight: 1.5,
  boxSizing: "border-box",
};

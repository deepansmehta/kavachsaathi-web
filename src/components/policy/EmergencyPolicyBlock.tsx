"use client";

import { useState } from "react";
import type { PublicPolicyBlock } from "@/lib/policy/types";
import { buildInformInsurerMessage } from "@/lib/policy/informMessage";
import { InformInsurerSheet } from "./InformInsurerSheet";

/**
 * "Insured ✓" block for the public emergency scan view.
 * Safe fields only: insurer name, type, masked policy number, TPA, helplines,
 * and status. Never the full policy number, nominee, documents, or sum
 * insured. Expired policies get a red badge instead of the green check.
 */
export function EmergencyPolicyBlock({
  blocks,
  holderName,
  healthId,
}: {
  blocks: PublicPolicyBlock[];
  holderName?: string | null;
  healthId?: string | null;
}) {
  const [sheetFor, setSheetFor] = useState<PublicPolicyBlock | null>(null);

  if (!blocks || blocks.length === 0) return null;

  const tel = (phone?: string | null): string | null => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return null;
    return digits.length === 10 ? `tel:+91${digits}` : `tel:+${digits}`;
  };

  const last4FromMasked = (masked: string): string | null => {
    const m = masked.match(/(\d{4})$/);
    return m ? m[1]! : null;
  };

  const openInform = (block: PublicPolicyBlock) => setSheetFor(block);

  const sheetMessage = sheetFor
    ? buildInformInsurerMessage({
        holderName: holderName || "Cardholder",
        cardId: healthId || "",
        insurerName: sheetFor.insurerName,
        policyNumberLast4: last4FromMasked(sheetFor.policyNumberMasked),
        hospitalName: "",
        date: new Date().toISOString().slice(0, 10),
      })
    : "";

  return (
    <section className="ks-card" aria-label="Insurance (Policy Saathi)" data-testid="emergency-policy-block">
      <div className="ks-card-head">
        <h2 className="ks-h">Insurance / बीमा</h2>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {blocks.map((b, i) => {
          const expired = b.status === "expired";
          const cashlessTel = tel(b.cashlessHelpline);
          const claimTel = tel(b.claimHelpline);
          return (
            <div
              key={`${b.insurerName}-${i}`}
              style={{
                border: `1px solid ${expired ? "rgba(198,40,40,.35)" : "rgba(212,175,55,.3)"}`,
                borderRadius: 12,
                padding: "10px 12px",
                background: expired ? "#FFF5F5" : "#FFFDF5",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                  {b.insurerName} · {b.typeLabelEn}
                </p>
                {expired ? (
                  <span
                    style={{
                      background: "#C62828",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 999,
                      padding: "2px 10px",
                    }}
                  >
                    Expired / समाप्त
                  </span>
                ) : (
                  <span
                    style={{
                      background: "rgba(46,168,67,.16)",
                      border: "1px solid rgba(46,168,67,.45)",
                      color: "#1f7a33",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 999,
                      padding: "2px 10px",
                    }}
                  >
                    Insured ✓
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5C574E" }}>
                Policy: {b.policyNumberMasked}
                {b.tpaName ? ` · TPA: ${b.tpaName}` : ""}
              </p>
              {expired && b.expiredOnLabel ? (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#7a5a00" }}>
                  Expired on {b.expiredOnLabel}
                </p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {cashlessTel ? (
                  <a className="ks-btn ks-btn-call" href={cashlessTel} style={{ flex: "1 1 auto" }}>
                    📞 Cashless helpline
                  </a>
                ) : null}
                {claimTel ? (
                  <a className="ks-btn ks-btn-call" href={claimTel} style={{ flex: "1 1 auto" }}>
                    📞 Claim helpline
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => openInform(b)}
                  className="ks-btn"
                  style={{
                    flex: "1 1 auto",
                    background: "transparent",
                    border: "2px solid var(--gold,#D4AF37)",
                    color: "#8A7010",
                  }}
                  data-testid="inform-insurer-open"
                >
                  Inform Insurer / बीमाकर्ता सूचित करें
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <InformInsurerSheet
        open={!!sheetFor}
        onClose={() => setSheetFor(null)}
        insurerName={sheetFor?.insurerName}
        message={sheetMessage}
        cashlessHelpline={sheetFor?.cashlessHelpline}
        claimHelpline={sheetFor?.claimHelpline}
      />
    </section>
  );
}

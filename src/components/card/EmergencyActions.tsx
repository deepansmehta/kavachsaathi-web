"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FeatureFlags } from "@/lib/features/flags";

const FullDetailsModal = dynamic(
  () =>
    import("./FullDetailsModal").then((m) => ({ default: m.FullDetailsModal })),
  { ssr: false, loading: () => null }
);

/**
 * Tiny client island: scan beacon + Full Details opener.
 * Deferred so first paint stays server HTML.
 */
export function EmergencyActions({
  scanToken,
  healthId,
  sectionsRendered,
  flags,
}: {
  scanToken: string;
  healthId: string;
  sectionsRendered: string[];
  flags?: FeatureFlags;
}) {
  const [open, setOpen] = useState(false);
  void flags;

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanToken,
          locationShared: false,
          emergencyMode: false,
          sectionsRendered,
        }),
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(t);
  }, [scanToken, sectionsRendered]);

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid rgba(212,175,55,0.45)",
          background: "#141410",
          color: "#FCE49A",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Open Full Details
      </button>
      <p
        style={{
          marginTop: 10,
          fontSize: 12,
          color: "#A8A59C",
          textAlign: "center",
        }}
      >
        Hospital admission · PIN or logged emergency access
      </p>
      {open && healthId ? (
        <FullDetailsModal
          healthId={healthId}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

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
    <div className="ks-full-details">
      <button
        type="button"
        className="ks-full-btn"
        onClick={() => setOpen(true)}
        aria-label="Open full details for hospital admission"
      >
        Open Full Details — Hospital Admission
      </button>
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

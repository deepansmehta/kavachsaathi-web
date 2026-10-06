"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** F51 — capture ?ref=CODE into 30-day cookie + record click when referral flag on. */
export function ReferralCapture() {
  const params = useSearchParams();
  useEffect(() => {
    const code = (params.get("ref") || "").trim().toUpperCase().slice(0, 16);
    if (!code) return;
    try {
      document.cookie = `ks_ref=${encodeURIComponent(code)};path=/;max-age=${
        30 * 24 * 60 * 60
      };SameSite=Lax`;
    } catch {
      /* */
    }
    void fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "click", code }),
    }).catch(() => {});
  }, [params]);
  return null;
}

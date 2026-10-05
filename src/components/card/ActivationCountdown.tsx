"use client";

import { useEffect, useState, type CSSProperties } from "react";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function ActivationCountdown({
  opensAtIso,
  autoRefresh = false,
}: {
  opensAtIso: string;
  /** When true, reload the page once the countdown hits zero. */
  autoRefresh?: boolean;
}) {
  const opensMs = Date.parse(opensAtIso);
  const [now, setNow] = useState(() => Date.now());
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!autoRefresh || refreshed || Number.isNaN(opensMs)) return;
    if (Date.now() >= opensMs) {
      setRefreshed(true);
      // Small delay so "open" flash is visible, then reload
      const t = setTimeout(() => {
        window.location.reload();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [now, opensMs, autoRefresh, refreshed]);

  if (Number.isNaN(opensMs)) return null;

  const diff = Math.max(0, opensMs - now);
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (diff <= 0) {
    return (
      <p style={{ color: "#D4AF37", fontWeight: 600, fontSize: 14 }}>
        Activation is open — refreshing…
      </p>
    );
  }

  const cell: CSSProperties = {
    minWidth: 56,
    padding: "10px 8px",
    borderRadius: 10,
    background: "#0c0c0a",
    border: "1px solid rgba(212,175,55,0.28)",
  };

  return (
    <div
      aria-live="polite"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 8,
      }}
    >
      {[
        { label: "Days", value: days },
        { label: "Hrs", value: hours },
        { label: "Min", value: minutes },
        { label: "Sec", value: seconds },
      ].map((u) => (
        <div key={u.label} style={cell}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#FCE49A",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pad(u.value)}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#A8A59C",
              marginTop: 4,
            }}
          >
            {u.label}
          </div>
        </div>
      ))}
    </div>
  );
}

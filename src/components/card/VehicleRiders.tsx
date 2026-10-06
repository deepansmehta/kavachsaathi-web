"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Rider = {
  health_id: string;
  firstName: string;
  photo: string | null;
};

/** F50 — vehicle sticker public page */
export function VehicleRiders({
  vehicleLabel,
  healthId,
}: {
  vehicleLabel: string | null;
  healthId: string;
}) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [label, setLabel] = useState(vehicleLabel);

  useEffect(() => {
    void fetch(`/api/vehicle?health_id=${encodeURIComponent(healthId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.riders)) setRiders(j.riders);
        if (j.vehicleLabel) setLabel(j.vehicleLabel);
      })
      .catch(() => {});
  }, [healthId]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#F0EEE8",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p
        style={{
          color: "#D4AF37",
          letterSpacing: "0.16em",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        KAVACHSAATHI · VEHICLE
      </p>
      <h1 style={{ fontSize: 22, margin: "12px 0" }}>
        Rider of this vehicle may be one of:
      </h1>
      {label && (
        <p style={{ color: "#A8A59C", marginBottom: 16 }}>{label}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {riders.map((r) => (
          <Link
            key={r.health_id}
            href={`/card/${r.health_id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 12,
              border: "1px solid rgba(212,175,55,0.35)",
              background: "#141410",
              color: "#F0EEE8",
              textDecoration: "none",
            }}
          >
            {r.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.photo}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#1a1a14",
                  border: "1px solid #333",
                }}
              />
            )}
            <span style={{ fontSize: 18, fontWeight: 700 }}>{r.firstName}</span>
          </Link>
        ))}
        {riders.length === 0 && (
          <p style={{ color: "#A8A59C" }}>No riders linked yet.</p>
        )}
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { FeatureFlags } from "@/lib/features/flags";

type Contact = { name: string; phone: string; relation?: string };

/**
 * Phase 1 client island: Alert Family + Quick Call bar.
 * Kept separate so EmergencyLite SSR stays fast when flags are off.
 */
export function EmergencyPhase1({
  flags,
  healthId,
  contacts,
  firstName,
}: {
  flags: FeatureFlags;
  healthId: string;
  contacts: Contact[];
  firstName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<
    { name: string; tel: string; whatsapp: string }[] | null
  >(null);
  const [err, setErr] = useState("");

  const first = contacts[0];
  const familyTel = useMemo(() => {
    const p = String(first?.phone || "").replace(/\D/g, "").slice(-10);
    return /^[6-9]\d{9}$/.test(p) ? `tel:+91${p}` : null;
  }, [first]);

  const nearestHospital = () => {
    if (!navigator.geolocation) {
      window.open(
        "https://www.google.com/maps/search/hospital+near+me",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        window.open(
          `https://www.google.com/maps/search/hospital/@${lat},${lng},14z`,
          "_blank",
          "noopener,noreferrer"
        );
      },
      () => {
        window.open(
          "https://www.google.com/maps/search/hospital+near+me",
          "_blank",
          "noopener,noreferrer"
        );
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 }
    );
  };

  const alertFamily = () => {
    setBusy(true);
    setErr("");
    const run = (lat?: number, lng?: number, locationShared = false) => {
      void fetch("/api/alert-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_id: healthId,
          locationShared,
          lat: lat ?? null,
          lng: lng ?? null,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed");
          setLinks(data.contacts || []);
          const firstWa = data.contacts?.[0]?.whatsapp;
          if (firstWa) window.open(firstWa, "_blank", "noopener,noreferrer");
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
        .finally(() => setBusy(false));
    };

    if (!navigator.geolocation) {
      run(undefined, undefined, false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => run(pos.coords.latitude, pos.coords.longitude, true),
      () => run(undefined, undefined, false),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 }
    );
  };

  if (!flags.alertFamily && !flags.quickCall) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {flags.alertFamily && (
        <div
          style={{
            border: "1px solid rgba(229,57,53,0.5)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            background: "#1a0c0c",
          }}
        >
          <button
            type="button"
            disabled={busy || !healthId}
            onClick={alertFamily}
            style={{
              width: "100%",
              minHeight: 48,
              borderRadius: 10,
              border: "none",
              background: "#E53935",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {busy
              ? "Preparing…"
              : `Alert Family / परिवार को सूचना दें`}
          </button>
          <p style={{ fontSize: 11, color: "#A8A59C", margin: "8px 0 0" }}>
            Opens WhatsApp with a pre-filled emergency message
            {firstName ? ` for ${firstName}` : ""}. Location optional.
          </p>
          {err ? (
            <p style={{ color: "#E53935", fontSize: 12, marginTop: 6 }}>{err}</p>
          ) : null}
          {links && links.length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {links.map((c, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                >
                  <a
                    href={c.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkBtn}
                  >
                    WhatsApp {c.name}
                  </a>
                  <a href={c.tel} style={linkBtnOutline}>
                    Call {c.name}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {flags.quickCall && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: "10px 0 4px",
            background: "linear-gradient(180deg, transparent, #080808 30%)",
          }}
        >
          <a href="tel:108" style={stickyBtn}>
            108 Ambulance
          </a>
          <a href="tel:112" style={stickyBtn}>
            112 Emergency
          </a>
          {familyTel ? (
            <a href={familyTel} style={stickyBtn}>
              Call Family
            </a>
          ) : (
            <span style={{ ...stickyBtn, opacity: 0.4 }}>Call Family</span>
          )}
          <button type="button" onClick={nearestHospital} style={stickyBtn}>
            Nearest Hospital
          </button>
        </div>
      )}
    </div>
  );
}

const linkBtn: CSSProperties = {
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
  background: "#25D366",
  color: "#062",
  fontWeight: 700,
  padding: "10px 8px",
  borderRadius: 8,
  fontSize: 13,
  minHeight: 44,
};
const linkBtnOutline: CSSProperties = {
  ...linkBtn,
  background: "transparent",
  color: "#FCE49A",
  border: "1px solid #D4AF37",
};
const stickyBtn: CSSProperties = {
  textAlign: "center",
  textDecoration: "none",
  background: "#141410",
  color: "#FCE49A",
  border: "1px solid rgba(212,175,55,0.45)",
  borderRadius: 10,
  padding: "12px 8px",
  fontWeight: 700,
  fontSize: 12,
  minHeight: 44,
  cursor: "pointer",
  fontFamily: "inherit",
};

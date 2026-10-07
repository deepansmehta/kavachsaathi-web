"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type CSSProperties } from "react";
import type { FeatureFlags } from "@/lib/features/flags";

const NeedBloodButton = dynamic(
  () =>
    import("./NeedBloodButton").then((m) => ({ default: m.NeedBloodButton })),
  { ssr: false, loading: () => null }
);

type Contact = { name: string; phone: string; relation?: string };

/**
 * Sticky emergency action bar — client island.
 * Call 108 · Call Family · Alert Family · Need Blood
 */
export function EmergencyStickyBar({
  flags,
  healthId,
  contacts,
  firstName,
  bloodGroup,
}: {
  flags: FeatureFlags;
  healthId: string;
  contacts: Contact[];
  firstName: string;
  bloodGroup: string;
}) {
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<
    { name: string; tel: string; whatsapp: string }[] | null
  >(null);
  const [err, setErr] = useState("");
  const [needBloodOpen, setNeedBloodOpen] = useState(false);

  const first = contacts[0];
  const familyTel = useMemo(() => {
    const p = String(first?.phone || "").replace(/\D/g, "").slice(-10);
    return /^[6-9]\d{9}$/.test(p) ? `tel:+91${p}` : null;
  }, [first]);

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

  const showBar =
    flags.quickCall || flags.alertFamily || flags.needBlood === true;
  if (!showBar) return null;

  return (
    <>
      {needBloodOpen && flags.needBlood === true && healthId ? (
        <div style={needBloodSheet} role="dialog" aria-label="Need blood">
          <NeedBloodButton
            healthId={healthId}
            bloodGroup={bloodGroup}
            compact={false}
            forceOpen
          />
          <button
            type="button"
            onClick={() => setNeedBloodOpen(false)}
            style={closeSheet}
            aria-label="Close need blood"
          >
            Close
          </button>
        </div>
      ) : null}

      {err ? (
        <p role="alert" style={errBox}>
          {err}
        </p>
      ) : null}

      {links && links.length > 0 ? (
        <div style={linkSheet} role="status">
          {links.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={c.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                style={waLink}
                aria-label={`WhatsApp ${c.name}`}
              >
                WhatsApp {c.name}
              </a>
              <a href={c.tel} style={callLink} aria-label={`Call ${c.name}`}>
                Call {c.name}
              </a>
            </div>
          ))}
        </div>
      ) : null}

      <div className="ks-sticky" role="toolbar" aria-label="Emergency actions">
        {flags.quickCall ? (
          <a
            href="tel:108"
            className="ks-sticky-btn ks-sticky-primary"
            aria-label="Call 108 ambulance"
          >
            Call 108
          </a>
        ) : null}
        {flags.quickCall ? (
          familyTel ? (
            <a
              href={familyTel}
              className="ks-sticky-btn"
              aria-label={`Call family${first?.name ? `: ${first.name}` : ""}`}
            >
              Call Family
            </a>
          ) : (
            <span className="ks-sticky-btn ks-sticky-disabled" aria-disabled>
              Call Family
            </span>
          )
        ) : null}
        {flags.alertFamily ? (
          <button
            type="button"
            className="ks-sticky-btn"
            disabled={busy || !healthId}
            onClick={alertFamily}
            aria-label={
              busy
                ? "Preparing alert"
                : `Alert family${firstName ? ` for ${firstName}` : ""}`
            }
          >
            {busy ? "…" : "Alert Family"}
          </button>
        ) : null}
        {flags.needBlood === true && healthId ? (
          <button
            type="button"
            className="ks-sticky-btn"
            onClick={() => setNeedBloodOpen(true)}
            aria-label="Need blood help"
          >
            Need Blood
          </button>
        ) : null}
      </div>
    </>
  );
}

const needBloodSheet: CSSProperties = {
  position: "fixed",
  bottom: 72,
  left: 12,
  right: 12,
  maxWidth: 456,
  margin: "0 auto",
  zIndex: 42,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(11,8,18,0.18)",
  padding: 8,
};
const closeSheet: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: 12,
  border: "none",
  background: "transparent",
  color: "#5c574e",
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 48,
};
const linkSheet: CSSProperties = {
  position: "fixed",
  bottom: 72,
  left: 12,
  right: 12,
  maxWidth: 456,
  margin: "0 auto",
  zIndex: 40,
  background: "#fff",
  border: "1px solid rgba(212,175,55,0.35)",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 8,
};
const errBox: CSSProperties = {
  position: "fixed",
  bottom: 72,
  left: 12,
  right: 12,
  maxWidth: 456,
  margin: "0 auto",
  background: "#fff5f5",
  color: "#C62828",
  border: "1px solid #ffcdd2",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  zIndex: 41,
};
const waLink: CSSProperties = {
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
  background: "#25D366",
  color: "#062",
  fontWeight: 700,
  padding: "12px 8px",
  borderRadius: 8,
  fontSize: 14,
  minHeight: 48,
};
const callLink: CSSProperties = {
  ...waLink,
  background: "transparent",
  color: "#0B0812",
  border: "1px solid #D4AF37",
};

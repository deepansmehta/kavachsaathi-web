"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicEmergencyProfile } from "@/lib/cardsRepo";
import { loadLang, saveLang, t, type Lang } from "@/lib/i18n-emergency";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { telLink, whatsappLink } from "@/lib/profileFields";
import { FullDetailsModal } from "./FullDetailsModal";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const GOLD_DARK = "#B8860B";
const CARD = "#141410";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";
const DANGER = "#E53935";

type Coords = { lat: number; lng: number };

export function EmergencyView({
  profile,
  scanToken,
}: {
  profile: PublicEmergencyProfile;
  /** Opaque token for scan API — not a health_id */
  scanToken: string;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locBanner, setLocBanner] = useState(true);
  const [locShared, setLocShared] = useState(false);
  const [emergencySent, setEmergencySent] = useState(false);
  const [fullDetailsOpen, setFullDetailsOpen] = useState(false);

  useEffect(() => {
    setLang(loadLang());
  }, []);

  const setLanguage = (l: Lang) => {
    setLang(l);
    saveLang(l);
  };

  const postScan = useCallback(
    async (opts: { locationShared?: boolean; emergencyMode?: boolean }) => {
      try {
        await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanToken,
            locationShared: opts.locationShared ?? locShared,
            emergencyMode: opts.emergencyMode ?? false,
            sectionsRendered: profile.sectionsRendered,
          }),
        });
      } catch {
        /* never break UI */
      }
    },
    [scanToken, locShared, profile.sectionsRendered]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void postScan({});
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocBanner(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocShared(true);
        setLocBanner(false);
        void postScan({ locationShared: true });
      },
      () => setLocBanner(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  };

  const mapsUrl = coords
    ? `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},14z`
    : "https://www.google.com/maps/search/hospital+near+me";

  const hasCritical = profile.criticalAlertLabels.length > 0;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <LanguageSwitcher
        enabled
        onLangChange={(l) => {
          setLang(l);
          saveLang(l);
        }}
      />

      {hasCritical && (
        <div
          style={{
            background: DANGER,
            color: "#fff",
            textAlign: "center",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "12px",
            margin: "0 -4px 12px",
            borderRadius: 8,
          }}
        >
          ⚠ {t("critical", lang)}
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, letterSpacing: 0, textTransform: "none" }}>
            {profile.criticalAlertLabels.join(" · ")}
          </div>
        </div>
      )}

      <div
        style={{
          background: DANGER,
          color: "#fff",
          textAlign: "center",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "10px 12px",
          margin: "0 -4px 16px",
          borderRadius: 8,
        }}
      >
        {t("emergencyMedical", lang)}
      </div>

      {locBanner && (
        <div
          style={{
            background: CARD,
            border: `1px solid ${GOLD}55`,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 14,
            fontSize: 14,
            color: TEXT,
          }}
        >
          <p style={{ margin: "0 0 10px", color: MUTED }}>{t("shareLocation", lang)}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={requestLocation} style={btnGold}>
              {t("allowLocation", lang)}
            </button>
            <button type="button" onClick={() => setLocBanner(false)} style={btnGhost}>
              {t("dismiss", lang)}
            </button>
          </div>
        </div>
      )}

      {locShared && (
        <p style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>
          {t("locationShared", lang)}
        </p>
      )}

      <header style={{ textAlign: "center", marginBottom: 16 }}>
        {(profile.photoSignedUrl || profile.photo_url?.startsWith("http")) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoSignedUrl || profile.photo_url || ""}
            alt=""
            width={112}
            height={112}
            style={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${GOLD}`,
              marginBottom: 10,
            }}
          />
        )}
        <div
          style={{
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 700,
          }}
        >
          KavachSaathi
        </div>
        <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{t("tagline", lang)}</p>
        <h1
          style={{
            margin: "16px 0 4px",
            fontSize: 28,
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontWeight: 700,
            color: TEXT,
          }}
        >
          {profile.name}
        </h1>
        {profile.city ? (
          <p style={{ color: MUTED, fontSize: 14 }}>
            {t("city", lang)}: {profile.city}
          </p>
        ) : null}
        {(profile.insurerName || profile.schemeName) && (
          <p style={{ color: GOLD_LIGHT, fontSize: 13, marginTop: 8 }}>
            {profile.insurerName ? `Insured with: ${profile.insurerName}` : null}
            {profile.insurerName && profile.schemeName ? " · " : null}
            {profile.schemeName ? `Govt scheme: ${profile.schemeName}` : null}
          </p>
        )}
      </header>

      <a href="tel:108" style={{ ...btnGold, display: "block", marginBottom: 10, textAlign: "center", textDecoration: "none" }}>
        🚑 {t("callAmbulance", lang)}
      </a>
      <button
        type="button"
        onClick={() => setFullDetailsOpen(true)}
        style={{
          ...btnGold,
          display: "block",
          width: "100%",
          marginBottom: 14,
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        Open Full Details — Hospital Admission
        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, opacity: 0.85 }}>
          पूरी जानकारी देखें — अस्पताल भर्ती
        </div>
      </button>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...btnGhost, display: "block", marginBottom: 14, textAlign: "center", textDecoration: "none" }}
      >
        🏥 {t("nearbyHospitals", lang)}
      </a>

      <section
        style={{
          background: CARD,
          borderRadius: 16,
          border: `1px solid ${GOLD}44`,
          padding: "28px 16px",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
          {t("bloodGroup", lang)}
        </p>
        <p
          style={{
            fontSize: 72,
            lineHeight: 1,
            fontWeight: 800,
            fontFamily: "Rajdhani, system-ui, sans-serif",
            background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {profile.blood_group}
        </p>
      </section>

      {hasCritical && (
        <Section title={t("criticalAlerts", lang)}>
          <ChipList items={profile.criticalAlertLabels} empty={t("noneReported", lang)} danger />
        </Section>
      )}

      <Section title={t("allergies", lang)}>
        <ChipList items={profile.allergies} empty={t("noneReported", lang)} danger />
      </Section>
      <Section title={t("chronic", lang)}>
        <ChipList items={profile.chronic_conditions} empty={t("noneReported", lang)} />
      </Section>
      <Section title={t("medications", lang)}>
        <ChipList items={profile.medications} empty={t("noneReported", lang)} />
      </Section>

      {profile.organDonor && profile.organDonor !== "unset" && (
        <Section title={t("organDonor", lang)}>
          <p style={{ color: TEXT, fontSize: 16, fontWeight: 600 }}>
            {profile.organDonor === "yes" ? t("yes", lang) : t("no", lang)}
          </p>
        </Section>
      )}

      {profile.preferredHospital && (
        <Section title={t("preferredHospital", lang)}>
          <p style={{ color: TEXT, fontSize: 16 }}>{profile.preferredHospital}</p>
        </Section>
      )}

      <Section title={t("contacts", lang)}>
        {profile.emergency_contacts.length === 0 ? (
          <p style={{ color: MUTED }}>{t("notProvided", lang)}</p>
        ) : (
          profile.emergency_contacts.map((c, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>
                {c.name}
                {c.relation ? (
                  <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>
                    {" "}· {c.relation}
                  </span>
                ) : null}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {telLink(c.phone) && (
                  <a href={telLink(c.phone)!} style={{ ...btnGold, textAlign: "center", textDecoration: "none" }}>
                    📞 {t("call", lang)} {c.name}
                  </a>
                )}
                {whatsappLink(c.phone) && (
                  <a
                    href={whatsappLink(c.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...btnGhost, textAlign: "center", textDecoration: "none" }}
                  >
                    {t("whatsapp", lang)}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </Section>

      {profile.family_doctor && (
        <Section title={t("familyDoctor", lang)}>
          <p style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>
            {profile.family_doctor.name}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {telLink(profile.family_doctor.phone) && (
              <a
                href={telLink(profile.family_doctor.phone)!}
                style={{ ...btnGold, textAlign: "center", textDecoration: "none" }}
              >
                📞 {t("call", lang)}
              </a>
            )}
            {whatsappLink(profile.family_doctor.phone) && (
              <a
                href={whatsappLink(profile.family_doctor.phone)!}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnGhost, textAlign: "center", textDecoration: "none" }}
              >
                {t("whatsapp", lang)}
              </a>
            )}
          </div>
        </Section>
      )}

      <button
        type="button"
        onClick={async () => {
          await postScan({ emergencyMode: true, locationShared: locShared });
          setEmergencySent(true);
        }}
        disabled={emergencySent}
        style={{
          ...btnGhost,
          width: "100%",
          marginTop: 8,
          borderColor: DANGER,
          color: "#FF8A80",
          cursor: emergencySent ? "default" : "pointer",
        }}
      >
        {emergencySent ? t("emergencySent", lang) : t("thisIsEmergency", lang)}
      </button>

      <p style={{ marginTop: 24, textAlign: "center", color: MUTED, fontSize: 12 }}>
        GDM Technoworld · kavachsaathi.in
      </p>

      <FullDetailsModal
        healthId={profile.health_id || ""}
        open={fullDetailsOpen && Boolean(profile.health_id)}
        onClose={() => setFullDetailsOpen(false)}
      />
    </div>
  );
}

function LangBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${active ? GOLD : GOLD + "44"}`,
        background: active ? "rgba(212,175,55,0.2)" : "transparent",
        color: active ? GOLD_LIGHT : MUTED,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: CARD,
        borderRadius: 14,
        border: `1px solid ${GOLD}33`,
        padding: "18px 16px",
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontFamily: "Rajdhani, system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: GOLD,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChipList({
  items,
  empty,
  danger,
}: {
  items: string[];
  empty: string;
  danger?: boolean;
}) {
  if (!items.length) {
    return <p style={{ color: MUTED, fontSize: 15 }}>{empty}</p>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            background: danger ? "rgba(229,57,53,0.15)" : "rgba(212,175,55,0.12)",
            color: danger ? "#FF8A80" : GOLD_LIGHT,
            border: `1px solid ${danger ? "rgba(229,57,53,0.35)" : GOLD + "44"}`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

const btnGold: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "14px 16px",
  borderRadius: 10,
  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
  color: "#0A0A08",
  fontWeight: 700,
  fontSize: 16,
  border: "none",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  background: "transparent",
  color: GOLD_LIGHT,
  fontWeight: 600,
  fontSize: 15,
  border: `1px solid ${GOLD}66`,
  cursor: "pointer",
};

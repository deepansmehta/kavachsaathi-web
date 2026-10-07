"use client";

/**
 * /schemes — Public health scheme guide (always open, no launch gate).
 * Bilingual EN/HI. Gated by schemeGuide feature flag (shows feature-off message if OFF).
 * Footer: "Verify on the official portal."
 */

import { useEffect, useState } from "react";
import {
  SCHEMES,
  E_RAKT_KOSH,
  JAN_AUSHADHI_INFO,
  verifiedSchemes,
  schemesFooterNote,
  type OfficialScheme,
} from "@/lib/patientEase/officialLinks";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const CARD = "#141410";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";

type Lang = "en" | "hi";

const UI = {
  en: {
    title: "Government Health Schemes",
    subtitle: "Schemes you may be eligible for",
    eligibility: "Eligibility",
    check: "Check Eligibility ↗",
    hospitals: "Empanelled Hospitals ↗",
    helpline: "Helpline",
    official: "Official site ↗",
    bloodBank: "Blood Banks (e-RaktKosh)",
    janAushadhi: "Jan Aushadhi Kendra",
    disclaimer: schemesFooterNote("en"),
    featureOff: "Scheme guide is currently not available.",
    loading: "Loading…",
  },
  hi: {
    title: "सरकारी स्वास्थ्य योजनाएं",
    subtitle: "जिन योजनाओं के लिए आप पात्र हो सकते हैं",
    eligibility: "पात्रता",
    check: "पात्रता जांचें ↗",
    hospitals: "सूचीबद्ध अस्पताल ↗",
    helpline: "हेल्पलाइन",
    official: "आधिकारिक साइट ↗",
    bloodBank: "रक्त बैंक (e-RaktKosh)",
    janAushadhi: "जनऔषधि केंद्र",
    disclaimer: schemesFooterNote("hi"),
    featureOff: "स्कीम गाइड अभी उपलब्ध नहीं है।",
    loading: "लोड हो रहा है…",
  },
} as const;

// Pre-compute at module level — avoids re-render cost
const verified = verifiedSchemes();

export default function SchemesPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [flagOn, setFlagOn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setFlagOn(Boolean(d?.flags?.schemeGuide)))
      .catch(() => setFlagOn(true)); // show on error (static public page)
  }, []);

  const u = UI[lang];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A08",
        color: TEXT,
        fontFamily: "system-ui, sans-serif",
        padding: "0 0 40px",
      }}
    >
      {/* Nav bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${GOLD}33`,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <a href="/" style={{ color: GOLD, fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
          ← KavachSaathi
        </a>
        <button
          type="button"
          onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
          style={{
            background: "transparent",
            border: `1px solid ${GOLD}66`,
            color: GOLD_LIGHT,
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {lang === "en" ? "हिंदी" : "English"}
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        <h1
          style={{
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontSize: 26,
            fontWeight: 700,
            color: GOLD_LIGHT,
            marginBottom: 4,
          }}
        >
          {u.title}
        </h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>{u.subtitle}</p>

        {flagOn === null && (
          <p style={{ color: MUTED }}>{u.loading}</p>
        )}

        {flagOn === false && (
          <div
            style={{
              background: CARD,
              border: `1px solid ${GOLD}44`,
              borderRadius: 12,
              padding: 20,
              color: MUTED,
              fontSize: 15,
            }}
          >
            {u.featureOff}
          </div>
        )}

        {(flagOn === true || flagOn === null) && (
          <>
            {(flagOn === true ? verified : SCHEMES).map((s: OfficialScheme) => (
              <SchemeCard key={s.id} scheme={s} lang={lang} u={u} />
            ))}

            {/* e-RaktKosh */}
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>
                {lang === "en" ? E_RAKT_KOSH.labelEn : E_RAKT_KOSH.labelHi}
              </h2>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>
                {lang === "en" ? E_RAKT_KOSH.descEn : E_RAKT_KOSH.descHi}
              </p>
              <a
                href={E_RAKT_KOSH.url}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtnStyle}
              >
                {u.bloodBank} ↗
              </a>
            </div>

            {/* Jan Aushadhi */}
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>
                {lang === "en" ? JAN_AUSHADHI_INFO.labelEn : JAN_AUSHADHI_INFO.labelHi}
              </h2>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>
                {lang === "en" ? JAN_AUSHADHI_INFO.descEn : JAN_AUSHADHI_INFO.descHi}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={JAN_AUSHADHI_INFO.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkBtnStyle}
                >
                  {u.janAushadhi} ↗
                </a>
                <a
                  href={JAN_AUSHADHI_INFO.locatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...linkBtnStyle, background: "transparent", border: `1px solid ${GOLD}66`, color: GOLD_LIGHT }}
                >
                  Find Kendra ↗
                </a>
              </div>
            </div>
          </>
        )}

        {/* Disclaimer footer */}
        <p
          style={{
            marginTop: 32,
            fontSize: 12,
            color: MUTED,
            borderTop: `1px solid ${GOLD}22`,
            paddingTop: 16,
            lineHeight: 1.5,
          }}
        >
          ⚠ {u.disclaimer}
        </p>
        <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
          GDM Technoworld · kavachsaathi.in
        </p>
      </div>
    </div>
  );
}

function SchemeCard({
  scheme,
  lang,
  u,
}: {
  scheme: OfficialScheme;
  lang: Lang;
  u: (typeof UI)[Lang];
}) {
  return (
    <div style={cardStyle}>
      <h2 style={sectionTitleStyle}>
        {lang === "en" ? scheme.nameEn : scheme.nameHi}
      </h2>
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
        {u.eligibility}:
      </p>
      <p style={{ fontSize: 14, color: TEXT, marginBottom: 12, lineHeight: 1.55 }}>
        {lang === "en" ? scheme.eligibilityEn : scheme.eligibilityHi}
      </p>

      {scheme.helpline && (
        <p style={{ fontSize: 13, color: GOLD_LIGHT, marginBottom: 8 }}>
          {u.helpline}: <strong>{scheme.helpline}</strong>
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {scheme.eligibilityCheckUrl && (
          <a
            href={scheme.eligibilityCheckUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
          >
            {u.check}
          </a>
        )}
        {scheme.hospitalsUrl && (
          <a
            href={scheme.hospitalsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...linkBtnStyle, background: "transparent", border: `1px solid ${GOLD}66`, color: GOLD_LIGHT }}
          >
            {u.hospitals}
          </a>
        )}
        <a
          href={scheme.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...linkBtnStyle, background: "transparent", border: `1px solid ${GOLD}44`, color: MUTED }}
        >
          {u.official}
        </a>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${GOLD}33`,
  borderRadius: 14,
  padding: "18px 16px",
  marginBottom: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "Rajdhani, system-ui, sans-serif",
  fontSize: 16,
  fontWeight: 700,
  color: GOLD,
  marginBottom: 10,
  letterSpacing: "0.02em",
};

const linkBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 8,
  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
  color: "#0A0A08",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  cursor: "pointer",
};

"use client";

import { useEffect, useState } from "react";
import {
  SUPPORTED_LANGS,
  REVIEW_NOTICE,
  isReviewedLang,
  loadLang,
  saveLang,
  t,
  type DictKey,
  type Lang,
} from "@/lib/i18n-emergency";

type Props = {
  enabled: boolean;
  /** Compact for activation wizard header */
  compact?: boolean;
  onLangChange?: (lang: Lang) => void;
};

/** Language switcher — only when regionalLang flag is ON. Never translates user data. */
export function LanguageSwitcher({ enabled, compact, onLangChange }: Props) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    if (!enabled) return;
    const l = loadLang();
    setLang(l);
    onLangChange?.(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  const set = (l: Lang) => {
    setLang(l);
    saveLang(l);
    onLangChange?.(l);
  };

  return (
    <div style={{ marginBottom: compact ? 8 : 12 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: compact ? "flex-start" : "flex-end",
          gap: 6,
        }}
      >
        {SUPPORTED_LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => set(l.code)}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 6,
              border:
                lang === l.code
                  ? "1px solid #D4AF37"
                  : "1px solid rgba(212,175,55,0.25)",
              background: lang === l.code ? "#D4AF37" : "transparent",
              color: lang === l.code ? "#080808" : "#A8A59C",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      {!isReviewedLang(lang) ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 10,
            color: "#FCE49A",
            textAlign: compact ? "left" : "right",
          }}
        >
          {REVIEW_NOTICE}
        </p>
      ) : null}
    </div>
  );
}

/** Hook for label lookup when regionalLang is on. */
export function useEmergencyLabels(enabled: boolean) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    if (enabled) setLang(loadLang());
  }, [enabled]);
  const label = (key: DictKey | string) =>
    enabled ? t(key, lang) : t(key, "en");
  return { lang, setLang, label };
}

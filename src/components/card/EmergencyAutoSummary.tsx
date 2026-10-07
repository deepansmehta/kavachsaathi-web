"use client";

import { useEffect, useState } from "react";
import { loadLang, type Lang } from "@/lib/i18n-emergency";

/**
 * One-language auto summary (EN default; HI when kavach_lang=hi).
 * Max 3 lines collapsed with Show more / कम दिखाएँ.
 */
export function EmergencyAutoSummary({
  en,
  hi,
  enabled,
}: {
  en: string;
  hi: string;
  enabled: boolean;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLang(loadLang());
    const onLang = (e: Event) => {
      const detail = (e as CustomEvent<Lang>).detail;
      if (detail) setLang(detail);
      else setLang(loadLang());
      setExpanded(false);
    };
    window.addEventListener("kavach-lang", onLang as EventListener);
    return () =>
      window.removeEventListener("kavach-lang", onLang as EventListener);
  }, []);

  if (!enabled) return null;
  const text = lang === "hi" ? hi || en : en || hi;
  if (!text) return null;

  const long = text.length > 160;

  return (
    <div className="ks-summary" role="status" aria-label="Clinical summary">
      <p className="ks-h" data-i18n="autoSummary">
        {lang === "hi" ? "ऑटो सारांश" : "Auto summary"}
      </p>
      <p
        className={`ks-body-text ks-summary-text${expanded ? " ks-summary-open" : ""}`}
        lang={lang === "hi" ? "hi" : "en"}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className="ks-summary-more"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? lang === "hi"
              ? "कम दिखाएँ"
              : "Show less"
            : lang === "hi"
              ? "और देखें"
              : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  verifiedSchemes,
  schemesFooterNote,
  type OfficialScheme,
} from "@/lib/patientEase/officialLinks";

export default function SchemesPage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [ok, setOk] = useState<boolean | null>(null);
  const schemes = verifiedSchemes();

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => setOk(!!d.flags?.schemeGuide))
      .catch(() => setOk(false));
  }, []);

  if (ok === false) {
    return (
      <main className="mx-auto max-w-lg p-6 text-center text-stone-300">
        <h1 className="text-xl font-semibold">Scheme guide unavailable</h1>
        <p className="mt-2 text-sm">This feature is currently off.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[#0c0c0a] px-4 py-8 text-[#F0EEE8]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-[Rajdhani] text-2xl font-bold tracking-wide text-[#D4AF37]">
          {lang === "hi" ? "सरकारी योजना गाइड" : "Government scheme guide"}
        </h1>
        <button
          type="button"
          onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
          className="rounded border border-[#D4AF37]/40 px-3 py-1 text-sm"
        >
          {lang === "en" ? "हिंदी" : "EN"}
        </button>
      </div>
      <p className="mb-6 text-sm text-[#A8A59C]">
        {lang === "hi"
          ? "केवल आधिकारिक लिंक। पात्रता व अस्पताल सूची आधिकारिक पोर्टल पर जाँचें।"
          : "Official links only. Confirm eligibility and hospital lists on the official portals."}
      </p>
      <ul className="space-y-5">
        {schemes.map((s: OfficialScheme) => (
          <li
            key={s.id}
            className="rounded-xl border border-[#D4AF37]/25 bg-[#141410] p-4"
          >
            <h2 className="text-lg font-semibold text-[#FCE49A]">
              {lang === "hi" ? s.nameHi : s.nameEn}
            </h2>
            <p className="mt-2 text-sm text-[#C8C5BB]">
              {lang === "hi" ? s.eligibilityHi : s.eligibilityEn}
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a
                href={s.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D4AF37] underline"
              >
                {lang === "hi" ? "आधिकारिक साइट" : "Official site"}
              </a>
              {s.eligibilityCheckUrl && (
                <a
                  href={s.eligibilityCheckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] underline"
                >
                  {lang === "hi" ? "पात्रता जाँच" : "Eligibility check"}
                </a>
              )}
              {s.hospitalsUrl && (
                <a
                  href={s.hospitalsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] underline"
                >
                  {lang === "hi" ? "एम्पैनल्ड अस्पताल" : "Empanelled hospitals"}
                </a>
              )}
              {s.helpline && (
                <a href={`tel:${s.helpline}`} className="text-[#F0EEE8]">
                  Helpline: {s.helpline}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-xs text-[#A8A59C]">
        {schemesFooterNote(lang)}
      </p>
    </main>
  );
}

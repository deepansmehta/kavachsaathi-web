/**
 * Expand emergency/activation UI strings across locales.
 * User-entered data is NEVER translated — only chrome labels.
 */
import en from "../../locales/en.json";
import hi from "../../locales/hi.json";
import pa from "../../locales/pa.json";
import bn from "../../locales/bn.json";
import gu from "../../locales/gu.json";
import mr from "../../locales/mr.json";
import ta from "../../locales/ta.json";
import te from "../../locales/te.json";
import kn from "../../locales/kn.json";

export type Lang = "en" | "hi" | "pa" | "bn" | "gu" | "mr" | "ta" | "te" | "kn";

export const SUPPORTED_LANGS: { code: Lang; label: string; reviewed: boolean }[] =
  [
    { code: "en", label: "EN", reviewed: true },
    { code: "hi", label: "हिंदी", reviewed: true },
    { code: "pa", label: "ਪੰ", reviewed: false },
    { code: "bn", label: "বাং", reviewed: false },
    { code: "gu", label: "ગુજ", reviewed: false },
    { code: "mr", label: "मर", reviewed: false },
    { code: "ta", label: "தமிழ்", reviewed: false },
    { code: "te", label: "తెల", reviewed: false },
    { code: "kn", label: "ಕನ್", reviewed: false },
  ];

function asTable(mod: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!mod || typeof mod !== "object") return out;
  for (const [k, v] of Object.entries(mod as Record<string, unknown>)) {
    if (k.startsWith("_")) continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

const TABLES: Record<Lang, Record<string, string>> = {
  en: asTable(en),
  hi: asTable(hi),
  pa: asTable(pa),
  bn: asTable(bn),
  gu: asTable(gu),
  mr: asTable(mr),
  ta: asTable(ta),
  te: asTable(te),
  kn: asTable(kn),
};

export type DictKey = keyof typeof en;

export function t(key: DictKey | string, lang: Lang): string {
  const table = TABLES[lang] || TABLES.en;
  const v = table[key];
  if (typeof v === "string" && !v.startsWith("_")) return v;
  const fallback = TABLES.en[key];
  return typeof fallback === "string" ? fallback : String(key);
}

export function isReviewedLang(lang: Lang): boolean {
  return SUPPORTED_LANGS.find((l) => l.code === lang)?.reviewed === true;
}

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem("kavach_lang");
    if (v && TABLES[v as Lang]) return v as Lang;
  } catch {
    /* */
  }
  try {
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (TABLES[nav as Lang]) return nav as Lang;
  } catch {
    /* */
  }
  return "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem("kavach_lang", lang);
  } catch {
    /* */
  }
}

export const REVIEW_NOTICE =
  "Translation under review — English/Hindi is authoritative";

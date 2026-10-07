"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n-emergency";
import { t } from "@/lib/i18n-emergency";

const LanguageSwitcher = dynamic(
  () =>
    import("@/components/LanguageSwitcher").then((m) => ({
      default: m.LanguageSwitcher,
    })),
  { ssr: false, loading: () => null }
);

const ElderlyToggle = dynamic(
  () =>
    import("@/components/ElderlyMode").then((m) => ({
      default: m.ElderlyToggle,
    })),
  { ssr: false, loading: () => null }
);

const ReadAloudButton = dynamic(
  () =>
    import("@/components/ElderlyMode").then((m) => ({
      default: m.ReadAloudButton,
    })),
  { ssr: false, loading: () => null }
);

/**
 * Footer chrome loaded AFTER first paint — language / elderly / read-aloud.
 * Keeps emergency LCP free of i18n and ease-mode JS.
 */
export function EmergencyDeferredFooter({
  regionalLang,
  elderlyOn,
  readText,
}: {
  regionalLang: boolean;
  elderlyOn: boolean;
  readText: string;
}) {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const boot = () => {
      // Devanagari subset only after idle — never blocks first paint
      if (!document.getElementById("ks-noto-deva")) {
        const style = document.createElement("style");
        style.id = "ks-noto-deva";
        style.textContent =
          '@font-face{font-family:"Noto Sans Devanagari";font-style:normal;font-weight:400;font-display:swap;src:url("/fonts/NotoSansDevanagari-Regular.ttf") format("truetype");unicode-range:U+0900-097F,U+A8E0-A8FF}body,.ks-e{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif}';
        document.head.appendChild(style);
      }
      setReady(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(boot, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const tmr = globalThis.setTimeout(boot, 1200);
    return () => globalThis.clearTimeout(tmr);
  }, []);

  useEffect(() => {
    if (!ready || !regionalLang) return;
    const apply = (l: Lang) => {
      document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        el.textContent = t(key, l);
      });
    };
    apply(lang);
  }, [ready, regionalLang, lang]);

  return (
    <footer className="ks-footer">
      <p className="ks-footer-note">
        This access is logged and the cardholder is notified in their access
        log.
      </p>
      <p className="ks-footer-brand">
        Powered by KavachSaathi · GDM Technoworld
      </p>
      {ready ? (
        <div className="ks-footer-tools">
          {regionalLang ? (
            <LanguageSwitcher
              enabled
              light
              onLangChange={(l) => setLang(l)}
            />
          ) : null}
          {elderlyOn ? (
            <div className="ks-footer-ease">
              <ElderlyToggle enabled />
              <ReadAloudButton enabled text={readText} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ks-footer-tools" aria-hidden style={{ minHeight: 48 }} />
      )}
    </footer>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * F55 — Android install prompt + iOS Add to Home Screen sheet.
 * Gated by pwaApp feature flag (caller can pass featureOn).
 */
export function PwaInstallPrompt({ featureOn }: { featureOn: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!featureOn || typeof window === "undefined") return;
    if (localStorage.getItem("ks_pwa_dismiss")) {
      setDismissed(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const ua = navigator.userAgent || "";
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isIos && !standalone) setShowIos(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [featureOn]);

  if (!featureOn || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem("ks_pwa_dismiss", "1");
    setDismissed(true);
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  if (!deferred && !showIos) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 z-50 mx-auto max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-[var(--gold)]" />
        <div className="flex-1">
          <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
            Install KavachSaathi
          </p>
          {deferred ? (
            <>
              <p className="mt-1 text-sm text-[var(--cream-soft)]">
                Add the app for faster access and offline My Emergency Card.
              </p>
              <button
                type="button"
                onClick={() => void install()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-black"
              >
                <Download className="h-4 w-4" /> Install app
              </button>
            </>
          ) : (
            <div className="mt-1 space-y-2 text-sm text-[var(--cream-soft)]">
              <p>Add to Home Screen on iPhone/iPad:</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Tap the Share button in Safari</li>
                <li>Scroll and tap &quot;Add to Home Screen&quot;</li>
                <li>Tap Add</li>
              </ol>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="text-[var(--text-soft)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

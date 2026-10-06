"use client";

import { useEffect, useState } from "react";

const KEY = "kavach_elderly";

export function useElderlyMode() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {
      /* */
    }
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("ks-elderly", on);
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* */
    }
  }, [on]);
  return { on, setOn, toggle: () => setOn((v) => !v) };
}

export function ElderlyToggle({ enabled }: { enabled: boolean }) {
  const { on, toggle } = useElderlyMode();
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        fontSize: on ? 18 : 13,
        padding: on ? "12px 16px" : "8px 12px",
        background: on ? "#D4AF37" : "transparent",
        color: on ? "#080808" : "#D4AF37",
        border: "1px solid #D4AF37",
        borderRadius: 8,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {on ? "Large text ON" : "Large text / बड़ा अक्षर"}
    </button>
  );
}

export function ReadAloudButton({
  enabled,
  text,
}: {
  enabled: boolean;
  text: string;
}) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);
  if (!enabled || !supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis.getVoices();
          const hi = voices.find((v) => /hi-IN|Hindi/i.test(v.lang + v.name));
          if (hi) u.voice = hi;
          else u.lang = "en-IN";
          window.speechSynthesis.speak(u);
        } catch {
          /* */
        }
      }}
      style={{
        marginLeft: 8,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #D4AF37",
        background: "#141410",
        color: "#FCE49A",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Read aloud / सुनें
    </button>
  );
}

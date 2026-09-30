"use client";

import { useRouter } from "next/navigation";
import { ActivationForm } from "@/components/card/ActivationForm";
import { EmergencyView } from "@/components/card/EmergencyView";
import type { PublicEmergencyProfile } from "@/lib/cardsRepo";
import { loadLang, saveLang, t, type Lang } from "@/lib/i18n-emergency";
import { useEffect, useState } from "react";

type Props =
  | { mode: "invalid"; message: string }
  | { mode: "rate"; message: string }
  | { mode: "blocked" }
  | { mode: "unactivated"; healthId: string }
  | {
      mode: "activated";
      scanToken: string;
      profile: PublicEmergencyProfile | null;
      message?: string;
    };

const BG = "#080808";

export function CardClient(props: Props) {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(ellipse at top, #1a1608 0%, ${BG} 55%),
          repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(212,175,55,0.03) 24px, rgba(212,175,55,0.03) 25px),
          repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(212,175,55,0.03) 24px, rgba(212,175,55,0.03) 25px)
        `,
        color: "#F0EEE8",
        padding: "24px 16px 48px",
      }}
    >
      {props.mode === "invalid" || props.mode === "rate" ? (
        <Empty
          title={props.mode === "rate" ? "Slow down" : "Invalid Card"}
          body={props.message}
        />
      ) : null}

      {props.mode === "blocked" ? <BlockedNotice /> : null}

      {props.mode === "unactivated" ? (
        <ActivationForm
          healthId={props.healthId}
          onActivated={() => router.refresh()}
        />
      ) : null}

      {props.mode === "activated" ? (
        props.profile ? (
          <EmergencyView profile={props.profile} scanToken={props.scanToken} />
        ) : (
          <Empty
            title="Profile unavailable"
            body={props.message || "Contact KavachSaathi support."}
          />
        )
      ) : null}
    </main>
  );
}

function BlockedNotice() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    setLang(loadLang());
  }, []);
  return (
    <div style={{ maxWidth: 420, margin: "48px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setLang("en");
            saveLang("en");
          }}
          style={langStyle(lang === "en")}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => {
            setLang("hi");
            saveLang("hi");
          }}
          style={langStyle(lang === "hi")}
        >
          हिंदी
        </button>
      </div>
      <Empty title={t("blockedTitle", lang)} body={t("blockedBody", lang)} />
    </div>
  );
}

function langStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? "#D4AF37" : "rgba(212,175,55,0.3)"}`,
    background: active ? "rgba(212,175,55,0.2)" : "transparent",
    color: active ? "#FCE49A" : "#A8A59C",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        maxWidth: 420,
        margin: "48px auto",
        background: "#141410",
        border: "1px solid rgba(212,175,55,0.3)",
        borderRadius: 16,
        padding: 28,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 10, color: "#FCE49A" }}>
        {title}
      </h1>
      <p style={{ color: "#A8A59C", lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

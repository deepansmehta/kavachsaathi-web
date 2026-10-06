"use client";

import { useRouter } from "next/navigation";
import { ActivationForm } from "@/components/card/ActivationForm";

type Props =
  | { mode: "invalid"; message: string }
  | { mode: "rate"; message: string }
  | { mode: "blocked"; message?: string }
  | { mode: "unactivated"; healthId: string };

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
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {props.mode === "invalid" || props.mode === "rate" ? (
        <Empty
          title={props.mode === "rate" ? "Slow down" : "Invalid Card"}
          body={props.message}
        />
      ) : null}

      {props.mode === "blocked" ? (
        <Empty
          title="Card reported lost"
          body={
            props.message ||
            "This KavachSaathi card has been reported lost. If found, please contact +91 94161 06511 or +91 72730 00075."
          }
        />
      ) : null}

      {props.mode === "unactivated" ? (
        <ActivationForm
          healthId={props.healthId}
          onActivated={() => router.refresh()}
        />
      ) : null}
    </main>
  );
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

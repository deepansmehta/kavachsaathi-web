"use client";

import { useRouter } from "next/navigation";
import { ActivationForm } from "@/components/card/ActivationForm";

type Props =
  | { mode: "invalid"; message: string }
  | { mode: "rate"; message: string }
  | { mode: "blocked"; message?: string }
  | { mode: "unactivated"; healthId: string };

export function CardClient(props: Props) {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAFAF7",
        color: "#0B0812",
        padding: "0 0 48px",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#0B0812",
          color: "#F7F4EC",
          padding: "20px 16px 18px",
          borderBottom: "3px solid transparent",
          borderImage: "linear-gradient(90deg,#D4AF37,#E8BF3E,#D4AF37) 1",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "#E8BF3E",
            textAlign: "center",
          }}
        >
          KavachSaathi
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            textAlign: "center",
            color: "rgba(247,244,236,0.78)",
            fontWeight: 600,
          }}
        >
          Emergency Medical Profile / आपातकालीन मेडिकल प्रोफ़ाइल
        </p>
      </div>

      <div style={{ padding: "24px 16px" }}>
        {props.mode === "invalid" || props.mode === "rate" ? (
          <Empty
            title={props.mode === "rate" ? "Slow down" : "Invalid Card"}
            body={props.message}
            tone={props.mode === "rate" ? "warn" : "danger"}
          />
        ) : null}

        {props.mode === "blocked" ? (
          <Empty
            title="Card reported lost"
            body={
              props.message ||
              "This KavachSaathi card has been reported lost. If found, please contact +91 72730 00075 or +91 73001 00102."
            }
            tone="danger"
          />
        ) : null}

        {props.mode === "unactivated" ? (
          <ActivationForm
            healthId={props.healthId}
            onActivated={() => router.refresh()}
          />
        ) : null}
      </div>
    </main>
  );
}

function Empty({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "danger" | "warn";
}) {
  const accent = tone === "danger" ? "#C62828" : "#D4AF37";
  return (
    <div
      style={{
        maxWidth: 420,
        margin: "24px auto",
        background: "#FFFFFF",
        border: `1px solid ${accent}55`,
        borderRadius: 16,
        padding: 28,
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(11,8,18,0.06)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg,#D4AF37,#E8BF3E)`,
          margin: "0 auto 16px",
        }}
      />
      <h1 style={{ fontSize: 24, marginBottom: 10, color: "#0B0812" }}>
        {title}
      </h1>
      <p style={{ color: "#5C574E", lineHeight: 1.55, fontSize: 16 }}>{body}</p>
    </div>
  );
}

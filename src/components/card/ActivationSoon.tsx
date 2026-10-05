/**
 * Branded gate before ACTIVATION_OPENS_AT (real kits only — or demo under launch sim).
 * Server shell + tiny client countdown — activated emergency view is unaffected.
 */
import { getActivationOpensAt } from "@/lib/activationGate";
import { ActivationCountdown } from "./ActivationCountdown";

export function ActivationSoon({
  healthId,
  opensAtIso,
  headline,
}: {
  healthId: string;
  /** Override opens-at (launch sim). */
  opensAtIso?: string;
  headline?: string;
}) {
  const opens = getActivationOpensAt();
  const opensIso =
    opensAtIso ||
    (opens ? opens.toISOString() : "2026-10-11T06:30:00.000Z");
  const title =
    headline || "Activation opens on 11 October 2026, 12:00 PM IST";

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "48px auto",
        background: "#141410",
        border: "1px solid rgba(212,175,55,0.35)",
        borderRadius: 16,
        padding: 28,
        textAlign: "center",
        color: "#F0EEE8",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <p
        style={{
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#D4AF37",
          fontWeight: 700,
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        KavachSaathi
      </p>
      <h1 style={{ fontSize: 24, margin: "0 0 12px", color: "#FCE49A" }}>
        {title}
      </h1>
      <p style={{ color: "#A8A59C", lineHeight: 1.55, marginBottom: 8 }}>
        सक्रियण जल्द ही खुलेगा — कृपया उलटी गिनती समाप्त होने तक प्रतीक्षा करें
      </p>
      <p style={{ color: "#A8A59C", lineHeight: 1.55, marginBottom: 16 }}>
        Your card QR is valid. Keep your packaging code safe until activation
        opens.
      </p>
      <ActivationCountdown opensAtIso={opensIso} autoRefresh />
      <p style={{ fontSize: 13, color: "#6e6b63", marginTop: 16 }}>{healthId}</p>
      <p style={{ marginTop: 20, fontSize: 13, color: "#A8A59C" }}>
        Questions?{" "}
        <a href="mailto:gdmtechnoworld@gmail.com" style={{ color: "#D4AF37" }}>
          gdmtechnoworld@gmail.com
        </a>
      </p>
    </div>
  );
}

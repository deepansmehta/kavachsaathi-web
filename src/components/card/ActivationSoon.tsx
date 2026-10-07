/**
 * Branded gate before ACTIVATION_OPENS_AT (real kits only).
 * Server shell + tiny client countdown — activated emergency view is unaffected.
 */
import { getActivationOpensAt } from "@/lib/activationGate";
import { ActivationCountdown } from "./ActivationCountdown";

export function ActivationSoon({ healthId }: { healthId: string }) {
  const opens = getActivationOpensAt();
  const opensIso = opens ? opens.toISOString() : "2026-10-11T06:30:00.000Z";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAFAF7",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "#0B0812",
          color: "#F7F4EC",
          padding: "20px 16px 18px",
          borderBottom: "3px solid #D4AF37",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            letterSpacing: "0.04em",
            color: "#E8BF3E",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          KavachSaathi
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: "rgba(247,244,236,0.78)",
            fontWeight: 600,
          }}
        >
          Emergency Medical Profile / आपातकालीन मेडिकल प्रोफ़ाइल
        </p>
      </div>

      <div
        style={{
          maxWidth: 420,
          margin: "32px auto",
          background: "#FFFFFF",
          border: "1px solid rgba(11,8,18,0.08)",
          borderRadius: 16,
          padding: 28,
          textAlign: "center",
          color: "#0B0812",
          boxShadow: "0 4px 16px rgba(11,8,18,0.06)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(90deg,#D4AF37,#E8BF3E)",
            margin: "0 auto 16px",
          }}
        />
        <h1 style={{ fontSize: 24, margin: "0 0 12px", color: "#0B0812" }}>
          Activation opens on 11 October 2026, 12:00 PM IST
        </h1>
        <p style={{ color: "#5C574E", lineHeight: 1.55, marginBottom: 8 }}>
          सक्रियण 11 अक्टूबर 2026, दोपहर 12:00 बजे (IST) से खुलेगा
        </p>
        <p style={{ color: "#5C574E", lineHeight: 1.55, marginBottom: 16 }}>
          Your card QR is valid. Keep your packaging code safe until activation
          opens.
        </p>
        <ActivationCountdown opensAtIso={opensIso} />
        <p style={{ fontSize: 13, color: "#8A857A", marginTop: 16 }}>
          {healthId}
        </p>
        <p style={{ marginTop: 20, fontSize: 13, color: "#5C574E" }}>
          Questions?{" "}
          <a href="mailto:gdmtechnoworld@gmail.com" style={{ color: "#8A7010" }}>
            gdmtechnoworld@gmail.com
          </a>
        </p>
      </div>
    </main>
  );
}

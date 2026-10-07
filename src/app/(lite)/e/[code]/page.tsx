import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  getEmergencyData,
  logScanBackground,
} from "@/lib/firebase-server";
import { telHref, formatPhone } from "@/lib/utils";

interface PageProps {
  params: { code: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const data = await getEmergencyData(params.code);
  if (!data || !data.activated) {
    return {
      title: "Emergency Info | KavachSaathi",
      description:
        "Public emergency medical profile powered by KavachSaathi health cards.",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Emergency Info | KavachSaathi",
    description: `Emergency medical info for ${data.name}. Blood group ${data.bloodGroup}. Show this to a doctor in an emergency.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BG = "#0A0A08";
const CARD = "#141410";
const GOLD = "#D4AF37";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";

function display(value: string | null | undefined, fallback = "Not provided") {
  const v = (value || "").trim();
  return v || fallback;
}

function CallButton({ phone, label }: { phone: string; label: string }) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return (
    <a
      href={telHref(phone)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 12,
        width: "100%",
        padding: "12px 16px",
        borderRadius: 10,
        background: GOLD,
        color: "#0A0A08",
        fontFamily: "system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 15,
        textDecoration: "none",
      }}
    >
      📞 {label}
    </a>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: CARD,
        borderRadius: 14,
        border: `1px solid ${GOLD}33`,
        padding: "18px 16px",
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontFamily: "Rajdhani, system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: GOLD,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** PURE SERVER COMPONENT — public, no auth, SSR only */
export default async function EmergencyPage({ params }: PageProps) {
  const data = await getEmergencyData(params.code);

  if (!data || !data.activated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
          <h1
            style={{
              fontFamily: "Rajdhani, system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: GOLD,
              margin: "0 0 8px",
            }}
          >
            Card not activated yet
          </h1>
          <p style={{ color: MUTED, margin: "0 0 24px", lineHeight: 1.5 }}>
            This KavachSaathi card has not been set up.
            <br />
            The owner needs to activate it first.
          </p>
          <Link
            href="/activate"
            style={{ color: GOLD, textDecoration: "underline", fontSize: 14 }}
          >
            Activate your card
          </Link>
        </div>
      </div>
    );
  }

  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  if (data.userUid) {
    logScanBackground(data.code, data.userUid, ip);
  }

  const ec = data.emergencyContact;
  const doctor = data.familyDoctor;
  const conditions = data.medicalConditions;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${GOLD}44`,
          background: CARD,
          padding: "16px 16px 14px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: GOLD,
            letterSpacing: "0.04em",
          }}
        >
          🛡️ KavachSaathi &nbsp; EMERGENCY INFO
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.4,
          }}
        >
          Scan kiya? Yeh details doctor ko dikhayein
        </p>
      </header>

      <main
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "16px 14px 40px",
        }}
      >
        <Section title="👤 Profile">
          <p
            style={{
              margin: 0,
              fontFamily: "Rajdhani, system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: TEXT,
            }}
          >
            {display(data.name)}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 15,
              color: MUTED,
              lineHeight: 1.45,
            }}
          >
            🏠 {display(data.address)}
          </p>
        </Section>

        <Section title="🩸 Blood Group">
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: "Rajdhani, system-ui, sans-serif",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1,
              color: GOLD,
              letterSpacing: "0.02em",
            }}
          >
            {display(data.bloodGroup)}
          </p>
        </Section>

        <Section title="💊 Medical Conditions">
          {conditions.length === 0 ? (
            <p style={{ margin: 0, color: MUTED, fontSize: 15 }}>
              None reported
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 16,
                lineHeight: 1.7,
                color: TEXT,
              }}
            >
              {conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="📞 Emergency Contact">
          {ec ? (
            <>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
                {display(ec.name)}
                {ec.phone ? (
                  <>
                    {" — "}
                    <a
                      href={telHref(ec.phone)}
                      style={{ color: GOLD, textDecoration: "none" }}
                    >
                      {formatPhone(ec.phone)}
                    </a>
                  </>
                ) : (
                  " — Not provided"
                )}
              </p>
              <CallButton phone={ec.phone} label="Tap to call" />
            </>
          ) : (
            <p style={{ margin: 0, color: MUTED }}>Not provided</p>
          )}
        </Section>

        <Section title="👨‍⚕️ Family Doctor">
          {doctor ? (
            <>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
                {display(doctor.name)}
                {doctor.phone ? (
                  <>
                    {" — "}
                    <a
                      href={telHref(doctor.phone)}
                      style={{ color: GOLD, textDecoration: "none" }}
                    >
                      {formatPhone(doctor.phone)}
                    </a>
                  </>
                ) : (
                  " — Not provided"
                )}
              </p>
              <CallButton phone={doctor.phone} label="Tap to call doctor" />
            </>
          ) : (
            <p style={{ margin: 0, color: MUTED }}>Not provided</p>
          )}
        </Section>

        <Section title="🏥 Insurance">
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: "Rajdhani, system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color:
                data.hasInsurance === true
                  ? "#4ADE80"
                  : data.hasInsurance === false
                    ? "#F87171"
                    : MUTED,
            }}
          >
            {data.hasInsurance === true
              ? "✅ YES"
              : data.hasInsurance === false
                ? "❌ NO"
                : "Not provided"}
          </p>
        </Section>

        <footer
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: `1px solid ${GOLD}33`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "Rajdhani, system-ui, sans-serif",
              fontWeight: 700,
              color: GOLD,
              fontSize: 14,
            }}
          >
            Powered by KavachSaathi
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>
            kavachsaathi.in &nbsp;|&nbsp; GDM Techno
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: 16,
              fontSize: 12,
              color: MUTED,
              textDecoration: "underline",
            }}
          >
            Login to manage your profile
          </Link>
        </footer>
      </main>
    </div>
  );
}

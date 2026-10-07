import { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsActivated,
  cardIsBlocked,
  findCardByHealthId,
  loadEmergencyProfile,
  type PublicEmergencyProfile,
} from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId } from "@/lib/healthId";
import { checkRateLimit } from "@/lib/rateLimit";

interface PageProps {
  params: { health_id: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BG = "#080808";
const CARD = "#141410";
const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FCE49A";
const TEXT = "#F0EEE8";
const MUTED = "#A8A59C";
const DANGER = "#E53935";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Emergency Medical Info · KavachSaathi",
    description:
      "Public emergency medical profile. Show this to a doctor — no app needed.",
    robots: { index: false, follow: false },
  };
}

export default async function EmergencyByHealthIdPage({ params }: PageProps) {
  const healthId = normalizeHealthId(decodeURIComponent(params.health_id || ""));

  if (!isValidHealthId(healthId)) {
    return (
      <Frame>
        <Banner />
        <Empty
          title="Invalid card link"
          body="This emergency URL is not valid."
        />
      </Frame>
    );
  }

  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  let profile: PublicEmergencyProfile | null = null;
  let status: "unactivated" | "activated" | "blocked" | "error" | "rate" =
    "error";
  let message = "Unable to load emergency profile.";

  try {
    const db = getAdminDb();
    const rl = await checkRateLimit({
      key: `emergency-page:${ip}`,
      limit: 60,
      windowMs: 60_000,
      captchaAfter: 25,
      db,
    });

    if (!rl.allowed) {
      status = "rate";
      message =
        "Too many requests from this network. Please wait a minute and try again.";
    } else {
      const card = await findCardByHealthId(db, healthId);
      if (!card) {
        message = "Card not found.";
      } else if (cardIsBlocked(card)) {
        status = "blocked";
        message =
          "This card has been blocked by its owner. If you found it, please contact the owner or KavachSaathi support.";
      } else if (!cardIsActivated(card)) {
        status = "unactivated";
        message = "This card has not been activated yet.";
      } else {
        profile = await loadEmergencyProfile(db, card);
        if (profile) {
          status = "activated";
        } else {
          status = "activated";
          message = "Profile unavailable. Contact KavachSaathi support.";
        }
      }
    }
  } catch (e) {
    console.error("emergency page", e);
    message = "Service temporarily unavailable.";
  }

  if (status !== "activated" || !profile) {
    return (
      <Frame>
        <Banner />
        <Empty title={statusTitle(status)} body={message} />
      </Frame>
    );
  }

  return (
    <Frame>
      <Banner />
      <header style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, #B8860B)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 700,
          }}
        >
          KavachSaathi
        </div>
        <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
          Protect · Inform · Save
        </p>
        <h1
          style={{
            margin: "16px 0 4px",
            fontSize: 28,
            fontFamily: "Rajdhani, system-ui, sans-serif",
            fontWeight: 700,
            color: TEXT,
          }}
        >
          {profile.name}
        </h1>
      </header>

      <section
        style={{
          background: CARD,
          borderRadius: 16,
          border: `1px solid ${GOLD}44`,
          padding: "28px 16px",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 8,
          }}
        >
          Blood group
        </p>
        <p
          style={{
            fontSize: 72,
            lineHeight: 1,
            fontWeight: 800,
            fontFamily: "Rajdhani, system-ui, sans-serif",
            background: `linear-gradient(180deg, ${GOLD_LIGHT}, #B8860B)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {profile.blood_group}
        </p>
      </section>

      <Section title="Allergies">
        <ChipList items={profile.allergies} empty="None reported" danger />
      </Section>
      <Section title="Chronic conditions">
        <ChipList items={profile.chronic_conditions} empty="None reported" />
      </Section>
      <Section title="Medications">
        <ChipList items={profile.medications} empty="None reported" />
      </Section>

      <Section title="Emergency contacts">
        {profile.emergency_contacts.length === 0 ? (
          <p style={{ color: MUTED }}>Not provided</p>
        ) : (
          profile.emergency_contacts.map((c, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>
                {c.name}
                {c.relation ? (
                  <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>
                    {" "}
                    · {c.relation}
                  </span>
                ) : null}
              </p>
              <CallButton phone={c.phone} label={`Call ${c.name}`} />
            </div>
          ))
        )}
      </Section>

      {profile.family_doctor && (
        <Section title="Family doctor">
          <p style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>
            {profile.family_doctor.name}
          </p>
          <CallButton
            phone={profile.family_doctor.phone}
            label="Call doctor"
          />
        </Section>
      )}

      <footer
        style={{
          marginTop: 28,
          textAlign: "center",
          color: MUTED,
          fontSize: 12,
        }}
      >
        <p>GDM Technoworld Pvt. Ltd.</p>
        <Link href="/" style={{ color: GOLD, textDecoration: "none" }}>
          kavachsaathi.in
        </Link>
      </footer>
    </Frame>
  );
}

function statusTitle(status: string) {
  if (status === "unactivated") return "Not activated";
  if (status === "blocked") return "Card blocked";
  if (status === "rate") return "Slow down";
  return "Unavailable";
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(ellipse at top, #1a1608 0%, ${BG} 55%),
          repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(212,175,55,0.03) 24px, rgba(212,175,55,0.03) 25px),
          repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(212,175,55,0.03) 24px, rgba(212,175,55,0.03) 25px)
        `,
        color: TEXT,
        padding: "0 16px 48px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {children}
    </div>
  );
}

function Banner() {
  return (
    <div
      style={{
        background: DANGER,
        color: "#fff",
        textAlign: "center",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "10px 12px",
        margin: "0 -16px 20px",
      }}
    >
      Emergency medical info
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${GOLD}33`,
        borderRadius: 14,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>{title}</h1>
      <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.5 }}>{body}</p>
    </div>
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

function ChipList({
  items,
  empty,
  danger,
}: {
  items: string[];
  empty: string;
  danger?: boolean;
}) {
  if (!items.length) {
    return <p style={{ color: MUTED, fontSize: 15 }}>{empty}</p>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            background: danger ? "rgba(229,57,53,0.15)" : "rgba(212,175,55,0.12)",
            color: danger ? "#FF8A80" : GOLD_LIGHT,
            border: `1px solid ${danger ? "rgba(229,57,53,0.35)" : GOLD + "44"}`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function CallButton({ phone, label }: { phone: string; label: string }) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return (
    <a
      href={`tel:+91${digits.slice(-10)}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 10,
        width: "100%",
        padding: "14px 16px",
        borderRadius: 10,
        background: `linear-gradient(135deg, ${GOLD_LIGHT}, #B8860B)`,
        color: "#0A0A08",
        fontFamily: "system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 16,
        textDecoration: "none",
      }}
    >
      📞 {label}
    </a>
  );
}

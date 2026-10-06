"use client";

/**
 * Public emergency profile for /card/{health_id} (activated).
 * Chrome labels respect regionalLang; user data is never translated.
 */
import type { PublicEmergencyProfile } from "@/lib/cardsRepo";
import type { FeatureFlags } from "@/lib/features/flags";
import { EmergencyActions } from "./EmergencyActions";
import { EmergencyPhase1 } from "./EmergencyPhase1";
import { EmergencyEaseControls } from "./EmergencyEaseControls";
import { NeedBloodButton } from "./NeedBloodButton";
import {
  LanguageSwitcher,
  useEmergencyLabels,
} from "@/components/LanguageSwitcher";

const css = `
.ks-e{max-width:480px;margin:0 auto;padding:16px 12px 88px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#F0EEE8;background:#080808;min-height:100vh;box-sizing:border-box}
.ks-e *{box-sizing:border-box}
.ks-banner{background:#E53935;color:#fff;text-align:center;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;padding:10px 12px;border-radius:8px;margin-bottom:14px}
.ks-head{display:flex;align-items:center;gap:14px;margin:8px 0 12px}
.ks-photo{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #D4AF37;background:#1a1a14;flex-shrink:0}
.ks-photo-ph{width:72px;height:72px;border-radius:50%;border:2px solid rgba(212,175,55,.35);background:#1a1a14;flex-shrink:0}
.ks-name{font-size:24px;font-weight:800;margin:0;line-height:1.2}
.ks-meta{color:#A8A59C;font-size:14px;margin:4px 0 0}
.ks-blood{font-size:42px;font-weight:800;color:#D4AF37;text-align:center;margin:8px 0 16px;letter-spacing:.02em}
.ks-card{background:#141410;border:1px solid rgba(212,175,55,.28);border-radius:12px;padding:12px 14px;margin-bottom:12px}
.ks-h{color:#D4AF37;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:0 0 6px}
.ks-body{font-size:15px;line-height:1.45;margin:0}
.ks-call{display:block;text-align:center;background:linear-gradient(135deg,#FCE49A,#D4AF37,#B8860B);color:#0a0a08;font-weight:800;text-decoration:none;padding:14px 16px;border-radius:12px;margin:10px 0 6px}
.ks-brand{text-align:center;color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
.ks-crit{background:#E53935;color:#fff;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;font-weight:600}
.ks-badge-wrap{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}
.ks-badge{background:#B71C1C;color:#fff;font-weight:800;font-size:16px;letter-spacing:.04em;text-transform:uppercase;text-align:center;padding:14px 12px;border-radius:10px;border:2px solid #FFCDD2;line-height:1.25}
`;

export function EmergencyLite({
  profile,
  scanToken,
  flags,
  validityExpired = false,
}: {
  profile: PublicEmergencyProfile;
  scanToken: string;
  flags: FeatureFlags;
  validityExpired?: boolean;
}) {
  const langOn = flags.regionalLang === true;
  const { label, setLang } = useEmergencyLabels(langOn);

  const contact = profile.emergency_contacts[0];
  // User data — never machine-translated
  const allergiesRaw =
    profile.allergies.length > 0
      ? profile.allergies.join(", ")
      : label("noneReported");
  const tel = contact?.phone
    ? `tel:${String(contact.phone).replace(/\D/g, "")}`
    : null;
  const photo = profile.photoSignedUrl || null;
  const firstName = (profile.name || "").split(/\s+/)[0] || "";

  const badgeLabels =
    flags.criticalBadges && profile.criticalFlagLabels?.length
      ? profile.criticalFlagLabels
      : flags.criticalBadges
        ? profile.criticalAlertLabels
        : [];

  return (
    <div className="ks-e">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <LanguageSwitcher
        enabled={langOn}
        onLangChange={setLang}
      />
      <p className="ks-brand">KavachSaathi · {label("tagline")}</p>
      <div className="ks-banner">{label("emergencyMedical")}</div>
      {validityExpired ? (
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#FCE49A",
            margin: "0 0 12px",
            padding: "8px",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 8,
          }}
        >
          Card validity expired — renew at kavachsaathi.in
        </p>
      ) : null}

      {badgeLabels.length > 0 ? (
        <div
          className="ks-badge-wrap"
          role="status"
          aria-label={label("criticalAlerts")}
        >
          {badgeLabels.map((b) => (
            <div key={b} className="ks-badge">
              {b}
            </div>
          ))}
        </div>
      ) : profile.criticalAlertLabels.length > 0 && !flags.criticalBadges ? (
        <div className="ks-crit">
          {label("critical")}: {profile.criticalAlertLabels.join(" · ")}
        </div>
      ) : null}

      <div className="ks-head">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="ks-photo"
            src={photo}
            alt=""
            width={72}
            height={72}
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="ks-photo-ph" aria-hidden />
        )}
        <div>
          <h1 className="ks-name">{profile.name}</h1>
          {profile.city ? (
            <p className="ks-meta">
              {label("city")}: {profile.city}
            </p>
          ) : null}
          {profile.insurerName ? (
            <p className="ks-meta">Insured with: {profile.insurerName}</p>
          ) : null}
        </div>
      </div>

      <div className="ks-blood" aria-label={label("bloodGroup")}>
        {profile.blood_group}
      </div>

      {flags.needBlood === true && profile.health_id ? (
        <NeedBloodButton
          healthId={profile.health_id}
          bloodGroup={profile.blood_group}
          compact
        />
      ) : null}

      <section className="ks-card">
        <h2 className="ks-h">{label("allergies")}</h2>
        <p className="ks-body">{allergiesRaw}</p>
      </section>

      {contact ? (
        <section className="ks-card">
          <h2 className="ks-h">{label("contacts")}</h2>
          <p className="ks-body">
            {contact.name}
            {contact.relation ? ` · ${contact.relation}` : ""}
          </p>
          {tel ? (
            <a className="ks-call" href={tel}>
              {label("call")} {contact.name || ""}
            </a>
          ) : null}
        </section>
      ) : null}

      {(profile.chronic_conditions.length > 0 ||
        profile.medications.length > 0) && (
        <section className="ks-card">
          <h2 className="ks-h">
            {label("chronic")} / {label("medications")}
          </h2>
          <p className="ks-body">
            {[...profile.chronic_conditions, ...profile.medications].join(
              " · "
            ) || "—"}
          </p>
        </section>
      )}

      <EmergencyActions
        scanToken={scanToken}
        healthId={profile.health_id || ""}
        sectionsRendered={profile.sectionsRendered}
        flags={flags}
      />

      <EmergencyPhase1
        flags={flags}
        healthId={profile.health_id || ""}
        contacts={profile.emergency_contacts}
        firstName={firstName}
      />

      <EmergencyEaseControls
        elderlyOn={flags.elderlyMode === true}
        readText={[
          profile.name,
          `Blood group ${profile.blood_group || ""}`,
          `Allergies ${allergiesRaw}`,
          profile.chronic_conditions.join(", "),
          profile.medications.join(", "),
          profile.emergency_contacts
            .map((c) => `${c.name} ${c.phone}`)
            .join(". "),
        ]
          .filter(Boolean)
          .join(". ")}
      />
    </div>
  );
}

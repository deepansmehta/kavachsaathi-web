/**
 * Public emergency profile for /card/{health_id} (activated).
 * Server-rendered shell; client islands only for action buttons + deferred footer.
 * Chrome labels use data-i18n for post-paint language updates. User data never translated.
 */
import type { PublicEmergencyProfile } from "@/lib/cardsRepo";
import type { FeatureFlags } from "@/lib/features/flags";
import { telLink, whatsappLink } from "@/lib/profileFields";
import { t } from "@/lib/i18n-emergency";
import { EmergencyActions } from "./EmergencyActions";
import { EmergencyStickyBar } from "./EmergencyStickyBar";
import { EmergencyDeferredFooter } from "./EmergencyDeferredFooter";
import { EmergencyAutoSummary } from "./EmergencyAutoSummary";

const css = `
.ks-e{--ink:#0B0812;--gold:#D4AF37;--gold2:#E8BF3E;--red:#C62828;--surface:#FAFAF7;--card:#FFFFFF;--muted:#5C574E;--line:rgba(11,8,18,.08);--shadow:0 4px 16px rgba(11,8,18,.06);max-width:480px;margin:0 auto;min-height:100vh;background:var(--surface);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:0 0 calc(72px + env(safe-area-inset-bottom,0px));box-sizing:border-box;-webkit-text-size-adjust:100%}
.ks-e *{box-sizing:border-box}
.ks-hero{background:var(--ink);color:#F7F4EC;padding:14px 16px 16px;position:relative}
.ks-hero::after{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--gold),var(--gold2),var(--gold));margin:12px -16px -16px}
.ks-headbar{display:flex;align-items:flex-start;gap:12px}
.ks-logo{width:40px;height:40px;flex-shrink:0}
.ks-head-titles{flex:1;min-width:0}
.ks-brand{margin:0;font-size:15px;font-weight:800;letter-spacing:.04em;color:var(--gold2)}
.ks-subtitle{margin:4px 0 0;font-size:14px;line-height:1.25;color:#F7F4EC;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ks-subtitle-hi{margin:2px 0 0;font-size:11px;line-height:1.3;color:rgba(247,244,236,.72);font-weight:600}
.ks-verified{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 10px;border-radius:999px;background:rgba(46,168,67,.16);border:1px solid rgba(46,168,67,.45);color:#8DFFA8;font-size:11px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.ks-verified-dot{width:6px;height:6px;border-radius:50%;background:#2EA843}
.ks-body{padding:12px 16px 8px}
.ks-id{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.ks-photo,.ks-photo-ph{width:88px;height:88px;border-radius:50%;flex-shrink:0;background:#EEEAE0}
.ks-photo{object-fit:cover;border:3px solid var(--gold);box-shadow:0 0 0 2px rgba(212,175,55,.25)}
.ks-photo-ph{border:3px solid rgba(212,175,55,.4);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#8A7010}
.ks-id-main{flex:1;min-width:0}
.ks-name{margin:0;font-size:26px;font-weight:800;line-height:1.15;letter-spacing:-.01em;word-wrap:break-word}
.ks-meta{margin:4px 0 0;font-size:15px;color:var(--muted);line-height:1.35}
.ks-blood{width:56px;height:56px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;flex-shrink:0;box-shadow:0 4px 12px rgba(198,40,40,.28);letter-spacing:.02em}
.ks-summary{background:linear-gradient(180deg,#FFF9E8,#FFFDF5);border:1px solid rgba(212,175,55,.45);border-radius:16px;padding:12px 14px;margin-bottom:12px;box-shadow:var(--shadow)}
.ks-h{margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.ks-body-text{margin:0;font-size:16px;line-height:1.45;color:var(--ink)}
.ks-summary-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.ks-summary-text.ks-summary-open{-webkit-line-clamp:unset;overflow:visible}
.ks-summary-more{margin-top:8px;padding:8px 0;min-height:44px;border:none;background:transparent;color:#8A7010;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;text-align:left}
.ks-badges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.ks-badge{display:inline-flex;align-items:center;background:var(--red);color:#fff;font-weight:800;font-size:13px;letter-spacing:.02em;padding:10px 12px;border-radius:999px;line-height:1.2;min-height:44px;border:2px solid #FFCDD2}
.ks-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:12px;box-shadow:var(--shadow)}
.ks-card-allergy{background:#FFF5F5;border-color:rgba(198,40,40,.22)}
.ks-card-allergy .ks-h{color:var(--red)}
.ks-card-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ks-card-head .ks-h{margin:0}
.ks-icon{width:20px;height:20px;flex-shrink:0}
.ks-list{margin:0;padding:0;list-style:none}
.ks-list li{font-size:16px;line-height:1.45;padding:6px 0;border-bottom:1px solid var(--line)}
.ks-list li:last-child{border-bottom:0;padding-bottom:0}
.ks-contact{padding:10px 0;border-bottom:1px solid var(--line)}
.ks-contact:last-child{border-bottom:0;padding-bottom:0}
.ks-contact-name{margin:0;font-size:17px;font-weight:700}
.ks-contact-rel{margin:2px 0 10px;font-size:14px;color:var(--muted)}
.ks-contact-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ks-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 14px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center}
.ks-btn-call{background:var(--ink);color:#fff}
.ks-btn-wa{background:#25D366;color:#06240f}
.ks-expired{text-align:center;font-size:13px;color:#7a5a00;margin:0 0 12px;padding:10px 12px;border:1px solid rgba(212,175,55,.45);border-radius:12px;background:#FFF8E1}
.ks-full-details{margin:16px 0 8px}
.ks-full-btn{width:100%;min-height:52px;padding:14px 16px;border-radius:14px;border:2px solid var(--gold);background:transparent;color:#8A7010;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
.ks-full-btn:focus-visible{outline:3px solid var(--gold2);outline-offset:2px}
.ks-footer{padding:8px 16px 16px;text-align:center}
.ks-footer-note{margin:0 0 8px;font-size:12px;line-height:1.45;color:var(--muted)}
.ks-footer-brand{margin:0 0 12px;font-size:12px;font-weight:700;color:var(--ink);letter-spacing:.02em}
.ks-footer-tools{display:grid;gap:10px;justify-items:center}
.ks-footer-ease{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.ks-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(250,250,247,.96);border-top:1px solid var(--line);backdrop-filter:blur(8px);max-width:480px;margin:0 auto}
.ks-sticky-btn{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:8px 4px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:800;font-size:12px;text-decoration:none;text-align:center;cursor:pointer;font-family:inherit;line-height:1.2}
.ks-sticky-primary{background:var(--red)!important;border-color:var(--red)!important;color:#fff!important}
.ks-sticky-disabled{opacity:.4;cursor:not-allowed}
.ks-sticky-btn:focus-visible,.ks-btn:focus-visible{outline:3px solid var(--gold2);outline-offset:2px}
html.ks-elderly .ks-e{font-size:18px}
html.ks-elderly .ks-name{font-size:32px}
html.ks-elderly .ks-body-text,html.ks-elderly .ks-list li,html.ks-elderly .ks-meta{font-size:18px}
html.ks-elderly .ks-badge{font-size:16px;padding:14px 16px}
@media (max-width:320px){.ks-name{font-size:24px}.ks-blood{width:56px;height:56px;font-size:18px}.ks-sticky{grid-template-columns:1fr 1fr}.ks-photo,.ks-photo-ph{width:80px;height:80px}}
@media print{.ks-sticky,.ks-full-details,.ks-footer-tools{display:none!important}.ks-e{padding-bottom:16px;background:#fff;max-width:100%}.ks-hero{background:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ks-badge,.ks-blood{-webkit-print-color-adjust:exact;print-color-adjust:exact}.ks-card{box-shadow:none;break-inside:avoid}}
`;

function ShieldLogo() {
  return (
    <svg
      className="ks-logo"
      viewBox="0 0 40 40"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="ksGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8BF3E" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <path
        d="M20 3L8 8v11c0 8.2 5.2 14.4 12 16.8C26.8 33.4 32 27.2 32 19V8L20 3z"
        fill="url(#ksGold)"
      />
      <path
        d="M20 10.5c-3.2 0-5.5 2.2-5.5 5.3 0 2.1 1.1 3.5 2.7 4.7l-.7 5.2L20 24.2l3.5 1.5-.7-5.2c1.6-1.2 2.7-2.6 2.7-4.7 0-3.1-2.3-5.3-5.5-5.3z"
        fill="#0B0812"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="ks-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#C62828"
        d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"
      />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg className="ks-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#D4AF37"
        d="M12 21s-7.2-4.6-9.5-8.4C.6 9.7 2.1 6 5.5 6c1.9 0 3.3 1.1 4.1 2.3C10.4 7.1 11.8 6 13.7 6c3.4 0 4.9 3.7 3 6.6C19.2 16.4 12 21 12 21z"
      />
    </svg>
  );
}
function IconPill() {
  return (
    <svg className="ks-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#D4AF37"
        d="M8.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7l7-7zm1.4 2.1l-5.5 5.5a3 3 0 004.2 4.2l5.5-5.5a3 3 0 00-4.2-4.2z"
      />
    </svg>
  );
}
function IconShield() {
  return (
    <svg className="ks-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#D4AF37"
        d="M12 2l8 3v7c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm0 2.2L6 6.1v5.9c0 3.8 2.5 7.2 6 8.6 3.5-1.4 6-4.8 6-8.6V6.1l-6-1.9z"
      />
    </svg>
  );
}

function formatMed(m: string): string {
  const s = m.trim();
  const match = s.match(/^(.+?)\s+(\d+\s*(?:mg|mcg|g|ml|IU|units?).+)$/i);
  if (match) return `${match[1]} · ${match[2]}`;
  return s;
}

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
  const photo = profile.photoThumbDataUrl || profile.photoSignedUrl || null;
  const firstName = (profile.name || "").split(/\s+/)[0] || "";
  const initials = (profile.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const badgeLabels =
    flags.criticalBadges && profile.criticalFlagLabels?.length
      ? profile.criticalFlagLabels
      : flags.criticalBadges
        ? profile.criticalAlertLabels
        : [];

  const metaParts = [
    profile.age != null ? `${profile.age}` : null,
    profile.gender || null,
  ].filter(Boolean);
  const metaLine = metaParts.length ? metaParts.join(" · ") : null;

  // City only — never street / full address (not in PublicEmergencyProfile)
  const cityOnly = profile.city ? String(profile.city).trim() : "";

  const readText = [
    profile.name,
    metaLine,
    `Blood group ${profile.blood_group || ""}`,
    profile.autoSummaryEn,
    badgeLabels.join(", "),
    profile.allergies.length
      ? `Allergies ${profile.allergies.join(", ")}`
      : "",
    profile.chronic_conditions.join(", "),
    profile.medications.join(", "),
    profile.emergency_contacts
      .map((c) => `${c.name} ${c.phone}`)
      .join(". "),
  ]
    .filter(Boolean)
    .join(". ");

  const showInsurance = Boolean(profile.insurerName || profile.schemeName);

  return (
    <div className="ks-e">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header className="ks-hero">
        <div className="ks-headbar">
          <ShieldLogo />
          <div className="ks-head-titles">
            <p className="ks-brand">KavachSaathi</p>
            <p className="ks-subtitle">Emergency Medical Profile</p>
            <p className="ks-subtitle-hi" lang="hi">
              आपातकालीन मेडिकल प्रोफ़ाइल
            </p>
            <span className="ks-verified">
              <span className="ks-verified-dot" aria-hidden />
              Verified KavachSaathi card
            </span>
          </div>
        </div>
      </header>

      <div className="ks-body">
        {validityExpired ? (
          <p className="ks-expired">
            Card validity expired — renew at kavachsaathi.in
          </p>
        ) : null}

        <section className="ks-id" aria-label="Identity">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="ks-photo"
              src={photo}
              alt=""
              width={88}
              height={88}
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <div className="ks-photo-ph" aria-hidden>
              {initials || "?"}
            </div>
          )}
          <div className="ks-id-main">
            <h1 className="ks-name">{profile.name}</h1>
            {metaLine ? <p className="ks-meta">{metaLine}</p> : null}
            {cityOnly ? (
              <p className="ks-meta">
                <span data-i18n="city">{t("city", "en")}</span>: {cityOnly}
              </p>
            ) : null}
          </div>
          {profile.blood_group && profile.blood_group !== "—" ? (
            <div
              className="ks-blood"
              aria-label={`${t("bloodGroup", "en")} ${profile.blood_group}`}
            >
              {profile.blood_group}
            </div>
          ) : null}
        </section>

        {badgeLabels.length > 0 ? (
          <div
            className="ks-badges"
            role="status"
            aria-label={t("criticalAlerts", "en")}
          >
            {badgeLabels.map((b) => (
              <span key={b} className="ks-badge">
                {b}
              </span>
            ))}
          </div>
        ) : profile.criticalAlertLabels.length > 0 && !flags.criticalBadges ? (
          <div className="ks-badges" role="status">
            <span className="ks-badge">
              {t("critical", "en")}: {profile.criticalAlertLabels.join(" · ")}
            </span>
          </div>
        ) : null}

        <EmergencyAutoSummary
          enabled={flags.autoSummary === true}
          en={profile.autoSummaryEn || ""}
          hi={profile.autoSummaryHi || ""}
        />

        {profile.allergies.length > 0 ? (
          <section className="ks-card ks-card-allergy" aria-label={t("allergies", "en")}>
            <div className="ks-card-head">
              <IconAlert />
              <h2 className="ks-h" data-i18n="allergies">
                {t("allergies", "en")}
              </h2>
            </div>
            <ul className="ks-list">
              {profile.allergies.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.chronic_conditions.length > 0 ? (
          <section className="ks-card" aria-label={t("chronic", "en")}>
            <div className="ks-card-head">
              <IconHeart />
              <h2 className="ks-h" data-i18n="chronic">
                {t("chronic", "en")}
              </h2>
            </div>
            <ul className="ks-list">
              {profile.chronic_conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.medications.length > 0 ? (
          <section className="ks-card" aria-label={t("medications", "en")}>
            <div className="ks-card-head">
              <IconPill />
              <h2 className="ks-h" data-i18n="medications">
                {t("medications", "en")}
              </h2>
            </div>
            <ul className="ks-list">
              {profile.medications.map((m) => (
                <li key={m}>{formatMed(m)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {showInsurance ? (
          <section className="ks-card" aria-label="Insurance">
            <div className="ks-card-head">
              <IconShield />
              <h2 className="ks-h">Insurance</h2>
            </div>
            <p className="ks-body-text">
              {profile.insurerName
                ? `Insured with: ${profile.insurerName}`
                : null}
              {profile.insurerName && profile.schemeName ? " · " : null}
              {profile.schemeName ? `Govt scheme: ${profile.schemeName}` : null}
            </p>
          </section>
        ) : null}

        {profile.emergency_contacts.length > 0 ? (
          <section className="ks-card" aria-label={t("contacts", "en")}>
            <div className="ks-card-head">
              <svg className="ks-icon" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#D4AF37"
                  d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.5 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.9c0-.5.4-1 1-1H8c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .7-.2 1l-2.2 2.2z"
                />
              </svg>
              <h2 className="ks-h" data-i18n="contacts">
                {t("contacts", "en")}
              </h2>
            </div>
            {profile.emergency_contacts.map((c, i) => {
              const tel = telLink(c.phone);
              const wa = whatsappLink(c.phone);
              return (
                <div className="ks-contact" key={`${c.phone}-${i}`}>
                  <p className="ks-contact-name">{c.name}</p>
                  {c.relation ? (
                    <p className="ks-contact-rel">{c.relation}</p>
                  ) : (
                    <div style={{ height: 8 }} />
                  )}
                  <div className="ks-contact-actions">
                    {tel ? (
                      <a
                        className="ks-btn ks-btn-call"
                        href={tel}
                        aria-label={`${t("call", "en")} ${c.name}`}
                      >
                        {t("call", "en")}
                      </a>
                    ) : null}
                    {wa ? (
                      <a
                        className="ks-btn ks-btn-wa"
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("whatsapp", "en")} ${c.name}`}
                      >
                        {t("whatsapp", "en")}
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {profile.family_doctor &&
        (profile.family_doctor.name || profile.family_doctor.phone) ? (
          <section className="ks-card" aria-label={t("familyDoctor", "en")}>
            <h2 className="ks-h" data-i18n="familyDoctor">
              {t("familyDoctor", "en")}
            </h2>
            <p className="ks-body-text">
              {profile.family_doctor.name}
              {profile.family_doctor.phone
                ? ` · ${profile.family_doctor.phone}`
                : ""}
            </p>
            {telLink(profile.family_doctor.phone) ? (
              <a
                className="ks-btn ks-btn-call"
                style={{ marginTop: 10, width: "100%" }}
                href={telLink(profile.family_doctor.phone)!}
                aria-label={`${t("call", "en")} ${profile.family_doctor.name}`}
              >
                {t("call", "en")} {profile.family_doctor.name}
              </a>
            ) : null}
          </section>
        ) : null}

        {profile.preferredHospital ? (
          <section className="ks-card" aria-label={t("preferredHospital", "en")}>
            <h2 className="ks-h" data-i18n="preferredHospital">
              {t("preferredHospital", "en")}
            </h2>
            <p className="ks-body-text">{profile.preferredHospital}</p>
          </section>
        ) : null}

        {profile.organDonor && profile.organDonor !== "unset" ? (
          <section className="ks-card" aria-label={t("organDonor", "en")}>
            <h2 className="ks-h" data-i18n="organDonor">
              {t("organDonor", "en")}
            </h2>
            <p className="ks-body-text">
              {profile.organDonor === "yes" ? t("yes", "en") : t("no", "en")}
            </p>
          </section>
        ) : null}

        <EmergencyActions
          scanToken={scanToken}
          healthId={profile.health_id || ""}
          sectionsRendered={profile.sectionsRendered}
          flags={flags}
        />

        <EmergencyDeferredFooter
          regionalLang={flags.regionalLang === true}
          elderlyOn={flags.elderlyMode === true}
          readText={readText}
        />
      </div>

      <EmergencyStickyBar
        flags={flags}
        healthId={profile.health_id || ""}
        contacts={profile.emergency_contacts}
        firstName={firstName}
        bloodGroup={profile.blood_group}
      />
    </div>
  );
}

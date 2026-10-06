/**
 * Firestore-backed site business settings.
 * Docs: config/links , config/policy
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  COMPANY_WHATSAPP,
  HELPLINE_CALL_DISPLAY,
  HELPLINE_EMAIL,
  HELPLINE_WHATSAPP_DISPLAY,
  SITE_URL,
} from "./links";
import { GRACE_DAYS, VALIDITY_DAYS } from "@/lib/validity";

export type SiteLinks = {
  whatsappDigits: string;
  whatsappDisplay: string;
  callDisplay: string;
  callDigits: string;
  email: string;
  siteUrl: string;
};

export type SitePolicy = {
  /** Days of validity from activation date */
  validityDays: number;
  /** Grace days after expiry (emergency still visible) */
  graceDays: number;
  /** Days added to referrer validTill per successful referral */
  referralRewardDays: number;
  /** Max months of referral extensions per referrer per calendar year */
  referralMaxMonthsPerYear: number;
};

export const DEFAULT_LINKS: SiteLinks = {
  whatsappDigits: COMPANY_WHATSAPP,
  whatsappDisplay: HELPLINE_WHATSAPP_DISPLAY,
  callDisplay: HELPLINE_CALL_DISPLAY,
  callDigits: "917273000075",
  email: HELPLINE_EMAIL,
  siteUrl: SITE_URL,
};

export const DEFAULT_POLICY: SitePolicy = {
  validityDays: VALIDITY_DAYS,
  graceDays: GRACE_DAYS,
  referralRewardDays: 30,
  referralMaxMonthsPerYear: 12,
};

let cache: {
  at: number;
  links: SiteLinks;
  policy: SitePolicy;
} | null = null;

const TTL_MS = 60_000;

export async function loadSiteConfig(db: Firestore): Promise<{
  links: SiteLinks;
  policy: SitePolicy;
}> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { links: cache.links, policy: cache.policy };
  }
  const [linksSnap, policySnap] = await Promise.all([
    db.collection("config").doc("links").get(),
    db.collection("config").doc("policy").get(),
  ]);
  const l = linksSnap.exists ? linksSnap.data() || {} : {};
  const p = policySnap.exists ? policySnap.data() || {} : {};
  const links: SiteLinks = {
    whatsappDigits: String(l.whatsappDigits || DEFAULT_LINKS.whatsappDigits).replace(
      /\D/g,
      ""
    ),
    whatsappDisplay: String(
      l.whatsappDisplay || DEFAULT_LINKS.whatsappDisplay
    ),
    callDisplay: String(l.callDisplay || DEFAULT_LINKS.callDisplay),
    callDigits: String(l.callDigits || DEFAULT_LINKS.callDigits).replace(
      /\D/g,
      ""
    ),
    email: String(l.email || DEFAULT_LINKS.email),
    siteUrl: String(l.siteUrl || DEFAULT_LINKS.siteUrl),
  };
  const policy: SitePolicy = {
    validityDays:
      Number(p.validityDays) > 0
        ? Number(p.validityDays)
        : DEFAULT_POLICY.validityDays,
    graceDays:
      Number(p.graceDays) >= 0 ? Number(p.graceDays) : DEFAULT_POLICY.graceDays,
    referralRewardDays:
      Number(p.referralRewardDays) > 0
        ? Number(p.referralRewardDays)
        : DEFAULT_POLICY.referralRewardDays,
    referralMaxMonthsPerYear:
      Number(p.referralMaxMonthsPerYear) > 0
        ? Number(p.referralMaxMonthsPerYear)
        : DEFAULT_POLICY.referralMaxMonthsPerYear,
  };
  cache = { at: Date.now(), links, policy };
  return { links, policy };
}

export function clearSiteConfigCache() {
  cache = null;
}

export async function saveSiteConfig(
  db: Firestore,
  partial: {
    links?: Partial<SiteLinks>;
    policy?: Partial<SitePolicy>;
    updatedBy?: string;
  }
) {
  const now = new Date().toISOString();
  if (partial.links) {
    await db
      .collection("config")
      .doc("links")
      .set(
        {
          ...partial.links,
          updatedAt: now,
          updatedBy: partial.updatedBy || "admin",
        },
        { merge: true }
      );
  }
  if (partial.policy) {
    await db
      .collection("config")
      .doc("policy")
      .set(
        {
          ...partial.policy,
          updatedAt: now,
          updatedBy: partial.updatedBy || "admin",
        },
        { merge: true }
      );
  }
  clearSiteConfigCache();
}

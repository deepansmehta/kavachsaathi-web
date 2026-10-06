import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdminUser } from "@/lib/adminAuth";
import {
  DEFAULT_LINKS,
  DEFAULT_POLICY,
  loadSiteConfig,
  saveSiteConfig,
  type SiteLinks,
  type SitePolicy,
} from "@/lib/config/siteConfig";
import { NO_STORE_HEADERS } from "@/lib/activationGate";

export const dynamic = "force-dynamic";

/** GET /api/admin/site-config — links + policy for /admin editor */
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;
  const db = getAdminDb();
  const cfg = await loadSiteConfig(db);
  return NextResponse.json(
    {
      links: cfg.links,
      policy: cfg.policy,
      defaults: { links: DEFAULT_LINKS, policy: DEFAULT_POLICY },
    },
    { headers: NO_STORE_HEADERS }
  );
}

/** POST /api/admin/site-config — save links and/or policy */
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;
  const body = await req.json();
  const db = getAdminDb();

  const linksPatch: Partial<SiteLinks> = {};
  if (body.links && typeof body.links === "object") {
    const l = body.links as Record<string, unknown>;
    if (l.whatsappDigits != null)
      linksPatch.whatsappDigits = String(l.whatsappDigits).replace(/\D/g, "");
    if (l.whatsappDisplay != null)
      linksPatch.whatsappDisplay = String(l.whatsappDisplay).trim();
    if (l.callDisplay != null)
      linksPatch.callDisplay = String(l.callDisplay).trim();
    if (l.callDigits != null)
      linksPatch.callDigits = String(l.callDigits).replace(/\D/g, "");
    if (l.email != null) linksPatch.email = String(l.email).trim();
    if (l.siteUrl != null) linksPatch.siteUrl = String(l.siteUrl).trim();
  }

  const policyPatch: Partial<SitePolicy> = {};
  if (body.policy && typeof body.policy === "object") {
    const p = body.policy as Record<string, unknown>;
    if (p.validityDays != null) policyPatch.validityDays = Number(p.validityDays);
    if (p.graceDays != null) policyPatch.graceDays = Number(p.graceDays);
    if (p.referralRewardDays != null)
      policyPatch.referralRewardDays = Number(p.referralRewardDays);
    if (p.referralMaxMonthsPerYear != null)
      policyPatch.referralMaxMonthsPerYear = Number(p.referralMaxMonthsPerYear);
  }

  await saveSiteConfig(db, {
    links: Object.keys(linksPatch).length ? linksPatch : undefined,
    policy: Object.keys(policyPatch).length ? policyPatch : undefined,
    updatedBy: admin.email,
  });
  const cfg = await loadSiteConfig(db);
  return NextResponse.json(
    { ok: true, links: cfg.links, policy: cfg.policy },
    { headers: NO_STORE_HEADERS }
  );
}

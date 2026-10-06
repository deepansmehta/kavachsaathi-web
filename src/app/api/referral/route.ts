import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { requireAdminUser } from "@/lib/adminAuth";
import { recordAggEvent } from "@/lib/analytics";
import { SITE_URL, referralShareMessage, waMeLink } from "@/lib/config/links";
import { NO_STORE_HEADERS } from "@/lib/activationGate";
import { makeReferralCode } from "@/lib/referralReward";

export const dynamic = "force-dynamic";

/** GET /api/referral/me */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("referral");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  const adminCheck = req.nextUrl.searchParams.get("admin");
  if (adminCheck === "1") {
    const admin = await requireAdminUser(req);
    if (admin instanceof NextResponse) return admin;
    const db = getAdminDb();
    const snap = await db.collection("referral_events").limit(500).get();
    let clicks = 0;
    let conversions = 0;
    let rewardMonths = 0;
    const byCode: Record<
      string,
      { clicks: number; conversions: number; rewardMonths: number }
    > = {};
    const rewards: {
      code: string;
      referrer: string;
      referred: string;
      at: string;
    }[] = [];
    for (const d of snap.docs) {
      const x = d.data();
      const code = String(x.code || "");
      if (!byCode[code])
        byCode[code] = { clicks: 0, conversions: 0, rewardMonths: 0 };
      if (x.type === "click") {
        clicks += 1;
        byCode[code].clicks += 1;
      }
      if (x.type === "conversion") {
        conversions += 1;
        byCode[code].conversions += 1;
      }
      if (x.type === "referral_reward") {
        rewardMonths += 1;
        byCode[code].rewardMonths += 1;
        rewards.push({
          code,
          referrer: String(x.referrer_health_id || ""),
          referred: String(x.referred_health_id || ""),
          at: String(x.at || ""),
        });
      }
    }
    return NextResponse.json(
      { clicks, conversions, rewardMonths, byCode, rewards: rewards.slice(0, 100) },
      { headers: NO_STORE_HEADERS }
    );
  }

  const token = cookies().get(PROFILE_SESSION_COOKIE)?.value;
  const session = verifyProfileSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  const pref = db.collection("profiles").doc(session.profileId);
  const snap = await pref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const p = snap.data()!;
  let code = String(p.referralCode || "");
  if (!code) {
    code = makeReferralCode(session.profileId);
    await pref.set({ referralCode: code }, { merge: true });
  }
  const link = `${SITE_URL}/?ref=${code}`;
  const events = await db
    .collection("referral_events")
    .where("code", "==", code)
    .limit(200)
    .get();
  let clicks = 0;
  let conversions = 0;
  for (const d of events.docs) {
    if (d.data().type === "click") clicks += 1;
    if (d.data().type === "conversion") conversions += 1;
  }
  return NextResponse.json(
    {
      code,
      link,
      clicks,
      conversions,
      referralRewardCount: Number(p.referralRewardCount || 0),
      referralRewardMonthsThisYear: (() => {
        const y = new Date().getUTCFullYear();
        return Number(p.referralRewardYear) === y
          ? Number(p.referralRewardMonthsThisYear || 0)
          : 0;
      })(),
      validTill: p.validTill || null,
      shareWhatsapp: waMeLink(referralShareMessage(code)),
      earnedMessage:
        Number(p.referralRewardCount || 0) > 0
          ? `You earned +1 month validity — ${Number(p.referralRewardCount || 0)} referrals`
          : null,
    },
    { headers: NO_STORE_HEADERS }
  );
}

/** POST /api/referral — { action: click|conversion, code } */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("referral");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  const body = await req.json();
  const code = String(body.code || "")
    .trim()
    .toUpperCase()
    .slice(0, 16);
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const action = String(body.action || "click");
  const db = getAdminDb();

  if (action === "conversion") {
    const admin = await requireAdminUser(req);
    if (admin instanceof NextResponse) return admin;
    await db.collection("referral_events").add({
      code,
      type: "conversion",
      at: new Date().toISOString(),
      by: admin.email,
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }

  await db.collection("referral_events").add({
    code,
    type: "click",
    at: new Date().toISOString(),
  });
  void recordAggEvent(db, { type: "referral_click" });
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  res.cookies.set("ks_ref", code, {
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}

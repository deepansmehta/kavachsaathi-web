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

export const dynamic = "force-dynamic";

function makeCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `KS${(h % 1000000).toString().padStart(6, "0")}`;
}

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
    const byCode: Record<string, { clicks: number; conversions: number }> = {};
    for (const d of snap.docs) {
      const x = d.data();
      const code = String(x.code || "");
      if (!byCode[code]) byCode[code] = { clicks: 0, conversions: 0 };
      if (x.type === "click") {
        clicks += 1;
        byCode[code].clicks += 1;
      }
      if (x.type === "conversion") {
        conversions += 1;
        byCode[code].conversions += 1;
      }
    }
    return NextResponse.json(
      { clicks, conversions, byCode },
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
    code = makeCode(session.profileId);
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
      shareWhatsapp: waMeLink(referralShareMessage(code, link)),
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

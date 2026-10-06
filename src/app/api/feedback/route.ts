import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/features/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { recordAggEvent } from "@/lib/analytics";
import { NO_STORE_HEADERS } from "@/lib/activationGate";

export const dynamic = "force-dynamic";

/** POST /api/feedback — F52 (no health data stored) */
export async function POST(req: NextRequest) {
  const feature = await requireFeature("feedback");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  try {
    const db = getAdminDb();
    const ip = clientIp(req);
    const rl = await checkRateLimit({
      key: `feedback:${ip}`,
      limit: 10,
      windowMs: 24 * 60 * 60_000,
      captchaAfter: 99,
      db,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many" }, { status: 429 });
    }
    const body = await req.json();
    const stars = Number(body.stars);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: "stars 1–5 required" }, { status: 400 });
    }
    const comment = String(body.comment || "").slice(0, 500);
    const mayContact = body.mayContact === true;
    const context = ["activation", "full_details"].includes(
      String(body.context || "")
    )
      ? String(body.context)
      : "other";
    // Explicitly do NOT store health_id, name, phone
    await db.collection("feedback").add({
      stars,
      comment: comment || null,
      mayContact,
      context,
      at: new Date().toISOString(),
    });
    void recordAggEvent(db, { type: "feedback" });
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error("feedback", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** GET /api/feedback?admin=1 — admin average + list (no health data) */
export async function GET(req: NextRequest) {
  const feature = await requireFeature("feedback");
  if (!feature) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }
  if (req.nextUrl.searchParams.get("admin") !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { requireAdminUser } = await import("@/lib/adminAuth");
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;
  const db = getAdminDb();
  const snap = await db
    .collection("feedback")
    .orderBy("at", "desc")
    .limit(200)
    .get();
  const items = snap.docs.map((d) => {
    const x = d.data();
    return {
      stars: x.stars,
      comment: x.comment || null,
      mayContact: x.mayContact === true,
      context: x.context || null,
      at: x.at || null,
    };
  });
  const avg = items.length
    ? items.reduce((s, i) => s + Number(i.stars || 0), 0) / items.length
    : 0;
  return NextResponse.json(
    { average: Math.round(avg * 100) / 100, count: items.length, items },
    { headers: NO_STORE_HEADERS }
  );
}

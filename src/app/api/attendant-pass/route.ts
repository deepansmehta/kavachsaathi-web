import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  attendantWatermark,
  createAttendantToken,
  hashAttendantToken,
  normalizeHours,
} from "@/lib/patientEase/attendantPass";
import { SITE_URL, waMeLink } from "@/lib/config/links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("attendantPass");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const db = getAdminDb();
  const snap = await db
    .collection("attendant_passes")
    .where("profileId", "==", sess.profileId)
    .limit(20)
    .get();
  const passes = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      attendantName: x.attendantName,
      validTill: x.validTill,
      includeIds: !!x.includeIds,
      revoked: !!x.revoked,
      created_at: x.created_at || null,
    };
  });
  return NextResponse.json({ passes }, { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("attendantPass");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const attendantName = String(body.attendantName || "").trim().slice(0, 80);
  if (!attendantName) {
    return NextResponse.json(
      { error: "attendantName required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const hours = normalizeHours(body.hours);
  const includeIds = body.includeIds === true;
  const token = createAttendantToken();
  const tokenHash = hashAttendantToken(token);
  const validTill = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const db = getAdminDb();
  const ref = db.collection("attendant_passes").doc();
  await ref.set({
    profileId: sess.profileId,
    health_id: sess.healthId,
    attendantName,
    hours,
    includeIds,
    tokenHash,
    validTill,
    revoked: false,
    created_at: FieldValue.serverTimestamp(),
  });
  const url = `${SITE_URL}/pass/${token}`;
  const watermark = attendantWatermark(attendantName, validTill);
  return NextResponse.json(
    {
      ok: true,
      id: ref.id,
      url,
      tokenOnce: token,
      validTill,
      watermark,
      shareWhatsapp: waMeLink(
        `KavachSaathi attendant pass for ${attendantName} (valid till ${validTill}): ${url}`
      ),
    },
    { headers: noStoreHeaders() }
  );
}

export async function DELETE(req: NextRequest) {
  const feat = await requirePack2Feature("attendantPass");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const db = getAdminDb();
  const ref = db.collection("attendant_passes").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.profileId !== sess.profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ref.set(
    { revoked: true, revoked_at: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}

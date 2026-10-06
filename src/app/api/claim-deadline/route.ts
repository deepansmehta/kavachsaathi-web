import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  CLAIM_REQUIRED_DOCS,
  claimCalendarLinks,
  claimCountdown,
} from "@/lib/patientEase/claimDeadline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("claimDeadline");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  const cd = (snap.data()?.claimDeadline || {}) as {
    dischargeDate?: string;
    windowDays?: number;
  };
  if (!cd.dischargeDate || !cd.windowDays) {
    return NextResponse.json(
      { set: false, requiredDocs: CLAIM_REQUIRED_DOCS },
      { headers: noStoreHeaders() }
    );
  }
  const countdown = claimCountdown(cd.dischargeDate, Number(cd.windowDays));
  const cal = claimCalendarLinks({
    dischargeDate: cd.dischargeDate,
    windowDays: Number(cd.windowDays),
    name: String(snap.data()?.full_name || ""),
  });
  return NextResponse.json(
    {
      set: true,
      dischargeDate: cd.dischargeDate,
      windowDays: Number(cd.windowDays),
      countdown,
      requiredDocs: CLAIM_REQUIRED_DOCS,
      googleCalendarUrl: cal.googleCalendarUrl,
      ics: cal.ics,
    },
    { headers: noStoreHeaders() }
  );
}

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("claimDeadline");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const dischargeDate = String(body.dischargeDate || "").slice(0, 40);
  const windowDays = Math.max(1, Math.min(365, Number(body.windowDays) || 30));
  if (!dischargeDate || Number.isNaN(Date.parse(dischargeDate))) {
    return NextResponse.json(
      { error: "Valid dischargeDate required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  const db = getAdminDb();
  await db.collection("profiles").doc(sess.profileId).set(
    {
      claimDeadline: { dischargeDate, windowDays },
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  const countdown = claimCountdown(dischargeDate, windowDays);
  const cal = claimCalendarLinks({
    dischargeDate,
    windowDays,
    name: String(snap.data()?.full_name || ""),
  });
  return NextResponse.json(
    {
      ok: true,
      countdown,
      requiredDocs: CLAIM_REQUIRED_DOCS,
      googleCalendarUrl: cal.googleCalendarUrl,
      ics: cal.ics,
    },
    { headers: noStoreHeaders() }
  );
}

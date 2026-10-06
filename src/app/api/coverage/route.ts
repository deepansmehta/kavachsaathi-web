import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import {
  COVERAGE_DISCLAIMER,
  parseCoverage,
  roomTip,
} from "@/lib/patientEase/coverage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feat = await requirePack2Feature("coverageSnapshot");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  const coverage = parseCoverage(snap.data()?.coverageSnapshot);
  return NextResponse.json(
    { coverage, roomTip: roomTip(coverage), disclaimer: COVERAGE_DISCLAIMER },
    { headers: noStoreHeaders() }
  );
}

export async function PATCH(req: NextRequest) {
  const feat = await requirePack2Feature("coverageSnapshot");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const coverage = parseCoverage(body.coverage || body);
  const db = getAdminDb();
  await db.collection("profiles").doc(sess.profileId).set(
    {
      coverageSnapshot: coverage,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return NextResponse.json(
    { ok: true, coverage, roomTip: roomTip(coverage), disclaimer: COVERAGE_DISCLAIMER },
    { headers: noStoreHeaders() }
  );
}
